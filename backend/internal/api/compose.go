package api

import (
	"errors"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/arfiansyah/webmail/internal/smtp"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type ComposeHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewComposeHandler(db *gorm.DB, cfg *config.Config) *ComposeHandler {
	return &ComposeHandler{db: db, cfg: cfg}
}

type sendRequest struct {
	To         []string `json:"to"`
	Cc         []string `json:"cc"`
	Bcc        []string `json:"bcc"`
	Subject    string   `json:"subject"`
	Body       string   `json:"body"`
	IsHTML     bool     `json:"is_html"`
	InReplyTo  string   `json:"in_reply_to"`
	References []string `json:"references"`
}

func (h *ComposeHandler) Send(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var req sendRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if len(req.To) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "at least one recipient is required"},
		})
	}

	if req.Subject == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "subject is required"},
		})
	}

	if req.Body == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "body is required"},
		})
	}

	// Decrypt password from session
	var session models.Session
	if err := h.db.Where("email = ?", email).Order("created_at DESC").First(&session).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no active session"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "session lookup failed"},
		})
	}

	password, err := auth.Decrypt(session.EncryptedCreds, h.cfg.Session.EncryptionKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to decrypt credentials"},
		})
	}

	smtpCfg := smtp.SMTPConfig{
		Host:     h.cfg.Auth.SMTP.Host,
		Port:     h.cfg.Auth.SMTP.Port,
		StartTLS: h.cfg.Auth.SMTP.StartTLS,
	}

	msg := smtp.EmailMessage{
		From:       email,
		To:         req.To,
		Cc:         req.Cc,
		Bcc:        req.Bcc,
		Subject:    req.Subject,
		Body:       req.Body,
		IsHTML:     req.IsHTML,
		InReplyTo:  req.InReplyTo,
		References: req.References,
	}

	if err := smtp.Send(smtpCfg, email, password, msg); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "SMTP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

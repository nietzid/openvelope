package api

import (
	"encoding/base64"
	"errors"
	"io"
	"time"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/arfiansyah/webmail/internal/smtp"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type ComposeHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	manager *imap.Manager
}

func NewComposeHandler(db *gorm.DB, cfg *config.Config, manager *imap.Manager) *ComposeHandler {
	return &ComposeHandler{db: db, cfg: cfg, manager: manager}
}

// UploadAttachment handles multipart/form-data file upload for compose.
func (h *ComposeHandler) UploadAttachment(c fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "file is required"},
		})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to open file"},
		})
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to read file"},
		})
	}

	return c.JSON(fiber.Map{
		"filename":     file.Filename,
		"content_type": file.Header.Get("Content-Type"),
		"content":      base64.StdEncoding.EncodeToString(data),
		"size":         len(data),
	})
}

type attachmentData struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Content     string `json:"content"` // base64 encoded
}

type sendRequest struct {
	To          []string         `json:"to"`
	Cc          []string         `json:"cc"`
	Bcc         []string         `json:"bcc"`
	Subject     string           `json:"subject"`
	Body        string           `json:"body"`
	IsHTML      bool             `json:"is_html"`
	InReplyTo   string           `json:"in_reply_to"`
	References  []string         `json:"references"`
	Attachments []attachmentData `json:"attachments"`
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
		Host:          h.cfg.Auth.SMTP.Host,
		Port:          h.cfg.Auth.SMTP.Port,
		StartTLS:      h.cfg.Auth.SMTP.StartTLS,
		RelayEnabled:  h.cfg.Auth.SMTP.RelayUsername != "" || h.cfg.SMTPRelay.Enabled,
		RelayUsername: h.cfg.Auth.SMTP.RelayUsername,
		RelayPassword: h.cfg.Auth.SMTP.RelayPassword,
		RelayFrom:     h.cfg.Auth.SMTP.RelayFrom,
		RelayAuth:     h.cfg.Auth.SMTP.RelayAuth,
	}

	// If global SMTP relay is enabled and no per-SMTP-section relay is set, use global relay config
	if h.cfg.SMTPRelay.Enabled && h.cfg.Auth.SMTP.RelayUsername == "" {
		smtpCfg.Host = h.cfg.SMTPRelay.Host
		smtpCfg.Port = h.cfg.SMTPRelay.Port
		smtpCfg.RelayEnabled = true
		smtpCfg.RelayUsername = h.cfg.SMTPRelay.Username
		smtpCfg.RelayPassword = h.cfg.SMTPRelay.Password
		smtpCfg.RelayAuth = h.cfg.SMTPRelay.Auth
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

	var smtpAttachments []smtp.Attachment
	for _, att := range req.Attachments {
		decoded, err := base64.StdEncoding.DecodeString(att.Content)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid attachment content"},
			})
		}
		smtpAttachments = append(smtpAttachments, smtp.Attachment{
			Filename:    att.Filename,
			ContentType: att.ContentType,
			Content:     decoded,
		})
	}

	raw, err := smtp.BuildMessageWithAttachments(msg, smtpAttachments)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "SMTP_FAILED", "message": err.Error()},
		})
	}

	if err := smtp.SendRaw(smtpCfg, email, password, msg, raw); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "SMTP_FAILED", "message": err.Error()},
		})
	}

	sentSaved := true
	var sentSaveError string
	if h.manager != nil {
		conn, err := h.manager.GetOrCreate(email, password)
		if err != nil {
			sentSaved = false
			sentSaveError = err.Error()
		} else {
			sentFolder := "Sent"
			sentFolderExists := false
			if folders, err := imap.ListFolders(conn); err == nil {
				sentFolder = imap.ResolveSentFolder(folders)
				for _, folder := range folders {
					if folder.Name == sentFolder {
						sentFolderExists = true
						break
					}
				}
			}
			if err := imap.AppendMessage(conn, sentFolder, raw, []string{`\Seen`}, time.Now()); err != nil {
				if sentFolder == "Sent" && !sentFolderExists {
					if createErr := imap.CreateFolder(conn, sentFolder); createErr == nil {
						err = imap.AppendMessage(conn, sentFolder, raw, []string{`\Seen`}, time.Now())
					}
				}
				if err != nil {
					sentSaved = false
					sentSaveError = err.Error()
				}
			}
		}
	}

	return c.JSON(fiber.Map{
		"ok":              true,
		"sent_saved":      sentSaved,
		"sent_save_error": sentSaveError,
	})
}

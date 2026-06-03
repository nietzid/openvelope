package api

import (
	"errors"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type SearchHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	manager *imap.Manager
}

func NewSearchHandler(db *gorm.DB, cfg *config.Config, manager *imap.Manager) *SearchHandler {
	return &SearchHandler{db: db, cfg: cfg, manager: manager}
}

func (h *SearchHandler) getUserConnection(c fiber.Ctx) (*imap.UserConnection, error) {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return nil, errors.New("no email in context")
	}

	var session models.Session
	if err := h.db.Where("email = ?", email).Order("created_at DESC").First(&session).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("no active session")
		}
		return nil, err
	}

	password, err := auth.Decrypt(session.EncryptedCreds, h.cfg.Session.EncryptionKey)
	if err != nil {
		return nil, err
	}

	return h.manager.GetOrCreate(email, password)
}

type searchRequest struct {
	Folder  string `json:"folder" query:"folder"`
	Text    string `json:"text" query:"text"`
	From    string `json:"from" query:"from"`
	To      string `json:"to" query:"to"`
	Subject string `json:"subject" query:"subject"`
	Unseen  *bool  `json:"unseen" query:"unseen"`
	Flagged *bool  `json:"flagged" query:"flagged"`
}

func (h *SearchHandler) Search(c fiber.Ctx) error {
	folder := c.Query("folder", "INBOX")
	text := c.Query("text")
	from := c.Query("from")
	to := c.Query("to")
	subject := c.Query("subject")

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	query := imap.SearchQuery{
		Text:    text,
		From:    from,
		To:      to,
		Subject: subject,
	}

	results, err := imap.SearchMessages(conn, folder, query)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"results": results,
		"count":   len(results),
	})
}

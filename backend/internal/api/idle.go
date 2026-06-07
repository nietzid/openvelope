package api

import (
	"log"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/arfiansyah/webmail/internal/ws"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

// IdleHandler manages IDLE folder switching for WebSocket-connected users.
type IdleHandler struct {
	manager *imap.Manager
	hub     *ws.Hub
	db      *gorm.DB
	cfg     *config.Config
}

// NewIdleHandler creates a new IdleHandler.
func NewIdleHandler(db *gorm.DB, cfg *config.Config, manager *imap.Manager, hub *ws.Hub) *IdleHandler {
	return &IdleHandler{
		manager: manager,
		hub:     hub,
		db:      db,
		cfg:     cfg,
	}
}

type idleSwitchRequest struct {
	Folder string `json:"folder"`
}

// Switch stops IDLE on the current folder and restarts it on the requested folder.
func (h *IdleHandler) Switch(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "unauthorized"},
		})
	}

	var req idleSwitchRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if req.Folder == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "folder is required"},
		})
	}

	// Check that the user has an active WebSocket connection (and thus a watcher)
	if !h.hub.HasWatcher(email) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": fiber.Map{"code": "NO_CONNECTION", "message": "no active WebSocket connection"},
		})
	}

	// Look up the user's session to get encrypted IMAP creds
	var session models.Session
	if err := h.db.Where("email = ?", email).Order("created_at DESC").First(&session).Error; err != nil {
		log.Printf("idle switch: failed to load session for %s: %v", email, err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no active session"},
		})
	}

	password, err := auth.Decrypt(session.EncryptedCreds, h.cfg.Session.EncryptionKey)
	if err != nil {
		log.Printf("idle switch: failed to decrypt credentials for %s: %v", email, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to load credentials"},
		})
	}

	// Start a new IDLE watcher on the requested folder. SetWatcher automatically
	// stops the previous watcher before registering the new one.
	watcher := h.manager.StartIdle(email, password, req.Folder, func(event imap.IdleEvent) {
		data, err := event.JSON()
		if err != nil {
			log.Printf("idle event marshal: %v", err)
			return
		}
		select {
		case h.hub.Broadcast <- ws.BroadcastMessage{Email: email, Data: data}:
		default:
		}
	})
	h.hub.SetWatcher(email, watcher)

	return c.JSON(fiber.Map{"ok": true, "folder": req.Folder})
}

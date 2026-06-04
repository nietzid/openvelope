package api

import (
	"errors"
	"strconv"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type MessageHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	manager *imap.Manager
}

func NewMessageHandler(db *gorm.DB, cfg *config.Config, manager *imap.Manager) *MessageHandler {
	return &MessageHandler{
		db:      db,
		cfg:     cfg,
		manager: manager,
	}
}

func (h *MessageHandler) getUserConnection(c fiber.Ctx) (*imap.UserConnection, error) {
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

func (h *MessageHandler) List(c fiber.Ctx) error {
	folder := c.Query("folder", "INBOX")
	page, _ := strconv.Atoi(c.Query("page", "0"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "50"))

	if page < 0 {
		page = 0
	}
	if pageSize <= 0 || pageSize > 200 {
		pageSize = 50
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	messages, total, err := imap.ListMessages(conn, folder, page, pageSize)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"messages":  messages,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func (h *MessageHandler) Get(c fiber.Ctx) error {
	folder := c.Query("folder", "INBOX")
	uidStr := c.Params("uid")
	uid, err := strconv.ParseUint(uidStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid uid"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	body, err := imap.GetMessage(conn, folder, uint32(uid))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	c.Set("Content-Type", "message/rfc822")
	return c.Send(body)
}

func (h *MessageHandler) GetHeaders(c fiber.Ctx) error {
	folder := c.Query("folder", "INBOX")
	uidStr := c.Params("uid")
	uid, err := strconv.ParseUint(uidStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid uid"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	headers, err := imap.GetMessageHeaders(conn, folder, uint32(uid))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(headers)
}

type updateFlagsRequest struct {
	Folder string   `json:"folder"`
	UIDs   []uint32 `json:"uids"`
	Flag   string   `json:"flag"`
	Value  bool     `json:"value"`
}

func (h *MessageHandler) UpdateFlags(c fiber.Ctx) error {
	var req updateFlagsRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if req.Folder == "" || len(req.UIDs) == 0 || req.Flag == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "folder, uids, and flag are required"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	if err := imap.UpdateFlags(conn, req.Folder, req.UIDs, req.Flag, req.Value); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *MessageHandler) Delete(c fiber.Ctx) error {
	folder := c.Query("folder", "INBOX")
	uidStr := c.Params("uid")
	uid, err := strconv.ParseUint(uidStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid uid"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	if err := imap.DeleteMessage(conn, folder, uint32(uid)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

type moveRequest struct {
	UID         uint32 `json:"uid"`
	DestFolder  string `json:"dest_folder"`
}

func (h *MessageHandler) Move(c fiber.Ctx) error {
	folder := c.Query("folder", "INBOX")
	var req moveRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if req.DestFolder == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "dest_folder is required"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	if err := imap.MoveMessage(conn, folder, req.UID, req.DestFolder); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

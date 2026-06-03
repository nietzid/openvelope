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

type FolderHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	manager *imap.Manager
}

func NewFolderHandler(db *gorm.DB, cfg *config.Config, manager *imap.Manager) *FolderHandler {
	return &FolderHandler{
		db:      db,
		cfg:     cfg,
		manager: manager,
	}
}

// getUserConnection resolves the authenticated user's IMAP connection
// by looking up their session, decrypting credentials, and getting/creating
// the IMAP connection from the manager.
func (h *FolderHandler) getUserConnection(c fiber.Ctx) (*imap.UserConnection, error) {
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

func (h *FolderHandler) List(c fiber.Ctx) error {
	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	folders, err := imap.ListFolders(conn)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{"folders": folders})
}

type createFolderRequest struct {
	Name string `json:"name"`
}

func (h *FolderHandler) Create(c fiber.Ctx) error {
	var req createFolderRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "folder name is required"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	if err := imap.CreateFolder(conn, req.Name); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok": true, "name": req.Name})
}

type renameFolderRequest struct {
	OldName string `json:"old_name"`
	NewName string `json:"new_name"`
}

func (h *FolderHandler) Rename(c fiber.Ctx) error {
	var req renameFolderRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if req.OldName == "" || req.NewName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "old_name and new_name are required"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	if err := imap.RenameFolder(conn, req.OldName, req.NewName); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *FolderHandler) Delete(c fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "folder name is required"},
		})
	}

	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	if err := imap.DeleteFolder(conn, name); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

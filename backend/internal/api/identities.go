package api

import (
	"errors"
	"net/mail"
	"strconv"

	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"github.com/microcosm-cc/bluemonday"
	"gorm.io/gorm"
)

type IdentitiesHandler struct {
	db *gorm.DB
}

func NewIdentitiesHandler(db *gorm.DB) *IdentitiesHandler {
	return &IdentitiesHandler{db: db}
}

func isValidEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}

func sanitizeSignatureHTML(html string) string {
	p := bluemonday.UGCPolicy()
	p.AllowElements("p", "br", "strong", "em", "b", "i", "u", "a", "img", "div", "span")
	p.AllowAttrs("href").OnElements("a")
	p.AllowAttrs("src", "alt", "width", "height").OnElements("img")
	p.AllowURLSchemes("http", "https", "mailto")
	p.AllowAttrs("style").OnElements("span", "p", "div")
	return p.Sanitize(html)
}

// ---- Identity endpoints ----

func (h *IdentitiesHandler) ListIdentities(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var identities []models.Identity
	if err := h.db.Where("email = ?", email).Order("is_default DESC, name ASC").Find(&identities).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to list identities"},
		})
	}

	return c.JSON(fiber.Map{"identities": identities})
}

func (h *IdentitiesHandler) CreateIdentity(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var identity models.Identity
	if err := c.Bind().JSON(&identity); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if identity.Name == "" || identity.FromEmail == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "name and from_email are required"},
		})
	}

	if !isValidEmail(identity.FromEmail) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid from_email address"},
		})
	}

	if identity.ReplyTo != "" && !isValidEmail(identity.ReplyTo) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid reply_to address"},
		})
	}

	identity.Email = email

	// If setting as default, clear other defaults first
	if identity.IsDefault {
		if err := h.db.Model(&models.Identity{}).Where("email = ?", email).Update("is_default", false).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update defaults"},
			})
		}
	}

	// If this is the first identity, make it default
	var count int64
	h.db.Model(&models.Identity{}).Where("email = ?", email).Count(&count)
	if count == 0 {
		identity.IsDefault = true
	}

	if err := h.db.Create(&identity).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to create identity"},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"identity": identity})
}

func (h *IdentitiesHandler) UpdateIdentity(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid identity id"},
		})
	}

	var existing models.Identity
	if err := h.db.Where("id = ? AND email = ?", id, email).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": fiber.Map{"code": "NOT_FOUND", "message": "identity not found"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to find identity"},
		})
	}

	var updates models.Identity
	if err := c.Bind().JSON(&updates); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if updates.FromEmail != "" && !isValidEmail(updates.FromEmail) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid from_email address"},
		})
	}

	if updates.ReplyTo != "" && !isValidEmail(updates.ReplyTo) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid reply_to address"},
		})
	}

	// If setting as default, clear other defaults first
	if updates.IsDefault {
		if err := h.db.Model(&models.Identity{}).Where("email = ? AND id != ?", email, id).Update("is_default", false).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update defaults"},
			})
		}
	}

	updates.Email = email

	if err := h.db.Model(&existing).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update identity"},
		})
	}

	return c.JSON(fiber.Map{"identity": existing})
}

func (h *IdentitiesHandler) DeleteIdentity(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid identity id"},
		})
	}

	result := h.db.Where("id = ? AND email = ?", id, email).Delete(&models.Identity{})
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to delete identity"},
		})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": fiber.Map{"code": "NOT_FOUND", "message": "identity not found"},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ---- Signature endpoints ----

func (h *IdentitiesHandler) ListSignatures(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var signatures []models.Signature
	if err := h.db.Where("email = ?", email).Order("is_default DESC, name ASC").Find(&signatures).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to list signatures"},
		})
	}

	return c.JSON(fiber.Map{"signatures": signatures})
}

func (h *IdentitiesHandler) CreateSignature(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var sig models.Signature
	if err := c.Bind().JSON(&sig); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if sig.Name == "" || sig.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "name and content are required"},
		})
	}

	sig.Email = email
	sig.Content = sanitizeSignatureHTML(sig.Content)

	// If setting as default, clear other defaults first
	if sig.IsDefault {
		if err := h.db.Model(&models.Signature{}).Where("email = ?", email).Update("is_default", false).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update defaults"},
			})
		}
	}

	// If this is the first signature, make it default
	var count int64
	h.db.Model(&models.Signature{}).Where("email = ?", email).Count(&count)
	if count == 0 {
		sig.IsDefault = true
	}

	if err := h.db.Create(&sig).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to create signature"},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"signature": sig})
}

func (h *IdentitiesHandler) UpdateSignature(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid signature id"},
		})
	}

	var existing models.Signature
	if err := h.db.Where("id = ? AND email = ?", id, email).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": fiber.Map{"code": "NOT_FOUND", "message": "signature not found"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to find signature"},
		})
	}

	var updates models.Signature
	if err := c.Bind().JSON(&updates); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if updates.Content != "" {
		updates.Content = sanitizeSignatureHTML(updates.Content)
	}

	// If setting as default, clear other defaults first
	if updates.IsDefault {
		if err := h.db.Model(&models.Signature{}).Where("email = ? AND id != ?", email, id).Update("is_default", false).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update defaults"},
			})
		}
	}

	updates.Email = email

	if err := h.db.Model(&existing).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update signature"},
		})
	}

	return c.JSON(fiber.Map{"signature": existing})
}

func (h *IdentitiesHandler) DeleteSignature(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid signature id"},
		})
	}

	result := h.db.Where("id = ? AND email = ?", id, email).Delete(&models.Signature{})
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to delete signature"},
		})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": fiber.Map{"code": "NOT_FOUND", "message": "signature not found"},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

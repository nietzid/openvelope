package api

import (
	"errors"
	"strings"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type SmtpSettingsHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewSmtpSettingsHandler(db *gorm.DB, cfg *config.Config) *SmtpSettingsHandler {
	return &SmtpSettingsHandler{db: db, cfg: cfg}
}

// SmtpSettingsResponse is the API response with password masked.
type SmtpSettingsResponse struct {
	ID            uint   `json:"id"`
	RelayHost     string `json:"relay_host"`
	RelayPort     int    `json:"relay_port"`
	RelayUsername string `json:"relay_username"`
	RelayPassword string `json:"relay_password"` // masked
	RelayAuth     string `json:"relay_auth"`
	Enabled       bool   `json:"enabled"`
}

// GetSmtpSettings returns the user's SMTP relay settings (password masked).
func (h *SmtpSettingsHandler) GetSmtpSettings(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var settings models.SmtpSettings
	if err := h.db.Where("email = ?", email).First(&settings).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Return empty/default settings
			return c.JSON(SmtpSettingsResponse{
				RelayPort: 587,
				RelayAuth: "plain",
				Enabled:   false,
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to load SMTP settings"},
		})
	}

	return c.JSON(SmtpSettingsResponse{
		ID:            settings.ID,
		RelayHost:     settings.RelayHost,
		RelayPort:     settings.RelayPort,
		RelayUsername: settings.RelayUsername,
		RelayPassword: maskPassword(settings.RelayPassword),
		RelayAuth:     settings.RelayAuth,
		Enabled:       settings.Enabled,
	})
}

// UpdateSmtpSettingsRequest is the request body for PUT /api/settings/smtp.
type UpdateSmtpSettingsRequest struct {
	RelayHost     string `json:"relay_host"`
	RelayPort     int    `json:"relay_port"`
	RelayUsername string `json:"relay_username"`
	RelayPassword string `json:"relay_password"`
	RelayAuth     string `json:"relay_auth"`
	Enabled       bool   `json:"enabled"`
}

// UpdateSmtpSettings saves/updates the user's SMTP relay settings.
func (h *SmtpSettingsHandler) UpdateSmtpSettings(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var req UpdateSmtpSettingsRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	// Validate auth mode
	authMode := strings.ToLower(req.RelayAuth)
	if authMode != "plain" && authMode != "login" && authMode != "none" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "relay_auth must be 'plain', 'login', or 'none'"},
		})
	}

	var settings models.SmtpSettings
	err := h.db.Where("email = ?", email).First(&settings).Error
	isNew := errors.Is(err, gorm.ErrRecordNotFound)
	if err != nil && !isNew {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to load SMTP settings"},
		})
	}

	settings.Email = email
	settings.RelayHost = req.RelayHost
	settings.RelayPort = req.RelayPort
	settings.RelayUsername = req.RelayUsername
	settings.RelayAuth = authMode
	settings.Enabled = req.Enabled

	// Encrypt password before storage (only update if not masked placeholder)
	if req.RelayPassword != "" && !isMaskedPassword(req.RelayPassword) {
		encrypted, encErr := auth.Encrypt(req.RelayPassword, h.cfg.Session.EncryptionKey)
		if encErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "INTERNAL", "message": "failed to encrypt password"},
			})
		}
		settings.RelayPassword = encrypted
	}

	if isNew {
		if err := h.db.Create(&settings).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "INTERNAL", "message": "failed to save SMTP settings"},
			})
		}
	} else {
		if err := h.db.Save(&settings).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "INTERNAL", "message": "failed to update SMTP settings"},
			})
		}
	}

	return c.JSON(SmtpSettingsResponse{
		ID:            settings.ID,
		RelayHost:     settings.RelayHost,
		RelayPort:     settings.RelayPort,
		RelayUsername: settings.RelayUsername,
		RelayPassword: maskPassword(settings.RelayPassword),
		RelayAuth:     settings.RelayAuth,
		Enabled:       settings.Enabled,
	})
}

// maskPassword returns a masked representation of an encrypted password.
func maskPassword(encrypted string) string {
	if encrypted == "" {
		return ""
	}
	return "••••••••"
}

// isMaskedPassword checks if the value is the masked placeholder.
func isMaskedPassword(val string) bool {
	return val == "••••••••"
}

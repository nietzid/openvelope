package api

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	manager *imap.Manager
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config, manager *imap.Manager) *AuthHandler {
	return &AuthHandler{
		db:      db,
		cfg:     cfg,
		manager: manager,
	}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	Email        string `json:"email"`
}

func (h *AuthHandler) Login(c fiber.Ctx) error {
	var req loginRequest
	fmt.Println("login request", req)
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "email and password are required"},
		})
	}

	imapAuthCfg := auth.IMAPAuthConfig{
		Host: h.cfg.Auth.IMAP.Host,
		Port: h.cfg.Auth.IMAP.Port,
		TLS:  h.cfg.Auth.IMAP.TLS,
	}

	if err := auth.AuthenticateIMAP(imapAuthCfg, req.Email, req.Password); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "AUTH_FAILED", "message": "invalid email or password"},
		})
	}

	accessToken, err := auth.GenerateAccessToken(req.Email, h.cfg.Session.JWTSecret, h.cfg.Session.AccessTokenTTL.Duration)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to generate access token"},
		})
	}

	refreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to generate refresh token"},
		})
	}

	encryptedCreds, err := auth.Encrypt(req.Password, h.cfg.Session.EncryptionKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to encrypt credentials"},
		})
	}

	session := &models.Session{
		ID:             uuid.New().String(),
		Email:          req.Email,
		RefreshToken:   refreshToken,
		EncryptedCreds: encryptedCreds,
		UserAgent:      string(c.Request().Header.UserAgent()),
		IPAddress:      c.IP(),
		ExpiresAt:      time.Now().Add(h.cfg.Session.RefreshTokenTTL.Duration),
		CreatedAt:      time.Now(),
	}

	if err := h.db.Create(session).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to create session"},
		})
	}

	if _, err := h.manager.GetOrCreate(req.Email, req.Password); err != nil {
		// IMAP connection failed after auth — log but don't fail login
		// (next API call will retry)
	}

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
		Path:     "/api/auth",
		MaxAge:   int(h.cfg.Session.RefreshTokenTTL.Duration.Seconds()),
	})

	return c.JSON(loginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(h.cfg.Session.AccessTokenTTL.Duration.Seconds()),
		Email:        req.Email,
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) Refresh(c fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		var req refreshRequest
		if err := c.Bind().JSON(&req); err == nil {
			refreshToken = req.RefreshToken
		}
	}

	if refreshToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "refresh token required"},
		})
	}

	var session models.Session
	if err := h.db.Where("refresh_token = ?", refreshToken).First(&session).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "invalid refresh token"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "session lookup failed"},
		})
	}

	if session.ExpiresAt.Before(time.Now()) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "refresh token expired"},
		})
	}

	accessToken, err := auth.GenerateAccessToken(session.Email, h.cfg.Session.JWTSecret, h.cfg.Session.AccessTokenTTL.Duration)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "INTERNAL", "message": "failed to generate access token"},
		})
	}

	return c.JSON(fiber.Map{
		"access_token": accessToken,
		"expires_in":   int64(h.cfg.Session.AccessTokenTTL.Duration.Seconds()),
	})
}

func (h *AuthHandler) Logout(c fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")

	if refreshToken == "" {
		var req refreshRequest
		if err := c.Bind().JSON(&req); err == nil {
			refreshToken = req.RefreshToken
		}
	}

	if refreshToken != "" {
		var session models.Session
		if err := h.db.Where("refresh_token = ?", refreshToken).First(&session).Error; err == nil {
			h.manager.RemoveConnection(session.Email)
		}
		h.db.Where("refresh_token = ?", refreshToken).Delete(&models.Session{})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
		Path:     "/api/auth",
		MaxAge:   -1,
	})

	return c.JSON(fiber.Map{"ok": true})
}

func (h *AuthHandler) Me(c fiber.Ctx) error {
	email, _ := c.Locals("email").(string)

	return c.JSON(fiber.Map{
		"email": email,
	})
}

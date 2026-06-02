package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/gofiber/fiber/v3"
)

func TestAuthMiddleware_ValidToken(t *testing.T) {
	secret := "test-secret"
	token, err := auth.GenerateAccessToken("user@example.com", secret, 15*time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	app := fiber.New()
	app.Use(AuthRequired(secret))
	app.Get("/test", func(c fiber.Ctx) error {
		email := c.Locals("email").(string)
		return c.JSON(fiber.Map{"email": email})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
}

func TestAuthMiddleware_MissingToken(t *testing.T) {
	app := fiber.New()
	app.Use(AuthRequired("test-secret"))
	app.Get("/test", func(c fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}
}

func TestAuthMiddleware_InvalidToken(t *testing.T) {
	app := fiber.New()
	app.Use(AuthRequired("test-secret"))
	app.Get("/test", func(c fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}
}

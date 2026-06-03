package api

import (
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/middleware"
	"github.com/gofiber/fiber/v3"
)

func RegisterRoutes(app *fiber.App, cfg *config.Config, auth *AuthHandler) {
	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	api := app.Group("/api")

	authGroup := api.Group("/auth")
	authGroup.Post("/login", auth.Login)
	authGroup.Post("/refresh", auth.Refresh)
	authGroup.Post("/logout", auth.Logout)

	protected := api.Group("/", middleware.AuthRequired(cfg.Session.JWTSecret))
	protected.Get("/auth/me", auth.Me)
}

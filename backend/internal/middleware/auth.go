package middleware

import (
	"strings"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/gofiber/fiber/v3"
)

func AuthRequired(jwtSecret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "missing authorization header"},
			})
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "invalid authorization format"},
			})
		}

		claims, err := auth.ValidateToken(parts[1], jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "invalid or expired token"},
			})
		}

		c.Locals("email", claims.Email)
		return c.Next()
	}
}

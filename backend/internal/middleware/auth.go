package middleware

import (
	"strings"

	"github.com/arfiansyah/openvelope/internal/auth"
	"github.com/gofiber/fiber/v3"
)

func AuthRequired(jwtSecret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		// Extract token from Authorization header (preferred) or ?token= query param
		// (the latter is used for WebSocket connections, which cannot set custom headers).
		token := ""
		if header := c.Get("Authorization"); header != "" {
			parts := strings.SplitN(header, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			} else {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": fiber.Map{"code": "UNAUTHORIZED", "message": "invalid authorization format"},
				})
			}
		} else if q := c.Query("token"); q != "" {
			token = q
		}

		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "missing authorization"},
			})
		}

		claims, err := auth.ValidateToken(token, jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "invalid or expired token"},
			})
		}

		c.Locals("email", claims.Email)
		return c.Next()
	}
}

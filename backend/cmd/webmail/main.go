package main

import (
	"log"

	"github.com/gofiber/fiber/v3"

	// Project dependencies (used in upcoming modules)
	_ "gorm.io/gorm"
	_ "gorm.io/driver/postgres"
	_ "github.com/emersion/go-imap"
	_ "github.com/emersion/go-imap-idle"
	_ "github.com/emersion/go-smtp"
	_ "github.com/emersion/go-message"
	_ "github.com/golang-jwt/jwt/v5"
	_ "gopkg.in/yaml.v3"
	_ "github.com/google/uuid"
)

func main() {
	app := fiber.New(fiber.Config{
		AppName: "Webmail",
	})

	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	log.Fatal(app.Listen(":8080"))
}

package api

import (
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/middleware"
	"github.com/arfiansyah/webmail/internal/ws"
	"github.com/gofiber/contrib/v3/websocket"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

func RegisterRoutes(app *fiber.App, cfg *config.Config, db *gorm.DB, hub *ws.Hub, manager *imap.Manager, auth *AuthHandler, folders *FolderHandler, messages *MessageHandler, compose *ComposeHandler, search *SearchHandler, contacts *ContactsHandler, identities *IdentitiesHandler, idle *IdleHandler) {
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

	folderGroup := protected.Group("/folders")
	folderGroup.Get("/", folders.List)
	folderGroup.Post("/", folders.Create)
	folderGroup.Patch("/", folders.Rename)
	folderGroup.Delete("/:name", folders.Delete)

	msgGroup := protected.Group("/messages")
	msgGroup.Get("/", messages.List)
	msgGroup.Get("/:uid/headers", messages.GetHeaders)
	msgGroup.Get("/:uid", messages.Get)
	msgGroup.Post("/flags", messages.UpdateFlags)
	msgGroup.Delete("/:uid", messages.Delete)
	msgGroup.Post("/move", messages.Move)
	msgGroup.Post("/batch", messages.Batch)
	msgGroup.Get("/:uid/attachments", messages.ListAttachments)
	msgGroup.Get("/:uid/attachments/:partId", messages.DownloadAttachment)

	protected.Post("/send", compose.Send)
	protected.Post("/attachments/upload", compose.UploadAttachment)
	protected.Get("/search", search.Search)

	contactGroup := protected.Group("/contacts")
	contactGroup.Get("/", contacts.List)
	contactGroup.Get("/autocomplete", contacts.Autocomplete)
	contactGroup.Post("/", contacts.Create)
	contactGroup.Patch("/:id", contacts.Update)
	contactGroup.Delete("/:id", contacts.Delete)

	identityGroup := protected.Group("/identities")
	identityGroup.Get("/", identities.ListIdentities)
	identityGroup.Post("/", identities.CreateIdentity)
	identityGroup.Patch("/:id", identities.UpdateIdentity)
	identityGroup.Delete("/:id", identities.DeleteIdentity)

	sigGroup := protected.Group("/signatures")
	sigGroup.Get("/", identities.ListSignatures)
	sigGroup.Post("/", identities.CreateSignature)
	sigGroup.Patch("/:id", identities.UpdateSignature)
	sigGroup.Delete("/:id", identities.DeleteSignature)

	idleGroup := protected.Group("/idle")
	idleGroup.Post("/switch", idle.Switch)

	// WebSocket route (also auth-protected via middleware)
	app.Get("/ws", middleware.AuthRequired(cfg.Session.JWTSecret), wsUpgrade(), ws.HandleWebSocket(hub, manager, db, cfg))
}

func wsUpgrade() fiber.Handler {
	return func(c fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}
}

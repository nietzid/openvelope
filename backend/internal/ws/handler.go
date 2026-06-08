package ws

import (
	"log"

	"github.com/arfiansyah/openvelope/internal/auth"
	"github.com/arfiansyah/openvelope/internal/config"
	"github.com/arfiansyah/openvelope/internal/imap"
	"github.com/arfiansyah/openvelope/internal/models"
	"github.com/gofiber/contrib/v3/websocket"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

// HandleWebSocket returns a Fiber handler that upgrades to WebSocket and
// starts an IMAP IDLE watcher for the connected user. The IDLE watcher
// uses its own dedicated IMAP connection so it never blocks the main
// connection used by API operations.
func HandleWebSocket(hub *Hub, manager *imap.Manager, db *gorm.DB, cfg *config.Config) fiber.Handler {
	return func(c fiber.Ctx) error {
		email, ok := c.Locals("email").(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).SendString("unauthorized")
		}

		if !c.IsWebSocket() {
			return c.Status(fiber.StatusBadRequest).SendString("not a websocket upgrade")
		}

		// Look up the user's session to get the (encrypted) IMAP password
		// needed to authenticate the dedicated IDLE connection.
		var session models.Session
		if err := db.Where("email = ?", email).Order("created_at DESC").First(&session).Error; err != nil {
			log.Printf("ws: failed to load session for %s: %v", email, err)
			return c.Status(fiber.StatusUnauthorized).SendString("no active session")
		}
		password, err := auth.Decrypt(session.EncryptedCreds, cfg.Session.EncryptionKey)
		if err != nil {
			log.Printf("ws: failed to decrypt credentials for %s: %v", email, err)
			return c.Status(fiber.StatusInternalServerError).SendString("failed to load credentials")
		}

		return websocket.New(func(conn *websocket.Conn) {
			client := &Client{
				Email: email,
				Send:  make(chan []byte, 256),
			}

			hub.Register <- client

			// Start IMAP IDLE watcher for real-time mailbox updates
			if manager != nil {
				watcher := manager.StartIdle(email, password, "INBOX", func(event imap.IdleEvent) {
					data, err := event.JSON()
					if err != nil {
						log.Printf("idle event marshal: %v", err)
						return
					}
					select {
					case hub.Broadcast <- BroadcastMessage{Email: email, Data: data}:
					default:
					}
				})
				hub.SetWatcher(email, watcher)
			}

			defer func() {
				hub.RemoveWatcher(email)
				hub.Unregister <- client
				conn.Close()
			}()

			go func() {
				for msg := range client.Send {
					if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
						log.Printf("ws write error: %v", err)
						return
					}
				}
			}()

			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					// Close is expected when the client disconnects
					_ = err
					break
				}
			}
		})(c)
	}
}

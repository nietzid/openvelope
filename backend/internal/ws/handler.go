package ws

import (
	"log"

	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/gofiber/contrib/v3/websocket"
	"github.com/gofiber/fiber/v3"
)

// HandleWebSocket returns a Fiber handler that upgrades to WebSocket and
// starts an IMAP IDLE watcher for the connected user.
func HandleWebSocket(hub *Hub, manager *imap.Manager) fiber.Handler {
	return func(c fiber.Ctx) error {
		email, ok := c.Locals("email").(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).SendString("unauthorized")
		}

		if !c.IsWebSocket() {
			return c.Status(fiber.StatusBadRequest).SendString("not a websocket upgrade")
		}

		return websocket.New(func(conn *websocket.Conn) {
			client := &Client{
				Email: email,
				Send:  make(chan []byte, 256),
			}

			hub.Register <- client

			// Start IMAP IDLE watcher for real-time mailbox updates
			var watcher *imap.IdleWatcher
			if manager != nil {
				watcher = manager.StartIdle(email, func(event imap.IdleEvent) {
					data, err := event.JSON()
					if err != nil {
						log.Printf("idle event marshal: %v", err)
						return
					}
					hub.Broadcast <- BroadcastMessage{
						Email: email,
						Data:  data,
					}
				})
			}

			defer func() {
				if watcher != nil {
					watcher.Stop()
				}
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
					break
				}
			}
		})(c)
	}
}

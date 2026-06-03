package ws

import (
	"log"

	"github.com/gofiber/contrib/v3/websocket"
	"github.com/gofiber/fiber/v3"
)

func HandleWebSocket(hub *Hub) fiber.Handler {
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

			defer func() {
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

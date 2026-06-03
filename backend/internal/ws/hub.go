package ws

import (
	"encoding/json"
	"sync"
)

type Event struct {
	Type string      `json:"event"`
	Data interface{} `json:"data"`
}

func (e Event) JSON() ([]byte, error) {
	return json.Marshal(e)
}

type Client struct {
	Email string
	Send  chan []byte
}

type Hub struct {
	clients    map[string]map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan BroadcastMessage
	mu         sync.RWMutex
}

type BroadcastMessage struct {
	Email string
	Data  []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan BroadcastMessage),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if _, ok := h.clients[client.Email]; !ok {
				h.clients[client.Email] = make(map[*Client]bool)
			}
			h.clients[client.Email][client] = true
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.Email]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.Send)
				}
				if len(clients) == 0 {
					delete(h.clients, client.Email)
				}
			}
			h.mu.Unlock()

		case msg := <-h.Broadcast:
			h.mu.RLock()
			if clients, ok := h.clients[msg.Email]; ok {
				for client := range clients {
					select {
					case client.Send <- msg.Data:
					default:
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

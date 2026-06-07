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

// IdleWatcherHandle is an interface satisfied by imap.IdleWatcher so that the
// Hub can manage watcher lifecycle without importing the imap package directly.
type IdleWatcherHandle interface {
	Stop()
}

type Hub struct {
	clients    map[string]map[*Client]bool
	watchers   map[string]IdleWatcherHandle
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
		watchers:   make(map[string]IdleWatcherHandle),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan BroadcastMessage),
	}
}

// SetWatcher registers (or replaces) the active IDLE watcher for a user.
// If a previous watcher exists it is stopped before replacement.
func (h *Hub) SetWatcher(email string, w IdleWatcherHandle) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if prev, ok := h.watchers[email]; ok && prev != nil {
		prev.Stop()
	}
	h.watchers[email] = w
}

// RemoveWatcher stops and removes the active IDLE watcher for a user.
func (h *Hub) RemoveWatcher(email string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if w, ok := h.watchers[email]; ok && w != nil {
		w.Stop()
	}
	delete(h.watchers, email)
}

// HasWatcher returns true if the user has an active IDLE watcher registered.
func (h *Hub) HasWatcher(email string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.watchers[email]
	return ok
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

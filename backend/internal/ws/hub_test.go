package ws

import "testing"

func TestNewHub(t *testing.T) {
	hub := NewHub()
	if hub == nil {
		t.Fatal("NewHub() returned nil")
	}
}

func TestHubRegisterUnregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{
		Email: "user@example.com",
		Send:  make(chan []byte, 256),
	}

	hub.Register <- client
	hub.Unregister <- client
}

func TestEventJSON(t *testing.T) {
	event := Event{
		Type: "new_message",
		Data: map[string]interface{}{
			"folder":  "INBOX",
			"uid":     1234,
			"from":    "sender@example.com",
			"subject": "Hello",
		},
	}

	jsonBytes, err := event.JSON()
	if err != nil {
		t.Fatalf("Event.JSON() error: %v", err)
	}

	if len(jsonBytes) == 0 {
		t.Error("Event.JSON() returned empty")
	}
}

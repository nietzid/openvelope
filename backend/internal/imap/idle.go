package imap

import (
	"log"
	"sync"
	"time"

	"github.com/emersion/go-imap-idle"
)

// IdleEvent represents an event from the IDLE watcher.
type IdleEvent struct {
	Type string      `json:"event"`
	Data interface{} `json:"data"`
}

// IdleWatcher watches an IMAP mailbox for changes using the IDLE extension.
type IdleWatcher struct {
	manager     *Manager
	email       string
	done        chan struct{}
	stopped     bool
	mu          sync.Mutex
	onEvent     func(event IdleEvent)
	reconnDelay time.Duration
}

// NewIdleWatcher creates a new IDLE watcher for the given user.
func NewIdleWatcher(manager *Manager, email string, onEvent func(IdleEvent)) *IdleWatcher {
	return &IdleWatcher{
		manager: manager,
		email:   email,
		done:    make(chan struct{}),
		onEvent: onEvent,
	}
}

// Start begins the IDLE watching loop in a goroutine.
func (w *IdleWatcher) Start() {
	go w.run()
}

// Stop stops the IDLE watcher.
func (w *IdleWatcher) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.stopped {
		w.stopped = true
		close(w.done)
	}
}

func (w *IdleWatcher) run() {
	for {
		w.mu.Lock()
		if w.stopped {
			w.mu.Unlock()
			return
		}
		w.mu.Unlock()

		conn, err := w.manager.GetOrCreate(w.email, "")
		if err != nil {
			// No connection available — wait and retry with exponential backoff
			if w.reconnDelay == 0 {
				w.reconnDelay = time.Second
			}
			select {
			case <-w.done:
				return
			case <-time.After(w.reconnDelay):
			}
			w.reconnDelay = minDuration(w.reconnDelay*2, 30*time.Second)
			continue
		}

		// Reset backoff on successful connection
		w.reconnDelay = 0

		// Select INBOX
		conn.mu.Lock()
		_, err = conn.Client.Select("INBOX", false)
		conn.mu.Unlock()
		if err != nil {
			log.Printf("idle select INBOX failed for %s: %v", w.email, err)
			select {
			case <-w.done:
				return
			case <-time.After(5 * time.Second):
			}
			continue
		}

		// Set up updates channel for this connection
		updates := make(chan interface{})
		// Note: go-imap client.Updates is chan client.Update; we use interface{} for flexibility
		// The actual update handling will be done in the integration step

		// Start IDLE
		w.doIdle(conn, updates)
	}
}

func (w *IdleWatcher) doIdle(conn *UserConnection, updates chan interface{}) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	idleClient := idle.NewClient(conn.Client)

	// Create a done channel to stop IDLE
	idleDone := make(chan struct{})

	// Watch for watcher stop signal
	go func() {
		select {
		case <-w.done:
			close(idleDone)
		case <-updates:
			// Got an update from the server, notify the event handler
			if w.onEvent != nil {
				w.onEvent(IdleEvent{
					Type: "mailbox_update",
					Data: map[string]interface{}{
						"email": w.email,
					},
				})
			}
		}
	}()

	// IDLE blocks until server sends notification or done is closed
	_ = idleClient.Idle(idleDone)
}

// minDuration returns the smaller of two durations.
func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
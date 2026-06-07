package imap

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/emersion/go-imap-idle"
	"github.com/emersion/go-imap/client"
)

// IdleEvent represents an event from the IDLE watcher.
type IdleEvent struct {
	Type string      `json:"event"`
	Data interface{} `json:"data"`
}

// JSON serializes the event.
func (e IdleEvent) JSON() ([]byte, error) {
	return json.Marshal(e)
}

// IdleWatcher watches an IMAP mailbox for changes using the IDLE extension.
// It uses its own dedicated IMAP connection so it never blocks the main
// connection used by API operations (folder listing, message fetch, etc.).
type IdleWatcher struct {
	manager     *Manager
	email       string
	password    string
	folder      string
	done        chan struct{}
	stopped     bool
	mu          sync.Mutex
	onEvent     func(event IdleEvent)
	reconnDelay time.Duration
}

// NewIdleWatcher creates a new IDLE watcher for the given user on the
// specified folder. The password is required to authenticate the dedicated
// IDLE connection.
func NewIdleWatcher(manager *Manager, email, password, folder string, onEvent func(IdleEvent)) *IdleWatcher {
	return &IdleWatcher{
		manager:  manager,
		email:    email,
		password: password,
		folder:   folder,
		done:     make(chan struct{}),
		onEvent:  onEvent,
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

		// Open a dedicated IDLE connection (separate from the main connection
		// used by API handlers).
		c, err := w.dial()
		if err != nil {
			log.Printf("idle dial failed for %s: %v", w.email, err)
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

		// Select the target folder on the IDLE connection (read-only)
		if _, err := c.Select(w.folder, true); err != nil {
			log.Printf("idle select %s failed for %s: %v", w.folder, w.email, err)
			c.Logout()
			select {
			case <-w.done:
				return
			case <-time.After(5 * time.Second):
			}
			continue
		}

		// Run the IDLE loop. Blocks until the server sends an update or we stop.
		w.doIdle(c)
	}
}

// dial creates a new dedicated IMAP client connection for IDLE.
func (w *IdleWatcher) dial() (*client.Client, error) {
	addr := w.manager.config.Address()
	var c *client.Client
	var err error
	if w.manager.config.TLS {
		c, err = client.DialTLS(addr, &tls.Config{})
	} else {
		c, err = client.Dial(addr)
	}
	if err != nil {
		return nil, fmt.Errorf("dial: %w", err)
	}
	if err := c.Login(w.email, w.password); err != nil {
		c.Logout()
		return nil, fmt.Errorf("login: %w", err)
	}
	return c, nil
}

func (w *IdleWatcher) doIdle(c *client.Client) {
	idleClient := idle.NewClient(c)

	// done channel signals the idle goroutine to stop
	idleDone := make(chan struct{})

	// Goroutine: close idleDone when watcher is stopped so Idle() returns
	go func() {
		<-w.done
		close(idleDone)
	}()

	// IDLE blocks until server sends notification or idleDone is closed
	_ = idleClient.Idle(idleDone)

	// After IDLE returns (server update OR we stopped), emit a single
	// mailbox_update event so the client knows to refresh.
	if w.onEvent != nil {
		w.onEvent(IdleEvent{
			Type: "mailbox_update",
			Data: map[string]interface{}{
				"email":  w.email,
				"folder": w.folder,
			},
		})
	}

	// Close the IDLE connection — a fresh one will be opened in the next
	// iteration of run() if the watcher is still active.
	c.Logout()
}

// minDuration returns the smaller of two durations.
func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
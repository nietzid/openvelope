package imap

import (
	"crypto/tls"
	"fmt"
	"sync"
	"time"

	"github.com/emersion/go-imap/client"
)

type IMAPConfig struct {
	Host string
	Port int
	TLS  bool
}

func (c IMAPConfig) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

type UserConnection struct {
	Client     *client.Client
	Email      string
	LastActive time.Time
	mu         sync.Mutex
}

type Manager struct {
	config      IMAPConfig
	connections map[string]*UserConnection
	mu          sync.RWMutex
}

func NewManager(config IMAPConfig) *Manager {
	return &Manager{
		config:      config,
		connections: make(map[string]*UserConnection),
	}
}

func (m *Manager) GetOrCreate(email, password string) (*UserConnection, error) {
	m.mu.RLock()
	conn, exists := m.connections[email]
	m.mu.RUnlock()

	if exists {
		conn.LastActive = time.Now()
		return conn, nil
	}

	return m.createConnection(email, password)
}

func (m *Manager) createConnection(email, password string) (*UserConnection, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if conn, exists := m.connections[email]; exists {
		conn.LastActive = time.Now()
		return conn, nil
	}

	var c *client.Client
	var err error

	if m.config.TLS {
		c, err = client.DialTLS(m.config.Address(), &tls.Config{})
	} else {
		c, err = client.Dial(m.config.Address())
	}
	if err != nil {
		return nil, fmt.Errorf("connect to IMAP: %w", err)
	}

	if err := c.Login(email, password); err != nil {
		c.Logout()
		return nil, fmt.Errorf("IMAP login failed: %w", err)
	}

	conn := &UserConnection{
		Client:     c,
		Email:      email,
		LastActive: time.Now(),
	}

	m.connections[email] = conn
	return conn, nil
}

func (m *Manager) HasConnection(email string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, exists := m.connections[email]
	return exists
}

func (m *Manager) RemoveConnection(email string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if conn, exists := m.connections[email]; exists {
		conn.Client.Logout()
		delete(m.connections, email)
	}
}

func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for email, conn := range m.connections {
		conn.Client.Logout()
		delete(m.connections, email)
	}
}

// StartIdle starts an IMAP IDLE watcher for the given user on the specified
// folder using a dedicated connection. The password is required to
// authenticate that connection.
func (m *Manager) StartIdle(email, password, folder string, onEvent func(event IdleEvent)) *IdleWatcher {
	watcher := NewIdleWatcher(m, email, password, folder, onEvent)
	watcher.Start()
	return watcher
}

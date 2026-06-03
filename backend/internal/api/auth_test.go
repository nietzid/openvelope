package api

import (
	"testing"

	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
)

func newTestHandler() *AuthHandler {
	cfg := &config.Config{
		Session: config.SessionConfig{
			JWTSecret:       "test-secret-key-32-chars-long-1234",
			AccessTokenTTL:  config.Duration{},
			RefreshTokenTTL: config.Duration{},
			EncryptionKey:   "01234567890123456789012345678901",
		},
		Auth: config.AuthConfig{
			IMAP: config.IMAPConfig{Host: "localhost", Port: 143},
		},
	}
	cfg.Session.AccessTokenTTL.Duration = 900_000_000_000 // 15m
	cfg.Session.RefreshTokenTTL.Duration = 2_592_000_000_000_000 // 30d

	manager := imap.NewManager(imap.IMAPConfig{
		Host: cfg.Auth.IMAP.Host,
		Port: cfg.Auth.IMAP.Port,
		TLS:  cfg.Auth.IMAP.TLS,
	})

	return NewAuthHandler(nil, cfg, manager)
}

func TestNewAuthHandler(t *testing.T) {
	h := newTestHandler()
	if h == nil {
		t.Fatal("NewAuthHandler returned nil")
	}
}

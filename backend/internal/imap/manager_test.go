package imap

import "testing"

func TestNewManager(t *testing.T) {
	cfg := IMAPConfig{Host: "localhost", Port: 993, TLS: true}
	mgr := NewManager(cfg)
	if mgr == nil {
		t.Fatal("NewManager() returned nil")
	}
	if mgr.config.Host != "localhost" {
		t.Errorf("config.Host = %q, want %q", mgr.config.Host, "localhost")
	}
}

func TestManagerHasConnection_NotConnected(t *testing.T) {
	cfg := IMAPConfig{Host: "localhost", Port: 993, TLS: true}
	mgr := NewManager(cfg)
	if mgr.HasConnection("user@example.com") {
		t.Error("HasConnection() = true, want false for unknown user")
	}
}

func TestManagerRemoveConnection_NoPanic(t *testing.T) {
	cfg := IMAPConfig{Host: "localhost", Port: 993, TLS: true}
	mgr := NewManager(cfg)
	mgr.RemoveConnection("user@example.com")
	if mgr.HasConnection("user@example.com") {
		t.Error("HasConnection() = true after RemoveConnection()")
	}
}

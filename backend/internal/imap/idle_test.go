package imap

import "testing"

func TestNewIdleWatcher(t *testing.T) {
	manager := NewManager(IMAPConfig{Host: "localhost", Port: 993, TLS: true})
	watcher := NewIdleWatcher(manager, "test@example.com", "password", "INBOX", func(event IdleEvent) {})
	if watcher == nil {
		t.Fatal("NewIdleWatcher returned nil")
	}
	if watcher.email != "test@example.com" {
		t.Errorf("watcher.email = %q, want %q", watcher.email, "test@example.com")
	}
	if watcher.manager != manager {
		t.Error("watcher.manager does not match provided manager")
	}
	if watcher.password != "password" {
		t.Errorf("watcher.password = %q, want %q", watcher.password, "password")
	}
	if watcher.folder != "INBOX" {
		t.Errorf("watcher.folder = %q, want %q", watcher.folder, "INBOX")
	}
	watcher.Stop()
}

func TestIdleWatcherStop(t *testing.T) {
	manager := NewManager(IMAPConfig{Host: "localhost", Port: 993, TLS: true})
	watcher := NewIdleWatcher(manager, "test@example.com", "password", "INBOX", func(event IdleEvent) {})

	// Stop should not panic
	watcher.Stop()

	// Calling Stop again should not panic
	watcher.Stop()
}

func TestManagerStartIdle(t *testing.T) {
	manager := NewManager(IMAPConfig{Host: "localhost", Port: 993, TLS: true})
	watcher := manager.StartIdle("test@example.com", "password", "INBOX", func(event IdleEvent) {})
	if watcher == nil {
		t.Fatal("StartIdle returned nil")
	}
	watcher.Stop()
}
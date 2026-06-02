package auth

import "testing"

func TestIMAPAuthConfig(t *testing.T) {
	cfg := IMAPAuthConfig{
		Host: "imap.example.com",
		Port: 993,
		TLS:  true,
	}

	if cfg.Address() != "imap.example.com:993" {
		t.Errorf("Address() = %q, want %q", cfg.Address(), "imap.example.com:993")
	}
}

func TestIMAPAuthConfigAddress(t *testing.T) {
	tests := []struct {
		host string
		port int
		want string
	}{
		{"localhost", 993, "localhost:993"},
		{"imap.example.com", 143, "imap.example.com:143"},
	}

	for _, tt := range tests {
		cfg := IMAPAuthConfig{Host: tt.host, Port: tt.port}
		if got := cfg.Address(); got != tt.want {
			t.Errorf("Address() = %q, want %q", got, tt.want)
		}
	}
}

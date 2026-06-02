package config

import (
	"os"
	"testing"
	"time"
)

func TestLoadFromFile(t *testing.T) {
	content := `
server:
  host: "127.0.0.1"
  port: 9090
database:
  host: dbhost
  port: 5432
  user: testuser
  password: testpass
  dbname: testdb
  sslmode: disable
auth:
  imap:
    host: imaphost
    port: 993
    tls: true
  smtp:
    host: smtphost
    port: 587
    starttls: true
session:
  jwt_secret: "test-secret"
  access_token_ttl: "30m"
  refresh_token_ttl: "72h"
  encryption_key: "0123456789abcdef0123456789abcdef"
`
	tmpFile, err := os.CreateTemp("", "config-*.yaml")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatal(err)
	}
	tmpFile.Close()

	cfg, err := Load(tmpFile.Name())
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Server.Host != "127.0.0.1" {
		t.Errorf("Server.Host = %q, want %q", cfg.Server.Host, "127.0.0.1")
	}
	if cfg.Server.Port != 9090 {
		t.Errorf("Server.Port = %d, want %d", cfg.Server.Port, 9090)
	}
	if cfg.Database.Host != "dbhost" {
		t.Errorf("Database.Host = %q, want %q", cfg.Database.Host, "dbhost")
	}
	if cfg.Auth.IMAP.Host != "imaphost" {
		t.Errorf("Auth.IMAP.Host = %q, want %q", cfg.Auth.IMAP.Host, "imaphost")
	}
	if cfg.Auth.SMTP.Port != 587 {
		t.Errorf("Auth.SMTP.Port = %d, want %d", cfg.Auth.SMTP.Port, 587)
	}
	if cfg.Session.AccessTokenTTL.Duration != 30*time.Minute {
		t.Errorf("Session.AccessTokenTTL = %v, want %v", cfg.Session.AccessTokenTTL.Duration, 30*time.Minute)
	}
}

func TestLoadMissingFile(t *testing.T) {
	_, err := Load("/nonexistent/config.yaml")
	if err == nil {
		t.Error("Load() expected error for missing file")
	}
}

package config

import (
	"os"
	"strings"
	"testing"
	"time"
)

const testConfig = `
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
smtp_relay:
  enabled: false
  host: ""
  port: 587
  username: ""
  password: ""
  auth: "plain"
`

func TestLoadFromFile(t *testing.T) {
	clearConfigEnv(t)

	cfg, err := Load(writeTempConfig(t, testConfig))
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
	clearConfigEnv(t)

	_, err := Load("/nonexistent/config.yaml")
	if err == nil {
		t.Error("Load() expected error for missing file")
	}
}

func TestLoadAppliesEnvOverrides(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("WEBMAIL_SERVER_HOST", "0.0.0.0")
	t.Setenv("WEBMAIL_SERVER_PORT", "8081")
	t.Setenv("WEBMAIL_DATABASE_HOST", "env-db")
	t.Setenv("WEBMAIL_DATABASE_PORT", "6543")
	t.Setenv("WEBMAIL_DATABASE_USER", "env-user")
	t.Setenv("WEBMAIL_DATABASE_PASSWORD", "env-pass")
	t.Setenv("WEBMAIL_DATABASE_DBNAME", "env-name")
	t.Setenv("WEBMAIL_DATABASE_SSLMODE", "require")
	t.Setenv("WEBMAIL_IMAP_HOST", "env-imap")
	t.Setenv("WEBMAIL_IMAP_PORT", "1993")
	t.Setenv("WEBMAIL_IMAP_TLS", "false")
	t.Setenv("WEBMAIL_SMTP_HOST", "env-smtp")
	t.Setenv("WEBMAIL_SMTP_PORT", "1587")
	t.Setenv("WEBMAIL_SMTP_STARTTLS", "false")
	t.Setenv("WEBMAIL_SESSION_JWT_SECRET", "env-jwt")
	t.Setenv("WEBMAIL_SESSION_ACCESS_TOKEN_TTL", "45m")
	t.Setenv("WEBMAIL_SESSION_REFRESH_TOKEN_TTL", "240h")
	t.Setenv("WEBMAIL_SESSION_ENCRYPTION_KEY", "env-encryption-key-32-byte-value")
	t.Setenv("WEBMAIL_SMTP_RELAY_ENABLED", "true")
	t.Setenv("WEBMAIL_SMTP_RELAY_HOST", "relay-host")
	t.Setenv("WEBMAIL_SMTP_RELAY_PORT", "2525")
	t.Setenv("WEBMAIL_SMTP_RELAY_USER", "relay-user")
	t.Setenv("WEBMAIL_SMTP_RELAY_PASSWORD", "relay-pass")
	t.Setenv("WEBMAIL_SMTP_RELAY_AUTH", "login")

	cfg, err := Load(writeTempConfig(t, testConfig))
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Server.Host != "0.0.0.0" || cfg.Server.Port != 8081 {
		t.Fatalf("server override = %s:%d", cfg.Server.Host, cfg.Server.Port)
	}
	if cfg.Database.Host != "env-db" || cfg.Database.Port != 6543 || cfg.Database.User != "env-user" || cfg.Database.Password != "env-pass" || cfg.Database.DBName != "env-name" || cfg.Database.SSLMode != "require" {
		t.Fatalf("database override = %+v", cfg.Database)
	}
	if cfg.Auth.IMAP.Host != "env-imap" || cfg.Auth.IMAP.Port != 1993 || cfg.Auth.IMAP.TLS {
		t.Fatalf("imap override = %+v", cfg.Auth.IMAP)
	}
	if cfg.Auth.SMTP.Host != "env-smtp" || cfg.Auth.SMTP.Port != 1587 || cfg.Auth.SMTP.StartTLS {
		t.Fatalf("smtp override = %+v", cfg.Auth.SMTP)
	}
	if cfg.Session.JWTSecret != "env-jwt" || cfg.Session.AccessTokenTTL.Duration != 45*time.Minute || cfg.Session.RefreshTokenTTL.Duration != 240*time.Hour || cfg.Session.EncryptionKey != "env-encryption-key-32-byte-value" {
		t.Fatalf("session override = %+v", cfg.Session)
	}
	if !cfg.SMTPRelay.Enabled || cfg.SMTPRelay.Host != "relay-host" || cfg.SMTPRelay.Port != 2525 || cfg.SMTPRelay.Username != "relay-user" || cfg.SMTPRelay.Password != "relay-pass" || cfg.SMTPRelay.Auth != "login" {
		t.Fatalf("smtp relay override = %+v", cfg.SMTPRelay)
	}
}

func TestLoadAppliesDatabaseURLOverride(t *testing.T) {
	clearConfigEnv(t)

	databaseURL := "postgres://env-user:env-pass@env-db:5432/env-name?sslmode=require"
	t.Setenv("DATABASE_URL", databaseURL)

	cfg, err := Load(writeTempConfig(t, testConfig))
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Database.URL != databaseURL {
		t.Fatalf("Database.URL = %q, want %q", cfg.Database.URL, databaseURL)
	}
	if cfg.Database.DSN() != databaseURL {
		t.Fatalf("Database.DSN() = %q, want %q", cfg.Database.DSN(), databaseURL)
	}
}

func TestLoadRejectsInvalidEnvOverride(t *testing.T) {
	clearConfigEnv(t)

	t.Setenv("WEBMAIL_SERVER_PORT", "not-a-port")

	_, err := Load(writeTempConfig(t, testConfig))
	if err == nil {
		t.Fatal("Load() expected error for invalid env override")
	}
	if !strings.Contains(err.Error(), "WEBMAIL_SERVER_PORT") {
		t.Fatalf("Load() error = %v, want WEBMAIL_SERVER_PORT", err)
	}
}

func writeTempConfig(t *testing.T, content string) string {
	t.Helper()

	tmpFile, err := os.CreateTemp("", "config-*.yaml")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(tmpFile.Name()) })

	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatal(err)
	}
	if err := tmpFile.Close(); err != nil {
		t.Fatal(err)
	}

	return tmpFile.Name()
}

func clearConfigEnv(t *testing.T) {
	t.Helper()

	names := []string{
		"DATABASE_URL",
		"WEBMAIL_DATABASE_DBNAME",
		"WEBMAIL_DATABASE_HOST",
		"WEBMAIL_DATABASE_PASSWORD",
		"WEBMAIL_DATABASE_PORT",
		"WEBMAIL_DATABASE_SSLMODE",
		"WEBMAIL_DATABASE_URL",
		"WEBMAIL_DATABASE_USER",
		"WEBMAIL_IMAP_HOST",
		"WEBMAIL_IMAP_PORT",
		"WEBMAIL_IMAP_TLS",
		"WEBMAIL_SERVER_HOST",
		"WEBMAIL_SERVER_PORT",
		"WEBMAIL_SESSION_ACCESS_TOKEN_TTL",
		"WEBMAIL_SESSION_ENCRYPTION_KEY",
		"WEBMAIL_SESSION_JWT_SECRET",
		"WEBMAIL_SESSION_REFRESH_TOKEN_TTL",
		"WEBMAIL_SMTP_AUTH_RELAY_AUTH",
		"WEBMAIL_SMTP_AUTH_RELAY_FROM",
		"WEBMAIL_SMTP_AUTH_RELAY_PASSWORD",
		"WEBMAIL_SMTP_AUTH_RELAY_USERNAME",
		"WEBMAIL_SMTP_HOST",
		"WEBMAIL_SMTP_PORT",
		"WEBMAIL_SMTP_RELAY_AUTH",
		"WEBMAIL_SMTP_RELAY_ENABLED",
		"WEBMAIL_SMTP_RELAY_FROM",
		"WEBMAIL_SMTP_RELAY_HOST",
		"WEBMAIL_SMTP_RELAY_PASSWORD",
		"WEBMAIL_SMTP_RELAY_PORT",
		"WEBMAIL_SMTP_RELAY_USER",
		"WEBMAIL_SMTP_RELAY_USERNAME",
		"WEBMAIL_SMTP_STARTTLS",
	}

	original := make(map[string]string, len(names))
	present := make(map[string]bool, len(names))
	for _, name := range names {
		if value, ok := os.LookupEnv(name); ok {
			original[name] = value
			present[name] = true
		}
		if err := os.Unsetenv(name); err != nil {
			t.Fatal(err)
		}
	}

	t.Cleanup(func() {
		for _, name := range names {
			if present[name] {
				_ = os.Setenv(name, original[name])
			} else {
				_ = os.Unsetenv(name)
			}
		}
	})
}

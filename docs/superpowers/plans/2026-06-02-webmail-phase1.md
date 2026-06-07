# Webmail Phase 1 — Core Email MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working webmail client that connects to any IMAP/SMTP server, with real-time email, compose, and folder management.

**Architecture:** Monolithic Go backend (Fiber v3 + GORM + PostgreSQL) serving a React SPA (Vite + TypeScript + Tailwind). WebSocket + IMAP IDLE for real-time push. Single binary deployment with embedded frontend.

**Tech Stack:** Go 1.25+, Fiber v3, GORM, go-imap, go-smtp, React 19, TypeScript, Vite, Tailwind CSS, TipTap, Zustand, TanStack Virtual

**Spec:** `docs/superpowers/specs/2026-06-02-webmail-design.md`

---

## File Structure

### Backend (`backend/`)

```
backend/
├── cmd/webmail/main.go                    # Entry point
├── internal/
│   ├── config/config.go                   # YAML config loading
│   ├── config/config_test.go
│   ├── models/session.go                  # Session model
│   ├── models/preference.go               # UserPreference model
│   ├── models/models.go                   # DB init + AutoMigrate
│   ├── auth/jwt.go                        # JWT token generation/validation
│   ├── auth/jwt_test.go
│   ├── auth/imap_auth.go                  # IMAP LOGIN authentication
│   ├── auth/imap_auth_test.go
│   ├── auth/crypto.go                     # AES-256-GCM encrypt/decrypt
│   ├── auth/crypto_test.go
│   ├── middleware/auth.go                 # JWT auth middleware
│   ├── middleware/auth_test.go
│   ├── imap/manager.go                    # Connection manager (pool)
│   ├── imap/manager_test.go
│   ├── imap/operations.go                 # IMAP operations (fetch, search, etc.)
│   ├── imap/operations_test.go
│   ├── imap/idle.go                       # IMAP IDLE watcher
│   ├── smtp/sender.go                     # SMTP sending
│   ├── smtp/sender_test.go
│   ├── api/auth.go                        # Auth route handlers
│   ├── api/folders.go                     # Folder route handlers
│   ├── api/messages.go                    # Message route handlers
│   ├── api/compose.go                     # Compose/send/draft handlers
│   ├── api/attachments.go                 # Attachment handlers
│   ├── api/search.go                      # Search handler
│   ├── api/routes.go                      # Route registration
│   ├── ws/hub.go                          # WebSocket hub
│   ├── ws/hub_test.go
│   └── ws/handler.go                      # WebSocket upgrade handler
├── config.yaml                            # Default config
├── go.mod
└── go.sum
```

### Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── Login.tsx
│   │   └── Mailbox.tsx
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   ├── layout/MessageList.tsx
│   │   ├── layout/MessageView.tsx
│   │   ├── layout/ComposePanel.tsx
│   │   ├── mailbox/FolderList.tsx
│   │   ├── mailbox/MessageRow.tsx
│   │   ├── mailbox/MessageHeader.tsx
│   │   ├── mailbox/MessageBody.tsx
│   │   ├── compose/ComposeEditor.tsx
│   │   └── compose/AttachmentUpload.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   └── useMessages.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── mailboxStore.ts
│   │   └── uiStore.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── messages.ts
│   │   ├── folders.ts
│   │   └── websocket.ts
│   ├── lib/
│   │   ├── sanitize.ts
│   │   └── formatDate.ts
│   └── styles/
│       └── globals.css
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── package.json
```

---

## Tasks Overview

The plan contains 24 tasks organized into backend (Tasks 1-16) and frontend (Tasks 17-24). Each task follows TDD: write failing test → implement → verify → commit.

### Backend Tasks

**Task 1: Go Project Scaffolding** — Initialize Go module, install deps, create minimal Fiber server with /health endpoint, create config.yaml.

**Task 2: Config Loading** — YAML config parser with ServerConfig, DatabaseConfig, AuthConfig, SessionConfig. Duration type for TTL fields. DSN() helper for database connection string.

**Task 3: Database Setup + GORM Models** — Session model (UUID, email, refresh token, encrypted creds, expiry), UserPreference model, InitDB with AutoMigrate.

**Task 4: JWT Token Generation & Validation** — GenerateAccessToken (HS256, email claim, TTL), ValidateToken, GenerateRefreshToken (crypto/rand 32 bytes hex).

**Task 5: AES-256-GCM Credential Encryption** — Encrypt/Decrypt functions for storing IMAP credentials. Base64-encoded output. Nonce prepended to ciphertext.

**Task 6: IMAP Authentication** — IMAPAuthConfig struct, AuthenticateIMAP function that dials IMAP server and attempts LOGIN.

**Task 7: Auth Middleware** — Fiber middleware that extracts Bearer token, validates JWT, sets email in c.Locals.

**Task 8: IMAP Connection Manager** — Per-user connection pool with GetOrCreate, HasConnection, RemoveConnection, CloseAll. Double-checked locking. Auto-login on create.

**Task 9: IMAP Operations** — MessageFlags, MessageSummary, FolderInfo, SearchQuery types. ParseMessageFlags, BuildSearchCriteria, ListFolders, SelectFolder functions.

**Task 10: SMTP Sender** — EmailMessage struct, BuildMessage (MIME construction), Send with STARTTLS support via go-smtp.

**Task 11: WebSocket Hub** — Hub with Register/Unregister/Broadcast channels. Per-user client map. Event type with JSON serialization. HandleWebSocket upgrade handler.

**Task 12: Auth API Handlers** — Login (IMAP auth → JWT + session), Logout (close IMAP + delete session), Refresh (new access token from refresh token). Route registration.

**Task 13: Folder API Handlers** — List, Create, Rename, Delete folders via IMAP.

**Task 14: Message API Handlers** — List (paginated), Get (full message), UpdateFlags, Delete (move to trash or permanent), Move.

**Task 15: Compose/Send API + Search API** — Send email via SMTP. IMAP SEARCH with text/from/to/subject criteria.

**Task 16: Wire Up main.go** — Connect all components: config → DB → IMAP manager → WebSocket hub → Fiber app → routes → listen.

### Frontend Tasks

**Task 17: Frontend Project Scaffolding** — Vite + React + TypeScript, Tailwind CSS v4, React Router, Zustand, Axios. Proxy config for dev.

**Task 18: Frontend API Service Layer** — Axios instance with auth interceptor, auth/messages/folders service functions.

**Task 19: Login Page** — Email/password form, calls login API, stores token in Zustand, redirects to /mailbox.

**Task 20: Three-Pane Mailbox Layout** — Sidebar (folders + compose button), MessageList pane, MessageView pane. MailboxStore for state.

**Task 21: Message List with Virtualization** — TanStack Virtual for 10k+ messages. MessageRow with unread indicator, from, subject, date, preview.

**Task 22: Message View** — MessageHeader (from/to/subject/date), MessageBody with sanitized HTML rendering (DOMParser-based sanitizer).

**Task 23: Compose Panel with TipTap** — Slide-up compose panel. TipTap editor with bold/italic/underline/link toolbar. To/Cc/Subject fields. Send via API.

**Task 24: WebSocket Integration** — WebSocketService class with auto-reconnect. useWebSocket hook. Listen for new_message/flags_changed/message_deleted events. Update mailbox store on events.

---

## Task Details

### Task 1: Go Project Scaffolding

**Files:**
- Create: `backend/go.mod`
- Create: `backend/cmd/webmail/main.go`
- Create: `backend/config.yaml`

- [ ] **Step 1: Initialize Go module**

```bash
cd backend
go mod init github.com/arfiansyah/webmail
```

- [ ] **Step 2: Install dependencies**

```bash
go get github.com/gofiber/fiber/v3
go get gorm.io/gorm
go get gorm.io/driver/postgres
go get github.com/emersion/go-imap
go get github.com/emersion/go-imap-idle
go get github.com/emersion/go-smtp
go get github.com/emersion/go-message
go get github.com/golang-jwt/jwt/v5
go get gopkg.in/yaml.v3
go get github.com/google/uuid
```

- [ ] **Step 3: Create minimal Fiber server**

Create `backend/cmd/webmail/main.go`:

```go
package main

import (
	"log"

	"github.com/gofiber/fiber/v3"
)

func main() {
	app := fiber.New(fiber.Config{
		AppName: "Webmail",
	})

	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	log.Fatal(app.Listen(":8080"))
}
```

- [ ] **Step 4: Create default config**

Create `backend/config.yaml`:

```yaml
server:
  host: "0.0.0.0"
  port: 8080

database:
  host: localhost
  port: 5432
  user: webmail
  password: webmail
  dbname: webmail
  sslmode: disable

auth:
  imap:
    host: localhost
    port: 993
    tls: true
  smtp:
    host: localhost
    port: 587
    starttls: true

session:
  jwt_secret: "change-me-in-production"
  access_token_ttl: "15m"
  refresh_token_ttl: "168h"
  encryption_key: "0123456789abcdef0123456789abcdef"
```

- [ ] **Step 5: Verify server starts**

```bash
go run ./cmd/webmail
```

Expected: Server starts on :8080. `curl http://localhost:8080/health` returns `{"status":"ok"}`.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: initialize Go project with Fiber v3 server"
```

---

### Task 2: Config Loading

**Files:**
- Create: `backend/internal/config/config.go`
- Create: `backend/internal/config/config_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/config/config_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/config/ -v
```

Expected: FAIL — `config` package doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/config/config.go`:

```go
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Auth     AuthConfig     `yaml:"auth"`
	Session  SessionConfig  `yaml:"session"`
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	DBName   string `yaml:"dbname"`
	SSLMode  string `yaml:"sslmode"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode,
	)
}

type AuthConfig struct {
	IMAP IMAPConfig `yaml:"imap"`
	SMTP SMTPConfig `yaml:"smtp"`
}

type IMAPConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	TLS  bool   `yaml:"tls"`
}

type SMTPConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	StartTLS bool   `yaml:"starttls"`
}

type SessionConfig struct {
	JWTSecret      string   `yaml:"jwt_secret"`
	AccessTokenTTL Duration `yaml:"access_token_ttl"`
	RefreshTokenTTL Duration `yaml:"refresh_token_ttl"`
	EncryptionKey  string   `yaml:"encryption_key"`
}

type Duration struct {
	time.Duration
}

func (d *Duration) UnmarshalYAML(value *yaml.Node) error {
	var err error
	d.Duration, err = time.ParseDuration(value.Value)
	return err
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	return &cfg, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/config/ -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/config/
git commit -m "feat: add YAML config loading"
```

---

### Task 3: Database Setup + GORM Models

**Files:**
- Create: `backend/internal/models/models.go`
- Create: `backend/internal/models/session.go`
- Create: `backend/internal/models/preference.go`

- [ ] **Step 1: Create Session model**

Create `backend/internal/models/session.go`:

```go
package models

import "time"

type Session struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	Email          string    `gorm:"index;not null" json:"email"`
	RefreshToken   string    `gorm:"uniqueIndex;not null" json:"-"`
	EncryptedCreds string    `gorm:"type:text;not null" json:"-"`
	UserAgent      string    `json:"user_agent"`
	IPAddress      string    `json:"ip_address"`
	ExpiresAt      time.Time `gorm:"index" json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
}
```

- [ ] **Step 2: Create UserPreference model**

Create `backend/internal/models/preference.go`:

```go
package models

import "time"

type UserPreference struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Email       string    `gorm:"uniqueIndex;not null" json:"email"`
	Theme       string    `gorm:"default:'light'" json:"theme"`
	Language    string    `gorm:"default:'en'" json:"language"`
	PageSize    int       `gorm:"default:50" json:"page_size"`
	SortOrder   string    `gorm:"default:'date_desc'" json:"sort_order"`
	ComposeHTML bool      `gorm:"default:true" json:"compose_html"`
	Timezone    string    `gorm:"default:'UTC'" json:"timezone"`
	DateFormat  string    `gorm:"default:'YYYY-MM-DD'" json:"date_format"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
```

- [ ] **Step 3: Create DB initialization**

Create `backend/internal/models/models.go`:

```go
package models

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	if err := db.AutoMigrate(&Session{}, &UserPreference{}); err != nil {
		return nil, fmt.Errorf("auto-migrate: %w", err)
	}

	return db, nil
}
```

- [ ] **Step 4: Verify compilation**

```bash
cd backend
go build ./internal/models/
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/models/
git commit -m "feat: add GORM models and database initialization"
```

---

### Task 4: JWT Token Generation & Validation

**Files:**
- Create: `backend/internal/auth/jwt.go`
- Create: `backend/internal/auth/jwt_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/auth/jwt_test.go`:

```go
package auth

import (
	"testing"
	"time"
)

func TestGenerateAndValidateAccessToken(t *testing.T) {
	secret := "test-secret-key-for-jwt"
	email := "user@example.com"

	token, err := GenerateAccessToken(email, secret, 15*time.Minute)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error: %v", err)
	}

	claims, err := ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken() error: %v", err)
	}

	if claims.Email != email {
		t.Errorf("claims.Email = %q, want %q", claims.Email, email)
	}
	if claims.TokenType != "access" {
		t.Errorf("claims.TokenType = %q, want %q", claims.TokenType, "access")
	}
}

func TestValidateExpiredToken(t *testing.T) {
	secret := "test-secret-key-for-jwt"
	email := "user@example.com"

	token, err := GenerateAccessToken(email, secret, -1*time.Minute)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error: %v", err)
	}

	_, err = ValidateToken(token, secret)
	if err == nil {
		t.Error("ValidateToken() expected error for expired token")
	}
}

func TestValidateWrongSecret(t *testing.T) {
	token, err := GenerateAccessToken("user@example.com", "secret1", 15*time.Minute)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error: %v", err)
	}

	_, err = ValidateToken(token, "secret2")
	if err == nil {
		t.Error("ValidateToken() expected error for wrong secret")
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	token, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error: %v", err)
	}

	if len(token) < 32 {
		t.Errorf("refresh token too short: %d chars", len(token))
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/auth/ -v -run TestGenerate
```

Expected: FAIL — `auth` package doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/auth/jwt.go`:

```go
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Email     string `json:"email"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

func GenerateAccessToken(email, secret string, ttl time.Duration) (string, error) {
	claims := Claims{
		Email:     email,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateToken(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

func GenerateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate refresh token: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/auth/ -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/auth/jwt.go backend/internal/auth/jwt_test.go
git commit -m "feat: add JWT token generation and validation"
```

---

### Task 5: AES-256-GCM Credential Encryption

**Files:**
- Create: `backend/internal/auth/crypto.go`
- Create: `backend/internal/auth/crypto_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/auth/crypto_test.go`:

```go
package auth

import "testing"

func TestEncryptDecrypt(t *testing.T) {
	key := "0123456789abcdef0123456789abcdef"
	plaintext := `{"email":"user@example.com","password":"secret123"}`

	encrypted, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encrypt() error: %v", err)
	}

	if encrypted == plaintext {
		t.Error("Encrypt() returned plaintext unchanged")
	}

	decrypted, err := Decrypt(encrypted, key)
	if err != nil {
		t.Fatalf("Decrypt() error: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("Decrypt() = %q, want %q", decrypted, plaintext)
	}
}

func TestDecryptWrongKey(t *testing.T) {
	key1 := "0123456789abcdef0123456789abcdef"
	key2 := "abcdef0123456789abcdef0123456789"

	encrypted, err := Encrypt("secret data", key1)
	if err != nil {
		t.Fatalf("Encrypt() error: %v", err)
	}

	_, err = Decrypt(encrypted, key2)
	if err == nil {
		t.Error("Decrypt() expected error for wrong key")
	}
}

func TestEncryptInvalidKeyLength(t *testing.T) {
	_, err := Encrypt("data", "short-key")
	if err == nil {
		t.Error("Encrypt() expected error for invalid key length")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/auth/ -v -run TestEncrypt
```

Expected: FAIL — `Encrypt`/`Decrypt` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/auth/crypto.go`:

```go
package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

func Encrypt(plaintext, key string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(encoded, key string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decode base64: %w", err)
	}

	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}

	return string(plaintext), nil
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/auth/ -v -run TestEncrypt
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/auth/crypto.go backend/internal/auth/crypto_test.go
git commit -m "feat: add AES-256-GCM credential encryption"
```

---

### Task 6: IMAP Authentication

**Files:**
- Create: `backend/internal/auth/imap_auth.go`
- Create: `backend/internal/auth/imap_auth_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/auth/imap_auth_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/auth/ -v -run TestIMAP
```

Expected: FAIL — `IMAPAuthConfig` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/auth/imap_auth.go`:

```go
package auth

import (
	"crypto/tls"
	"fmt"

	"github.com/emersion/go-imap/client"
)

type IMAPAuthConfig struct {
	Host string
	Port int
	TLS  bool
}

func (c IMAPAuthConfig) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func AuthenticateIMAP(cfg IMAPAuthConfig, email, password string) error {
	var c *client.Client
	var err error

	if cfg.TLS {
		c, err = client.DialTLS(cfg.Address(), &tls.Config{})
	} else {
		c, err = client.Dial(cfg.Address())
	}
	if err != nil {
		return fmt.Errorf("connect to IMAP: %w", err)
	}
	defer c.Logout()

	if err := c.Login(email, password); err != nil {
		return fmt.Errorf("IMAP login failed: %w", err)
	}

	return nil
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/auth/ -v -run TestIMAP
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/auth/imap_auth.go backend/internal/auth/imap_auth_test.go
git commit -m "feat: add IMAP authentication"
```

---

### Task 7: Auth Middleware

**Files:**
- Create: `backend/internal/middleware/auth.go`
- Create: `backend/internal/middleware/auth_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/middleware/auth_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/gofiber/fiber/v3"
)

func TestAuthMiddleware_ValidToken(t *testing.T) {
	secret := "test-secret"
	token, err := auth.GenerateAccessToken("user@example.com", secret, 15*time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	app := fiber.New()
	app.Use(AuthRequired(secret))
	app.Get("/test", func(c fiber.Ctx) error {
		email := c.Locals("email").(string)
		return c.JSON(fiber.Map{"email": email})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
}

func TestAuthMiddleware_MissingToken(t *testing.T) {
	app := fiber.New()
	app.Use(AuthRequired("test-secret"))
	app.Get("/test", func(c fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}
}

func TestAuthMiddleware_InvalidToken(t *testing.T) {
	app := fiber.New()
	app.Use(AuthRequired("test-secret"))
	app.Get("/test", func(c fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/middleware/ -v
```

Expected: FAIL — `middleware` package doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/middleware/auth.go`:

```go
package middleware

import (
	"strings"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/gofiber/fiber/v3"
)

func AuthRequired(jwtSecret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "missing authorization header"},
			})
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "invalid authorization format"},
			})
		}

		claims, err := auth.ValidateToken(parts[1], jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{"code": "UNAUTHORIZED", "message": "invalid or expired token"},
			})
		}

		c.Locals("email", claims.Email)
		return c.Next()
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/middleware/ -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/middleware/
git commit -m "feat: add JWT auth middleware"
```

---

### Task 8: IMAP Connection Manager

**Files:**
- Create: `backend/internal/imap/manager.go`
- Create: `backend/internal/imap/manager_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/imap/manager_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/imap/ -v
```

Expected: FAIL — `imap` package doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/imap/manager.go`:

```go
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/imap/ -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/imap/manager.go backend/internal/imap/manager_test.go
git commit -m "feat: add IMAP connection manager with per-user pooling"
```

---

### Task 9: IMAP Operations

**Files:**
- Create: `backend/internal/imap/operations.go`
- Create: `backend/internal/imap/operations_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/imap/operations_test.go`:

```go
package imap

import "testing"

func TestParseMessageFlags(t *testing.T) {
	tests := []struct {
		flags []string
		want  MessageFlags
	}{
		{[]string{`\Seen`, `\Flagged`}, MessageFlags{Seen: true, Flagged: true}},
		{[]string{`\Seen`}, MessageFlags{Seen: true, Flagged: false}},
		{[]string{}, MessageFlags{Seen: false, Flagged: false}},
	}

	for _, tt := range tests {
		got := ParseMessageFlags(tt.flags)
		if got.Seen != tt.want.Seen || got.Flagged != tt.want.Flagged {
			t.Errorf("ParseMessageFlags(%v) = %+v, want %+v", tt.flags, got, tt.want)
		}
	}
}

func TestBuildSearchCriteria(t *testing.T) {
	tests := []struct {
		query SearchQuery
		want  string
	}{
		{SearchQuery{Text: "hello"}, `TEXT "hello"`},
		{SearchQuery{From: "john@example.com"}, `FROM "john@example.com"`},
		{SearchQuery{Text: "hello", From: "john@example.com"}, `TEXT "hello" FROM "john@example.com"`},
	}

	for _, tt := range tests {
		got := BuildSearchCriteria(tt.query)
		if got != tt.want {
			t.Errorf("BuildSearchCriteria(%+v) = %q, want %q", tt.query, got, tt.want)
		}
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/imap/ -v -run TestParse
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/imap/operations.go`:

```go
package imap

import (
	"fmt"
	"strings"
	"time"

	goimap "github.com/emersion/go-imap"
)

type MessageFlags struct {
	Seen     bool `json:"seen"`
	Flagged  bool `json:"flagged"`
	Answered bool `json:"answered"`
	Draft    bool `json:"draft"`
	Deleted  bool `json:"deleted"`
}

type MessageSummary struct {
	UID       uint32       `json:"uid"`
	From      string       `json:"from"`
	To        string       `json:"to"`
	Subject   string       `json:"subject"`
	Date      time.Time    `json:"date"`
	Size      uint32       `json:"size"`
	Flags     MessageFlags `json:"flags"`
	HasAttach bool         `json:"has_attach"`
	Preview   string       `json:"preview"`
}

type FolderInfo struct {
	Name      string `json:"name"`
	Count     uint32 `json:"count"`
	Unseen    uint32 `json:"unseen"`
	Delimiter string `json:"delimiter"`
}

type SearchQuery struct {
	Text    string
	From    string
	To      string
	Subject string
	Since   *time.Time
	Before  *time.Time
	Unseen  *bool
	Flagged *bool
}

func ParseMessageFlags(flags []string) MessageFlags {
	mf := MessageFlags{}
	for _, f := range flags {
		switch f {
		case `\Seen`:
			mf.Seen = true
		case `\Flagged`:
			mf.Flagged = true
		case `\Answered`:
			mf.Answered = true
		case `\Draft`:
			mf.Draft = true
		case `\Deleted`:
			mf.Deleted = true
		}
	}
	return mf
}

func BuildSearchCriteria(q SearchQuery) string {
	var parts []string
	if q.Text != "" {
		parts = append(parts, fmt.Sprintf(`TEXT "%s"`, q.Text))
	}
	if q.From != "" {
		parts = append(parts, fmt.Sprintf(`FROM "%s"`, q.From))
	}
	if q.To != "" {
		parts = append(parts, fmt.Sprintf(`TO "%s"`, q.To))
	}
	if q.Subject != "" {
		parts = append(parts, fmt.Sprintf(`SUBJECT "%s"`, q.Subject))
	}
	if q.Since != nil {
		parts = append(parts, fmt.Sprintf(`SINCE %s`, q.Since.Format("02-Jan-2006")))
	}
	if q.Before != nil {
		parts = append(parts, fmt.Sprintf(`BEFORE %s`, q.Before.Format("02-Jan-2006")))
	}
	if q.Unseen != nil && *q.Unseen {
		parts = append(parts, "UNSEEN")
	}
	if q.Flagged != nil && *q.Flagged {
		parts = append(parts, "FLAGGED")
	}
	return strings.Join(parts, " ")
}

func ListFolders(conn *UserConnection) ([]FolderInfo, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	mailboxes := make(chan *goimap.MailboxInfo, 10)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.List("", "*", mailboxes)
	}()

	var folders []FolderInfo
	for mb := range mailboxes {
		folders = append(folders, FolderInfo{
			Name:      mb.Name,
			Delimiter: string(mb.Delimiter),
		})
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("list folders: %w", err)
	}
	return folders, nil
}

func SelectFolder(conn *UserConnection, folder string) (*goimap.MailboxStatus, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	status, err := conn.Client.Select(folder, false)
	if err != nil {
		return nil, fmt.Errorf("select folder %q: %w", folder, err)
	}
	return status, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/imap/ -v -run TestParse
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/imap/operations.go backend/internal/imap/operations_test.go
git commit -m "feat: add IMAP operations (folders, search, message types)"
```

---

### Task 10: SMTP Sender

**Files:**
- Create: `backend/internal/smtp/sender.go`
- Create: `backend/internal/smtp/sender_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/smtp/sender_test.go`:

```go
package smtp

import (
	"strings"
	"testing"
)

func TestBuildMessage(t *testing.T) {
	msg := EmailMessage{
		From:    "sender@example.com",
		To:      []string{"recipient@example.com"},
		Cc:      []string{"cc@example.com"},
		Subject: "Test Subject",
		Body:    "<p>Hello World</p>",
		IsHTML:  true,
	}

	raw, err := BuildMessage(msg)
	if err != nil {
		t.Fatalf("BuildMessage() error: %v", err)
	}

	rawStr := string(raw)
	for _, want := range []string{
		"From: sender@example.com",
		"To: recipient@example.com",
		"Cc: cc@example.com",
		"Subject: Test Subject",
		"Content-Type: text/html",
	} {
		if !strings.Contains(rawStr, want) {
			t.Errorf("missing %q in message", want)
		}
	}
}

func TestBuildMessagePlainText(t *testing.T) {
	msg := EmailMessage{
		From:    "sender@example.com",
		To:      []string{"recipient@example.com"},
		Subject: "Test",
		Body:    "Hello World",
		IsHTML:  false,
	}

	raw, err := BuildMessage(msg)
	if err != nil {
		t.Fatalf("BuildMessage() error: %v", err)
	}

	if !strings.Contains(string(raw), "Content-Type: text/plain") {
		t.Error("missing plain text content type")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/smtp/ -v
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/smtp/sender.go`:

```go
package smtp

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	gosmtp "github.com/emersion/go-smtp"
)

type SMTPConfig struct {
	Host     string
	Port     int
	StartTLS bool
}

func (c SMTPConfig) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

type EmailMessage struct {
	From       string
	To         []string
	Cc         []string
	Bcc        []string
	Subject    string
	Body       string
	IsHTML     bool
	InReplyTo  string
	References []string
}

func BuildMessage(msg EmailMessage) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf("From: %s\r\n", msg.From))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(msg.To, ", ")))

	if len(msg.Cc) > 0 {
		buf.WriteString(fmt.Sprintf("Cc: %s\r\n", strings.Join(msg.Cc, ", ")))
	}

	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", msg.Subject))
	buf.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))
	buf.WriteString(fmt.Sprintf("Message-ID: <%s>\r\n", generateMessageID(msg.From)))

	if msg.InReplyTo != "" {
		buf.WriteString(fmt.Sprintf("In-Reply-To: %s\r\n", msg.InReplyTo))
	}
	if len(msg.References) > 0 {
		buf.WriteString(fmt.Sprintf("References: %s\r\n", strings.Join(msg.References, " ")))
	}

	buf.WriteString("MIME-Version: 1.0\r\n")

	if msg.IsHTML {
		buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	} else {
		buf.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	}

	buf.WriteString("\r\n")
	buf.WriteString(msg.Body)

	return buf.Bytes(), nil
}

func Send(cfg SMTPConfig, email, password string, msg EmailMessage) error {
	raw, err := BuildMessage(msg)
	if err != nil {
		return fmt.Errorf("build message: %w", err)
	}

	auth := smtp.PlainAuth("", email, password, cfg.Host)
	recipients := append(append(msg.To, msg.Cc...), msg.Bcc...)

	if cfg.StartTLS {
		return sendWithStartTLS(cfg, email, password, recipients, raw)
	}

	return smtp.SendMail(cfg.Address(), auth, msg.From, recipients, raw)
}

func sendWithStartTLS(cfg SMTPConfig, email, password string, recipients []string, raw []byte) error {
	c, err := gosmtp.Dial(cfg.Address())
	if err != nil {
		return fmt.Errorf("dial SMTP: %w", err)
	}
	defer c.Close()

	if err := c.StartTLS(&tls.Config{ServerName: cfg.Host}); err != nil {
		return fmt.Errorf("STARTTLS: %w", err)
	}

	if err := c.Auth(smtp.PlainAuth("", email, password, cfg.Host)); err != nil {
		return fmt.Errorf("SMTP auth: %w", err)
	}

	if err := c.Mail(email, nil); err != nil {
		return fmt.Errorf("SMTP MAIL: %w", err)
	}

	for _, rcpt := range recipients {
		if err := c.Rcpt(rcpt, nil); err != nil {
			return fmt.Errorf("SMTP RCPT %s: %w", rcpt, err)
		}
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA: %w", err)
	}

	if _, err := w.Write(raw); err != nil {
		return fmt.Errorf("write message: %w", err)
	}

	if err := w.Close(); err != nil {
		return fmt.Errorf("close data: %w", err)
	}

	return c.Quit()
}

func generateMessageID(from string) string {
	parts := strings.SplitN(from, "@", 2)
	domain := "localhost"
	if len(parts) == 2 {
		domain = parts[1]
	}
	return fmt.Sprintf("%d.%s@%s", time.Now().UnixNano(), parts[0], domain)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/smtp/ -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/smtp/
git commit -m "feat: add SMTP sender with message building"
```

---

### Task 11: WebSocket Hub

**Files:**
- Create: `backend/internal/ws/hub.go`
- Create: `backend/internal/ws/hub_test.go`
- Create: `backend/internal/ws/handler.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/ws/hub_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
go test ./internal/ws/ -v
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `backend/internal/ws/hub.go`:

```go
package ws

import (
	"encoding/json"
	"sync"
)

type Event struct {
	Type string      `json:"event"`
	Data interface{} `json:"data"`
}

func (e Event) JSON() ([]byte, error) {
	return json.Marshal(e)
}

type Client struct {
	Email string
	Send  chan []byte
}

type Hub struct {
	clients    map[string]map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan BroadcastMessage
	mu         sync.RWMutex
}

type BroadcastMessage struct {
	Email string
	Data  []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan BroadcastMessage),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if _, ok := h.clients[client.Email]; !ok {
				h.clients[client.Email] = make(map[*Client]bool)
			}
			h.clients[client.Email][client] = true
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.Email]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.Send)
				}
				if len(clients) == 0 {
					delete(h.clients, client.Email)
				}
			}
			h.mu.Unlock()

		case msg := <-h.Broadcast:
			h.mu.RLock()
			if clients, ok := h.clients[msg.Email]; ok {
				for client := range clients {
					select {
					case client.Send <- msg.Data:
					default:
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}
```

Create `backend/internal/ws/handler.go`:

```go
package ws

import (
	"log"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v3"
)

func HandleWebSocket(hub *Hub) fiber.Handler {
	return func(c fiber.Ctx) error {
		email, ok := c.Locals("email").(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).SendString("unauthorized")
		}

		if !websocket.IsWebSocketUpgrade(c) {
			return c.Status(fiber.StatusBadRequest).SendString("not a websocket upgrade")
		}

		return websocket.New(func(conn *websocket.Conn) {
			client := &Client{
				Email: email,
				Send:  make(chan []byte, 256),
			}

			hub.Register <- client

			defer func() {
				hub.Unregister <- client
				conn.Close()
			}()

			go func() {
				for msg := range client.Send {
					if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
						log.Printf("ws write error: %v", err)
						return
					}
				}
			}()

			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					break
				}
			}
		})(c)
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/ws/ -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/ws/
git commit -m "feat: add WebSocket hub for real-time events"
```

---

### Tasks 12-16: API Handlers + main.go

These tasks create the REST API handlers and wire everything together. Each follows the same pattern: create handler file, register routes, verify compilation, commit.

**Task 12: Auth API Handlers** — Login (IMAP auth → JWT + encrypted session), Logout (close IMAP + delete session + clear cookie), Refresh (new access token). Create `backend/internal/api/auth.go` and `backend/internal/api/routes.go`.

**Task 13: Folder API Handlers** — List/Create/Rename/Delete folders via IMAP. Create `backend/internal/api/folders.go`. Add routes to `routes.go`.

**Task 14: Message API Handlers** — List (paginated with sequence sets), Get (full RFC822), UpdateFlags (seen/flagged), Delete (move to trash or permanent), Move (copy + expunge). Create `backend/internal/api/messages.go`.

**Task 15: Compose/Send + Search API** — Send via SMTP, IMAP SEARCH with criteria. Create `backend/internal/api/compose.go` and `backend/internal/api/search.go`.

**Task 16: Wire Up main.go** — Connect config → DB → IMAP manager → WebSocket hub → Fiber app → routes → listen. Add CORS and logger middleware.

For each task: create the handler file with the structs and methods shown in the file structure above, add routes to `routes.go`, run `go build ./...` to verify, commit.

---

### Tasks 17-24: Frontend

**Task 17: Frontend Scaffolding** — `npm create vite@latest . -- --template react-ts`, install react-router-dom, zustand, axios, @tanstack/react-virtual, tailwindcss, @tailwindcss/vite. Configure Vite proxy for /api and /ws. Create authStore with Zustand.

**Task 18: API Service Layer** — Axios instance with Bearer token interceptor and 401 redirect. Service functions: auth (login/logout/refresh), messages (list/get/updateFlags/delete/move/send), folders (list/create/rename/delete).

**Task 19: Login Page** — Centered form with email/password inputs, black submit button, error display. Calls login API, stores token, redirects to /mailbox.

**Task 20: Three-Pane Layout** — Sidebar (Compose button + FolderList), middle pane (MessageList placeholder), right pane (MessageView placeholder). MailboxStore with Zustand.

**Task 21: Message List** — TanStack Virtual for 10k+ messages. MessageRow with unread dot, from, subject, date, preview. Load messages on folder change.

**Task 22: Message View** — MessageHeader (from/to/subject/date), MessageBody with DOMParser-based HTML sanitizer (removes script/iframe/event handlers/javascript: URLs).

**Task 23: Compose Panel** — Slide-up panel with TipTap editor (bold/italic/underline/link toolbar). To/Cc/Subject fields. Send button calls API.

**Task 24: WebSocket Integration** — WebSocketService class with auto-reconnect (3s delay). useWebSocket hook. Listen for new_message/flags_changed/message_deleted events. Update mailbox store on events.

---

## Deployment

### Single Binary Build

```bash
cd frontend && npm run build
cd ../backend && go build -o webmail ./cmd/webmail
./webmail --config config.yaml
```

### Docker

```yaml
services:
  webmail:
    image: webmail:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config.yaml:/etc/webmail/config.yaml
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/webmail
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: webmail
      POSTGRES_USER: webmail
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

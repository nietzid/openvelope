# Webmail Design Spec

**Date**: 2026-06-02
**Status**: Draft
**Author**: Arfiansyah

## Overview

A drop-in webmail replacement that works with iRedMail, Mail-in-a-Box, Modoboa, and any standard IMAP/SMTP mail server. Single Go binary with embedded React SPA. White and black minimalist design.

## Goals

- Replace Roundcube/SOGo as the web frontend for self-hosted mail servers
- Connect to existing IMAP/SMTP backends — no changes to the mail server itself
- Real-time email via WebSocket + IMAP IDLE
- Full Roundcube feature parity (phased delivery)
- Single binary deployment + Docker support

## Non-Goals

- Replacing the mail server (Postfix, Dovecot, etc.)
- Building a mail server or MTA
- Multi-tenant SaaS hosting (future consideration only)

---

## Architecture

### Approach: Monolithic Go + React SPA with WebSocket

Single Go binary serves a REST API, WebSocket endpoint, and embeds the React SPA build. WebSocket connections handle real-time notifications via IMAP IDLE.

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌───────────────────────────────────────────┐  │
│  │          React SPA (Vite build)           │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │  Inbox  │ │ Compose  │ │  Search   │  │  │
│  │  │  View   │ │  Editor  │ │  Engine   │  │  │
│  │  └─────────┘ └──────────┘ └───────────┘  │  │
│  └───────────────────────────────────────────┘  │
│         │ REST API          │ WebSocket          │
└─────────┼───────────────────┼───────────────────┘
          │                   │
┌─────────┼───────────────────┼───────────────────┐
│         ▼                   ▼                    │
│  ┌──────────────────────────────────────────┐   │
│  │           Go HTTP Server (Fiber v3)       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │ REST API │ │WebSocket │ │  Static   │ │   │
│  │  │ Handlers │ │  Hub     │ │  Files    │ │   │
│  │  └────┬─────┘ └────┬─────┘ └──────────┘ │   │
│  │       │             │                     │   │
│  │  ┌────▼─────────────▼──────────────────┐ │   │
│  │  │        Connection Manager            │ │   │
│  │  │  (per-user IMAP session pool)        │ │   │
│  │  └────┬─────────────┬──────────────────┘ │   │
│  └───────┼─────────────┼────────────────────┘   │
│          │             │                         │
│  ┌───────▼──┐  ┌──────▼──────┐  ┌───────────┐  │
│  │  IMAP    │  │   SMTP      │  │PostgreSQL │  │
│  │  Client  │  │   Client    │  │(GORM)     │  │
│  │(go-imap) │  │ (go-smtp)   │  │           │  │
│  └────┬─────┘  └──────┬──────┘  └───────────┘  │
└───────┼────────────────┼────────────────────────┘
        │                │
   ┌────▼────┐    ┌──────▼──────┐
   │ Dovecot │    │  Postfix    │
   │ (IMAP)  │    │  (SMTP)     │
   └─────────┘    └─────────────┘
```

### Tech Stack

| Layer | Choice | Package |
|-------|--------|---------|
| HTTP framework | Fiber v3 | `github.com/gofiber/fiber/v3` |
| ORM | GORM + PostgreSQL | `gorm.io/gorm` + `gorm.io/driver/postgres` |
| IMAP client | go-imap | `github.com/emersion/go-imap` |
| SMTP client | go-smtp | `github.com/emersion/go-smtp` |
| MIME parsing | go-message | `github.com/emersion/go-message` |
| WebSocket | Fiber WebSocket | `github.com/gofiber/fiber/v3` (built-in) |
| Frontend framework | React + TypeScript | via Vite |
| State management | Zustand | `zustand` |
| Styling | Tailwind CSS | `tailwindcss` |
| Rich text editor | TipTap | `@tiptap/react` |
| HTTP client | Axios | `axios` |
| Routing | React Router v7 | `react-router` |
| Virtualization | TanStack Virtual | `@tanstack/react-virtual` |

---

## Backend Structure

```
backend/
├── cmd/
│   └── webmail/
│       └── main.go              # Entry point, Fiber app setup
├── internal/
│   ├── config/                  # YAML/env config loading
│   ├── auth/                    # IMAP auth, LDAP, OAuth2 handlers
│   ├── api/                     # Fiber route handlers (REST endpoints)
│   │   ├── messages.go
│   │   ├── folders.go
│   │   ├── contacts.go
│   │   ├── identities.go
│   │   ├── filters.go
│   │   └── settings.go
│   ├── ws/                      # WebSocket hub + handlers
│   ├── imap/                    # IMAP connection manager + operations
│   ├── smtp/                    # SMTP sending
│   ├── models/                  # GORM models
│   ├── middleware/               # Auth middleware, CORS, rate limiting
│   └── cache/                   # In-memory + DB caching layer
├── migrations/                  # SQL migration files
├── config.yaml                  # Default config
└── go.mod
```

---

## Frontend Structure

```
frontend/
├── src/
│   ├── main.tsx                 # App entry point
│   ├── App.tsx                  # Root component + router
│   ├── routes/                  # Page-level components
│   │   ├── Login.tsx
│   │   ├── Mailbox.tsx          # Main 3-pane layout
│   │   ├── Compose.tsx
│   │   ├── Contacts.tsx
│   │   ├── Settings.tsx
│   │   └── Search.tsx
│   ├── components/
│   │   ├── layout/              # Sidebar, Header, Pane resizer
│   │   ├── mailbox/             # FolderList, MessageList, MessageView
│   │   ├── compose/             # Rich text editor, attachment upload
│   │   ├── contacts/            # Contact list, contact form
│   │   ├── settings/            # Identities, filters, signatures
│   │   └── shared/              # Button, Modal, Toast, Avatar, etc.
│   ├── hooks/                   # useMailbox, useMessages, useWebSocket, etc.
│   ├── stores/                  # Zustand stores
│   │   ├── authStore.ts
│   │   ├── mailboxStore.ts
│   │   ├── messageStore.ts
│   │   └── uiStore.ts
│   ├── services/                # API client layer
│   │   ├── api.ts               # Axios wrapper + interceptors
│   │   ├── messages.ts
│   │   ├── folders.ts
│   │   ├── contacts.ts
│   │   └── websocket.ts         # WebSocket connection manager
│   ├── lib/                     # Utilities
│   └── styles/                  # Global styles, CSS variables
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### UI Layout

Three-pane layout:

```
┌──────────┬──────────────────┬──────────────────────────┐
│          │                  │                          │
│ Folders  │  Message List    │    Message View          │
│          │                  │                          │
│ ▸ Inbox  │  ● John Doe      │  From: john@example.com  │
│   Sent   │    Meeting at 3  │  To: me@domain.com       │
│   Drafts │    2:30 PM       │  Date: Today 2:15 PM     │
│   Trash  │                  │                          │
│          │  ○ Newsletter    │  Hey, just wanted to     │
│ ──────── │    Weekly digest │  let you know that...    │
│  Labels  │    1:00 PM       │                          │
│  Work    │                  │                          │
│  Personal│  ○ GitHub        │                          │
│          │    PR merged     │                          │
│          │    11:30 AM      │                          │
│          │                  │                          │
└──────────┴──────────────────┴──────────────────────────┘
```

### Theme

White + black minimalist design via Tailwind:

- Background: `white` / `gray-50`
- Text: `gray-900` / `gray-600`
- Accents: `black` (buttons, active states, links)
- Borders: `gray-200`
- Minimal shadows, clean lines

---

## Authentication & Authorization

### Auth Methods

| Method | How it works | When used |
|--------|-------------|-----------|
| **IMAP LOGIN** | Connect to IMAP server with user's credentials. If connection succeeds, authenticated. | Default fallback, always available |
| **LDAP/AD** | Bind to LDAP with user's credentials, then use stored password for IMAP | When LDAP is configured (iRedMail Pro, enterprise setups) |
| **OAuth2/SSO** | Redirect to OAuth2 provider (Keycloak, etc.), get token, exchange for IMAP credentials | When SSO is configured |

### Login Flow

```
User submits email + password
    │
    ▼
Auth Strategy Router (config-driven)
    │
    ├── 1. Try OAuth2/SSO (if configured)
    ├── 2. Try LDAP/AD bind (if configured)
    └── 3. Fall back to IMAP LOGIN
    │
    ▼
On success:
    - Create session (JWT + refresh token)
    - Store IMAP credentials encrypted (AES-256-GCM) in session
    - Open persistent IMAP connection
    - Start IMAP IDLE for real-time push
```

### Session Management

- **JWT access token** (short-lived, 15 min) — sent in `Authorization: Bearer` header
- **Refresh token** (long-lived, 7 days) — stored in `httpOnly` cookie
- **Server-side session store** in PostgreSQL — tracks active sessions, allows forced logout
- **IMAP credentials** encrypted with AES-256-GCM using a server secret

### Authorization

- Each user can only access their own mailbox (enforced by IMAP)
- Admin endpoints require a separate admin role, configurable
- Rate limiting on login endpoint to prevent brute force

### Config Example

```yaml
auth:
  imap:
    host: localhost
    port: 993
    tls: true

  ldap:
    enabled: false
    url: ldap://localhost:389
    base_dn: "o=domains,dc=example,dc=com"
    bind_dn: "cn=vmail,dc=example,dc=com"
    bind_password: "secret"

  oauth2:
    enabled: false
    provider: keycloak
    client_id: webmail
    client_secret: secret
    auth_url: https://sso.example.com/auth
    token_url: https://sso.example.com/token

session:
  jwt_secret: "change-me-in-production"
  access_token_ttl: 15m
  refresh_token_ttl: 168h
  encryption_key: "32-byte-aes-key"
```

---

## REST API Design

**Base path**: `/api/v1`

Response envelope:

```json
{
  "data": { ... },
  "meta": { "page": 1, "per_page": 50, "total": 1234 }
}
```

Error response:

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Invalid credentials" }
}
```

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Login (IMAP/LDAP/OAuth2) |
| `POST` | `/api/v1/auth/logout` | Invalidate session |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `GET`  | `/api/v1/auth/oauth2/callback` | OAuth2 redirect handler |

### Folders

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/folders` | List all folders (synced from IMAP) |
| `POST` | `/api/v1/folders` | Create folder |
| `PATCH` | `/api/v1/folders/:name` | Rename folder |
| `DELETE` | `/api/v1/folders/:name` | Delete folder |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/folders/:folder/messages` | List messages (paginated) |
| `GET` | `/api/v1/messages/:uid` | Get full message (headers + body) |
| `PATCH` | `/api/v1/messages/:uid` | Update flags (read/unread/starred) |
| `DELETE` | `/api/v1/messages/:uid` | Move to trash (or delete if in trash) |
| `POST` | `/api/v1/messages/:uid/move` | Move message to another folder |
| `POST` | `/api/v1/messages/:uid/copy` | Copy message to another folder |
| `POST` | `/api/v1/messages/batch` | Batch operations (mark read, delete, move) |

### Compose / Send

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/messages/send` | Send message (SMTP) |
| `POST` | `/api/v1/drafts` | Save draft |
| `PATCH` | `/api/v1/drafts/:uid` | Update draft |
| `DELETE` | `/api/v1/drafts/:uid` | Delete draft |

### Attachments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/messages/:uid/attachments/:part` | Download attachment |
| `POST` | `/api/v1/attachments/upload` | Upload attachment (for compose) |

### Search

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/search` | Full-text search (`?q=keyword&folder=inbox&from=&to=&date_after=&date_before=`) |

### Contacts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/contacts` | List contacts (paginated) |
| `POST` | `/api/v1/contacts` | Create contact |
| `PATCH` | `/api/v1/contacts/:id` | Update contact |
| `DELETE` | `/api/v1/contacts/:id` | Delete contact |
| `GET` | `/api/v1/contacts/autocomplete` | Autocomplete (`?q=john`) |

### Identities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/identities` | List sender identities |
| `POST` | `/api/v1/identities` | Create identity |
| `PATCH` | `/api/v1/identities/:id` | Update identity |
| `DELETE` | `/api/v1/identities/:id` | Delete identity |

### Filters / Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/filters` | List mail filters |
| `POST` | `/api/v1/filters` | Create filter |
| `PATCH` | `/api/v1/filters/:id` | Update filter |
| `DELETE` | `/api/v1/filters/:id` | Delete filter |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/settings` | Get user preferences |
| `PATCH` | `/api/v1/settings` | Update preferences |

### Signatures

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/signatures` | List signatures |
| `POST` | `/api/v1/signatures` | Create signature |
| `PATCH` | `/api/v1/signatures/:id` | Update signature |
| `DELETE` | `/api/v1/signatures/:id` | Delete signature |

### WebSocket

| Path | Description |
|------|-------------|
| `ws://host/ws` | Real-time events (new mail, flag changes, deletions) |

WebSocket events:

```json
{ "event": "new_message", "data": { "folder": "INBOX", "uid": 1234, "from": "...", "subject": "..." } }
{ "event": "flags_changed", "data": { "folder": "INBOX", "uid": 1234, "flags": ["\\Seen"] } }
{ "event": "message_deleted", "data": { "folder": "INBOX", "uid": 1234 } }
```

---

## IMAP Connection Management

### Connection Lifecycle

```
User logs in
    │
    ▼
Connection Manager
    │
    ├── One persistent IMAP connection per user
    ├── IMAP IDLE on INBOX for real-time push
    ├── Auto-reconnect on connection drop
    ├── Idle timeout: close after 30min inactivity
    └── Health check goroutine pings every 5min
```

### IMAP IDLE Flow (Real-time)

1. User connects → open IMAP session → SELECT INBOX
2. Start IDLE command (IMAP server holds connection open)
3. When new mail arrives:
   - IMAP server sends EXISTS notification
   - Go backend fetches new message metadata (FETCH)
   - Push to all WebSocket clients for that user
   - Re-enter IDLE
4. On flag changes (read/unread from another client):
   - IMAP server sends FETCH notification
   - Push flag update via WebSocket
5. On message deletion from another client:
   - IMAP server sends EXPUNGE notification
   - Push deletion event via WebSocket

### Connection Pooling

| Scenario | Behavior |
|----------|----------|
| User active (browser open) | Keep IMAP connection alive + IDLE |
| User idle > 30 min | Close IMAP connection, reopen on next API request |
| User logs out | Close IMAP connection, remove from pool |
| IMAP server drops connection | Auto-reconnect with exponential backoff (1s → 2s → 4s → max 30s) |
| Server restart | All connections re-established on next user request |

### Concurrency

- Each user's IMAP operations are serialized through a per-user mutex (IMAP doesn't support concurrent commands on one connection)
- Read operations share the connection
- Write operations acquire exclusive lock briefly
- SMTP sending uses a separate connection (no contention with IMAP)

### Memory Budget

- ~50KB per IMAP connection (goroutine + buffers)
- 1,000 concurrent users ≈ 50MB

---

## Database Schema (GORM Models)

### UserPreference

```go
type UserPreference struct {
    ID            uint   `gorm:"primaryKey"`
    Email         string `gorm:"uniqueIndex;not null"`
    Theme         string `gorm:"default:'light'"`
    Language      string `gorm:"default:'en'"`
    PageSize      int    `gorm:"default:50"`
    SortOrder     string `gorm:"default:'date_desc'"`
    ComposeHTML   bool   `gorm:"default:true"`
    AutoRefresh   int    `gorm:"default:0"`
    Timezone      string `gorm:"default:'UTC'"`
    DateFormat    string `gorm:"default:'YYYY-MM-DD'"`
    CreatedAt     time.Time
    UpdatedAt     time.Time
}
```

### Identity

```go
type Identity struct {
    ID          uint   `gorm:"primaryKey"`
    Email       string `gorm:"index;not null"`
    Name        string `gorm:"not null"`
    FromEmail   string `gorm:"not null"`
    ReplyTo     string
    IsDefault   bool   `gorm:"default:false"`
    SignatureID *uint
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

### Signature

```go
type Signature struct {
    ID        uint   `gorm:"primaryKey"`
    Email     string `gorm:"index;not null"`
    Name      string `gorm:"not null"`
    Content   string `gorm:"type:text;not null"`
    IsDefault bool   `gorm:"default:false"`
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

### Contact

```go
type Contact struct {
    ID          uint   `gorm:"primaryKey"`
    Email       string `gorm:"index;not null"`
    DisplayName string `gorm:"not null"`
    FirstName   string
    LastName    string
    EmailAddr   string `gorm:"not null"`
    Phone       string
    Company     string
    Notes       string `gorm:"type:text"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

### Filter

```go
type Filter struct {
    ID          uint   `gorm:"primaryKey"`
    Email       string `gorm:"index;not null"`
    Name        string `gorm:"not null"`
    IsActive    bool   `gorm:"default:true"`
    Priority    int    `gorm:"default:0"`
    Conditions  string `gorm:"type:jsonb;not null"`
    Actions     string `gorm:"type:jsonb;not null"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

Conditions JSON example:
```json
[
  { "field": "from", "operator": "contains", "value": "github.com" },
  { "field": "subject", "operator": "starts_with", "value": "[PR]" }
]
```

Actions JSON example:
```json
[
  { "type": "move_to", "folder": "GitHub" },
  { "type": "mark_read" }
]
```

### CachedMessage

```go
type CachedMessage struct {
    ID          uint      `gorm:"primaryKey"`
    Email       string    `gorm:"index;not null"`
    Folder      string    `gorm:"index;not null"`
    UID         uint32    `gorm:"not null"`
    MessageID   string    `gorm:"index"`
    From        string
    To          string
    Subject     string
    Date        time.Time `gorm:"index"`
    Size        uint32
    Flags       string    `gorm:"type:jsonb"`
    HasAttach   bool
    Preview     string    `gorm:"type:text"`
    SearchVec   string    `gorm:"type:tsvector"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

### Session

```go
type Session struct {
    ID             string    `gorm:"primaryKey;type:uuid"`
    Email          string    `gorm:"index;not null"`
    RefreshToken   string    `gorm:"uniqueIndex;not null"`
    EncryptedCreds string    `gorm:"type:text;not null"`
    UserAgent      string
    IPAddress      string
    ExpiresAt      time.Time `gorm:"index"`
    CreatedAt      time.Time
}
```

### Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `cached_messages` | `(email, folder, date DESC)` | Fast paginated message listing |
| `cached_messages` | `(email, folder, uid)` | Unique message lookup |
| `cached_messages` | `search_vec` (GIN) | Full-text search |
| `contacts` | `(email, display_name)` | Autocomplete |
| `sessions` | `expires_at` | Cleanup expired sessions |

### Cache Invalidation

- `CachedMessage` is populated on first folder access (IMAP FETCH for metadata)
- WebSocket events update the cache in real-time
- On IMAP reconnect, do a `UID SEARCH` to detect missed changes and reconcile
- Cache is a performance optimization — IMAP is always the source of truth

---

## Phased Release Plan

### Phase 1 — Core Email (MVP)

**Backend:**
- Fiber v3 server setup + config loading (YAML)
- IMAP auth (login via IMAP LOGIN command)
- Session management (JWT + refresh tokens)
- IMAP connection manager (persistent connections, auto-reconnect)
- REST endpoints: folders, messages (list/read/flag/delete/move), compose/send (SMTP), drafts
- Attachment upload/download
- Basic search (IMAP SEARCH command)
- WebSocket hub + IMAP IDLE push (new mail, flag changes, expunges)
- PostgreSQL setup + GORM models for sessions, user preferences
- Embed React SPA build into Go binary

**Frontend:**
- Login page
- Three-pane layout (folders | message list | message view)
- Message list with virtualization, pagination, sort
- Message view with HTML rendering (sanitized)
- Compose panel (TipTap rich text editor, attachments)
- Reply / Forward (inline)
- Folder management (create, rename, delete)
- Flag operations (read/unread, star, delete/move)
- Batch operations (select multiple → mark read, delete, move)
- WebSocket integration (real-time new mail, flag sync)
- White + black minimalist theme (Tailwind)

**Deployment:**
- Single binary build (`go build` with embedded frontend)
- Docker image + `docker-compose.yml`
- `config.yaml` with sensible defaults for iRedMail

### Phase 2 — Contacts, Identities & Search

**Backend:**
- Contacts CRUD + autocomplete endpoint
- Identities CRUD (multiple From addresses)
- Signatures CRUD (HTML signatures via TipTap)
- PostgreSQL full-text search (`tsvector` on cached messages)
- Message cache layer (populate on folder access, reconcile via WebSocket)

**Frontend:**
- Contacts page (list, create, edit, delete)
- Contact autocomplete in compose (To/Cc/Bcc fields)
- Identities settings page
- Signatures editor (TipTap)
- Advanced search UI (from, to, date range, has attachment, folder filter)

### Phase 3 — Filters, Settings & LDAP/OAuth2

**Backend:**
- Filters/rules CRUD (conditions + actions stored as JSONB)
- Server-side filter execution on incoming mail (via IMAP IDLE trigger)
- LDAP authentication
- OAuth2/SSO authentication flow
- User settings CRUD (all preferences)

**Frontend:**
- Filters settings page (create rules with condition builder)
- Settings page (theme, language, page size, timezone, date format)
- OAuth2 login redirect flow
- LDAP login (transparent — same login form, backend routes to LDAP)

### Phase 4 — Polish & Production Hardening

- Dark mode toggle
- Keyboard shortcuts (j/k navigation, enter to open, r to reply, c to compose)
- Drag-and-drop messages between folders
- Desktop notifications (browser Notification API)
- Rate limiting + brute force protection on login
- Connection pool monitoring / admin dashboard
- i18n (internationalization)
- Mail-in-a-Box and Modoboa compatibility testing + config presets
- Performance optimization (message prefetching, optimistic UI updates)

---

## Deployment

### Single Binary

```bash
# Build
cd frontend && npm run build
cd ../backend && go build -o webmail ./cmd/webmail

# Run
./webmail --config config.yaml
```

### Docker

```yaml
# docker-compose.yml
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

### Compatibility

| Mail Server | IMAP Host | SMTP Host | Notes |
|-------------|-----------|-----------|-------|
| iRedMail | localhost:993 (TLS) | localhost:587 (STARTTLS) | Default config preset |
| Mail-in-a-Box | localhost:993 (TLS) | localhost:587 (STARTTLS) | Same as iRedMail |
| Modoboa | localhost:993 (TLS) | localhost:587 (STARTTLS) | Same as iRedMail |
| Custom | Configurable | Configurable | Set in config.yaml |

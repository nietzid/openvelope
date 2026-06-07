# Webmail Design Spec

**Date**: 2026-06-02
**Updated**: 2026-06-06
**Status**: Phase 1 Complete + Frontend Redesign Complete
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

| Layer | Choice | Package | Version |
|-------|--------|---------|---------|
| HTTP framework | Fiber v3 | `github.com/gofiber/fiber/v3` | 3.x |
| ORM | GORM + PostgreSQL | `gorm.io/gorm` + `gorm.io/driver/postgres` | 1.x |
| IMAP client | go-imap | `github.com/emersion/go-imap` | 1.x |
| SMTP client | go-smtp | `github.com/emersion/go-smtp` | 0.x |
| MIME parsing | go-message | `github.com/emersion/go-message` | 0.x |
| WebSocket | Fiber WebSocket | `github.com/gofiber/fiber/v3` (built-in) | — |
| Frontend framework | React 19 + TypeScript | via Vite 8 | 19.2 |
| Build tool | Vite | `vite` | 8.x |
| State management | Zustand 5 | `zustand` | 5.x |
| Styling | Tailwind CSS 4 | `tailwindcss` | 4.3 |
| Design tokens | CSS custom properties | `@theme` directive in Tailwind v4 | — |
| Rich text editor | TipTap 3 (lazy-loaded) | `@tiptap/react` | 3.x |
| HTTP client | Axios | `axios` | 1.x |
| Routing | React Router v7 | `react-router` | 7.x |
| Virtualization | TanStack Virtual | `@tanstack/react-virtual` | 3.x |
| MIME parsing (client) | PostalMime | `postal-mime` | — |
| Testing | Vitest + fast-check | `vitest`, `fast-check` | — |

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

> **Updated 2026-06-06**: Frontend was redesigned with a premium UI inspired by Linear/Superhuman/Arc Browser. See `.kiro/specs/frontend-redesign/` for full spec.

```
frontend/src/
├── main.tsx                          # Entry point (imports app/App.tsx)
├── app/
│   ├── App.tsx                       # BrowserRouter + React.lazy route splitting
│   └── routes/
│       ├── Login.tsx                 # Animated login (350ms ease-out-expo entrance)
│       └── Mailbox.tsx               # Three-panel layout assembly
├── components/
│   ├── primitives/                   # Design system atoms
│   │   ├── Button.tsx                # Press scale, focus ring, loading state
│   │   ├── Tooltip.tsx               # 500ms delay, warm-up, viewport-aware
│   │   ├── Dialog.tsx                # Focus trap, backdrop, animated
│   │   ├── Skeleton.tsx              # Pulse animation (opacity 0.4–0.7)
│   │   └── Badge.tsx                 # Unread count pill (99+ cap)
│   ├── layout/
│   │   ├── LayoutShell.tsx           # Responsive 3-panel (desktop/tablet/mobile)
│   │   ├── Sidebar.tsx               # Folders, compose, user section
│   │   ├── ResizeDivider.tsx         # Pointer-capture drag, clamped
│   │   └── ConnectionStatus.tsx      # WS status banner (ARIA live regions)
│   ├── mail/
│   │   ├── MessageList.tsx           # Virtualized (@tanstack/react-virtual)
│   │   ├── MessageRow.tsx            # Sender/subject/preview/unread dot
│   │   ├── MessageView.tsx           # Sanitized HTML, attachments, reply/fwd
│   │   ├── ComposeDialog.tsx         # Dialog + lazy TipTap, attachments
│   │   └── BatchToolbar.tsx          # Slide-in batch actions
│   └── search/
│       └── SearchInterface.tsx       # Cmd/Ctrl+K command palette
├── hooks/
│   ├── useWebSocket.ts              # Auth-driven WS lifecycle
│   ├── useMailboxUpdates.ts         # WS event → store mutations
│   ├── usePrefetch.ts               # 200ms hover prefetch + cache
│   └── useReducedMotion.ts          # prefers-reduced-motion hook
├── stores/
│   ├── authStore.ts                  # Preserved (persisted)
│   ├── mailboxStore.ts              # Preserved (folders, messages, selection)
│   ├── themeStore.ts                # NEW: light/dark/system with persist
│   └── uiStore.ts                   # NEW: panels, compose, search, WS status
├── services/                         # Preserved unchanged
│   ├── api.ts, auth.ts, compose.ts, folders.ts
│   ├── messages.ts, search.ts
│   └── websocket.ts                 # Enhanced with exponential backoff
├── lib/
│   ├── motion.ts                    # Stagger delay, easing/duration constants
│   ├── sanitize.ts                  # DOMParser-based HTML sanitizer
│   ├── format.ts                    # formatSize, formatBadgeCount
│   └── wsEventHandlers.ts           # WS event → store mutation logic
├── styles/
│   ├── tokens.css                   # CSS custom properties (light + dark)
│   └── index.css                    # @import tailwindcss + @theme mapping
├── types/
│   └── index.ts                     # Preserved
└── __tests__/properties/            # 19 fast-check property-based tests
```

### UI Layout

Three-pane layout with responsive breakpoints:

```
≥1024px: Full sidebar (240px) + resizable message list + message view
768–1024px: Icon rail (56px) + message list + message view
<768px: Single panel with horizontal slide transitions (300ms ease-out-expo)
```

```
┌──────────┬──────────────────┬──────────────────────────┐
│          │                  │                          │
│ Folders  │  Message List    │    Message View          │
│          │  (virtualized)   │                          │
│ ▸ Inbox  │  ● John Doe      │  From: john@example.com  │
│   Sent   │    Meeting at 3  │  To: me@domain.com       │
│   Drafts │    2:30 PM       │  Date: Today 2:15 PM     │
│   Trash  │                  │                          │
│          │  ○ Newsletter    │  Hey, just wanted to     │
│ ──────── │    Weekly digest │  let you know that...    │
│ Compose  │    1:00 PM       │                          │
│          │                  │  [Reply] [Forward]       │
│ user@... │  [Prev] [Next]   │  📎 attachment.pdf 1.2MB │
│ [Logout] │                  │                          │
└──────────┴──────────────────┴──────────────────────────┘
```

### Design System

> Premium UI inspired by Linear, Superhuman, Arc Browser. Emil Kowalski's design engineering philosophy.

**Theme Engine:**
- CSS custom properties in `tokens.css` (`:root` light + `[data-theme="dark"]`)
- Zustand store with persist middleware, supports light/dark/system modes
- Tailwind CSS v4 `@theme` integration — all tokens as utility classes
- 200ms smooth transition on theme switch

**Motion System:**
- CSS transitions only (no keyframes for interactive UI) — interruptible, GPU-composited
- Easing: ease-out-expo (`cubic-bezier(0.16, 1, 0.3, 1)`) for entrances, ease-in-quad for exits
- Asymmetric timing: 250–350ms entrances, 150–200ms exits
- Stagger animations: 30ms between items, capped at 10
- `prefers-reduced-motion` respected (0ms durations)

**Color Tokens (light/dark):**
- Background, surface, surface-elevated
- Text-primary, text-secondary
- Border, accent, accent-hover, error, success
- All pairs meet WCAG 4.5:1 contrast ratio

**Bundle Performance:**
- Initial bundle: 83KB gzipped (React + Router + Zustand framework)
- Route-level code splitting via React.lazy (Login: 1.4KB, Mailbox: 42KB)
- TipTap editor lazy-loaded only when compose opens (117KB separate chunk)
- Virtualized message list with 5-item overscan

**Accessibility (WCAG 2.1 AA):**
- ARIA landmarks on all regions
- Focus traps in Dialog and SearchInterface with return-focus-on-close
- Skip-to-main-content link
- 44×44px minimum touch targets
- Focus-visible indicators (2px ring, 2px offset, accent color)
- ARIA live regions for connection status changes

**Testing:**
- 375 tests (38 test files), all passing
- 19 property-based tests (fast-check, 100+ iterations each) covering correctness properties
- Unit tests for all stores, primitives, layout, and feature components

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

### Phase 1 — Core Email (MVP) ✅ COMPLETE

**Backend:** ✅
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

**Frontend:** ✅ (redesigned with premium UI)
- Login page with entrance animation, error shake, 30s timeout
- Responsive three-panel layout (desktop/tablet/mobile breakpoints)
- Design token system (CSS custom properties, light + dark themes)
- Theme engine (Zustand + persist, system/light/dark modes)
- Motion system (CSS transitions, stagger animations, reduced-motion support)
- Primitive components (Button, Tooltip, Dialog, Skeleton, Badge)
- Virtualized message list (@tanstack/react-virtual, overscan 5)
- Message view with sanitized HTML, attachments, reply/forward
- Compose dialog with lazy-loaded TipTap, attachment validation (25MB/file, 10 max)
- Search interface (Cmd/Ctrl+K command palette, debounced, 50 results max)
- Batch toolbar (mark read/unread, delete, move)
- Sidebar with folder navigation, stagger animations, compose button
- Resizable panel divider (pointer capture, 280px–50vw clamping)
- WebSocket with exponential backoff (3s×2^n, max 30s, 10 retries)
- Real-time event handlers (new_message, flags_changed, message_deleted)
- Connection status indicator (ARIA live regions)
- Route-level code splitting (83KB initial bundle gzipped)
- 200ms hover prefetch for message content
- Skip-to-main-content accessibility link
- ARIA landmarks, focus traps, focus-visible indicators
- 375 tests passing (19 property-based correctness tests)

**Deployment:** ✅
- Single binary build (`go build` with embedded frontend)
- Docker image + `docker-compose.yml`
- `config.yaml` with sensible defaults for iRedMail

---

### Phase 2 — Contacts, Identities & Search (NEXT)

**Backend:**
- Contacts CRUD + autocomplete endpoint
- Identities CRUD (multiple From addresses)
- Signatures CRUD (HTML signatures via TipTap)
- PostgreSQL full-text search (`tsvector` on cached messages)
- Message cache layer (populate on folder access, reconcile via WebSocket)

**Frontend Direction:**

> All new frontend features MUST follow the established design system patterns from Phase 1. No new CSS frameworks, component libraries, or state management tools.

- **Contacts page** — New route at `/contacts`, lazy-loaded via `React.lazy`. Reuse `Button`, `Dialog`, `Skeleton` primitives. Use the existing virtualization pattern for the contact list.
- **Contact autocomplete in compose** — Extend `ComposeDialog` with an autocomplete dropdown on To/Cc/Bcc fields. Debounce 300ms, use existing motion tokens for dropdown animation.
- **Identities settings page** — New route or dialog for managing sender identities. Reuse form patterns from Login/Compose.
- **Signatures editor** — Reuse lazy-loaded TipTap from ComposeDialog. Store signatures via API and display in compose.
- **Advanced search UI** — Extend `SearchInterface` with filter toggles (from, to, date range, has attachment, folder). Keep the command-palette overlay pattern.

**Conventions to follow:**
1. Put new page components in `src/app/routes/` and lazy-load them in `app/App.tsx`
2. Reusable components go in `src/components/` under the appropriate subdomain folder
3. All interactive elements need 44×44px touch targets, focus-visible rings, and ARIA labels
4. Animations use the motion tokens from `lib/motion.ts` — no hardcoded timing values
5. State goes in Zustand stores — no `useState` for shared/cross-component state
6. Services go in `src/services/` — all API calls go through the existing axios instance with interceptors
7. Write property-based tests (fast-check) for any new pure logic (validators, formatters, computed state)
8. Write unit tests for components using @testing-library/react
9. Run `npx vitest run` and `npx tsc --noEmit` before considering work complete

### Phase 3 — Filters, Settings & LDAP/OAuth2

**Backend:**
- Filters/rules CRUD (conditions + actions stored as JSONB)
- Server-side filter execution on incoming mail (via IMAP IDLE trigger)
- LDAP authentication
- OAuth2/SSO authentication flow
- User settings CRUD (all preferences)

**Frontend Direction:**
- **Filters page** — Condition builder UI. Reuse Dialog for the rule editor. Use stagger animations for the rule list.
- **Settings page** — Form-based settings using existing input patterns. Theme selector already works via `themeStore` — just expose it in the UI.
- **OAuth2 login** — Redirect flow; add a "Login with SSO" button variant to the Login route. Handle callback token exchange.
- **LDAP login** — Transparent to the frontend; same login form, backend routes to LDAP.

### Phase 4 — Polish & Production Hardening

> Many Phase 4 items were already delivered in the frontend redesign. Updated list below.

**Already done (moved from Phase 4 → Phase 1):**
- ~~Dark mode toggle~~ → Theme engine with light/dark/system
- ~~Performance optimization (message prefetching)~~ → 200ms hover prefetch
- ~~Optimistic UI updates~~ → Instant WS event store mutations

**Remaining:**
- Keyboard shortcuts (j/k navigation, enter to open, r to reply, c to compose)
- Drag-and-drop messages between folders
- Desktop notifications (browser Notification API)
- Rate limiting + brute force protection on login
- Connection pool monitoring / admin dashboard
- i18n (internationalization)
- Mail-in-a-Box and Modoboa compatibility testing + config presets
- Email threading / conversation view
- Offline support (service worker + IndexedDB cache)

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

---

## Frontend Development Guidelines

> These guidelines apply to all future frontend work. The design system was established in Phase 1's frontend redesign and must be followed consistently.

### Architecture Rules

1. **No new dependencies without justification.** The stack is locked: React 19, Vite 8, Tailwind CSS 4, Zustand 5, TipTap 3, @tanstack/react-virtual 3. Adding a component library (Radix, shadcn, Headless UI) is NOT allowed — we have our own primitives.

2. **Component hierarchy:**
   - `primitives/` — Atomic UI building blocks (Button, Dialog, Tooltip, Skeleton, Badge). Stateless where possible.
   - `layout/` — Structural components (LayoutShell, Sidebar, ResizeDivider, ConnectionStatus).
   - `mail/`, `search/`, `contacts/`, `settings/` — Feature-specific components. Can compose primitives.
   - `app/routes/` — Page-level route components. Lazy-loaded. Assemble feature components.

3. **State management:**
   - Global/shared state → Zustand stores in `src/stores/`
   - Component-local UI state → `useState` (toggle, form inputs, animation flags)
   - Server state → fetch in `useEffect`, store results in Zustand or local state
   - Never duplicate state between stores and components

4. **Services layer:**
   - All HTTP calls go through `services/api.ts` (axios instance with auth interceptor)
   - One service file per domain: `auth.ts`, `messages.ts`, `folders.ts`, `compose.ts`, `search.ts`
   - New APIs (contacts, identities, filters, settings) get new service files
   - WebSocket events handled in `lib/wsEventHandlers.ts`

### Styling Rules

1. **Use design tokens exclusively.** Never use hardcoded colors, spacing, or timing values. Reference `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, etc.

2. **Tailwind utilities preferred** for layout, spacing, typography. Use CSS custom properties via arbitrary value syntax (e.g., `bg-[var(--color-surface)]`) for token-based styling.

3. **Motion:** Use `lib/motion.ts` constants (`easing.outExpo`, `duration.normal`, `staggerDelay`). Never hardcode `cubic-bezier(...)` or `200ms` directly in components.

4. **Responsive:** Use Tailwind breakpoints (`md:`, `lg:`). Mobile-first approach. Below 768px = single-panel mode driven by `uiStore.activePanel`.

5. **Dark mode:** Handled automatically via CSS custom properties. No conditional class logic needed — tokens switch via `[data-theme="dark"]`.

### Accessibility Requirements

Every new component or feature MUST have:

1. Appropriate ARIA roles and labels
2. Keyboard navigation (Tab/Shift+Tab reachability)
3. Focus-visible indicators (`focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2`)
4. 44×44px minimum touch targets on interactive elements
5. ARIA live regions for dynamic content changes (errors, loading states, real-time updates)
6. Focus traps for modals/overlays with return-focus-on-close

### Testing Requirements

1. **Unit tests** for all new components (Vitest + @testing-library/react)
2. **Property-based tests** (fast-check) for any pure logic: validators, formatters, state transitions, algorithms
3. **All tests must pass** before merging: `npx vitest run` + `npx tsc --noEmit`
4. **Minimum 100 iterations** for property-based tests
5. Test files live next to the source file (`Component.test.tsx`) or in `__tests__/properties/` for cross-cutting property tests

### Adding a New Feature (Checklist)

```
1. [ ] Create service file in `src/services/` if new API endpoints needed
2. [ ] Create/extend Zustand store in `src/stores/` if shared state needed
3. [ ] Create components in appropriate `src/components/` subdirectory
4. [ ] Create route in `src/app/routes/` if it's a new page
5. [ ] Add React.lazy import in `src/app/App.tsx` for new routes
6. [ ] Use design tokens — no hardcoded values
7. [ ] Add ARIA roles, labels, focus management
8. [ ] Add entrance/exit animations using motion tokens
9. [ ] Write unit tests
10. [ ] Write property-based tests for pure logic
11. [ ] Run `npx vitest run` — all tests pass
12. [ ] Run `npx tsc --noEmit` — no type errors
13. [ ] Run `npx vite build` — verify no bundle regressions
```

### File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `MessageList.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `usePrefetch.ts`)
- Stores: `camelCase.ts` with `Store` suffix (e.g., `mailboxStore.ts`)
- Services: `camelCase.ts` (e.g., `messages.ts`)
- Utils/lib: `camelCase.ts` (e.g., `sanitize.ts`, `format.ts`)
- Tests: same name + `.test.ts(x)` suffix
- Property tests: `src/__tests__/properties/*.property.test.ts`

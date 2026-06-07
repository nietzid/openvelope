# Phase 2 Implementation Plan

**Date**: 2026-06-04
**Status**: Draft
**Prerequisite**: Phase 1 MVP complete (24 tasks)

---

## Overview

Phase 2 has two parts:
1. **Phase 1.5 — Missing MVP features** (Tasks 1-12): Reply/Forward, Attachments, IMAP IDLE, Batch operations, Pagination, Embed SPA, quick fixes
2. **Phase 2 — Contacts, Identities & Search** (Tasks 13-18): New domain features

---

## Part A: Phase 1.5 — Missing MVP Features

### Task 1: Quick Fixes

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/components/ComposePanel.tsx`
- Modify: `frontend/src/components/TipTapEditor.tsx`
- Modify: `frontend/vite.config.ts`

**Changes:**
1. Add `withCredentials: true` to axios instance (cookie-based refresh token)
2. Lazy-load TipTap components with `React.lazy` + `Suspense` to reduce bundle size
3. Add chunk size limit config to vite to suppress the 500 KB warning (or code-split properly)

**Verify:** `npm run build` — bundle size should drop or warning suppressed.

---

### Task 2: Reply / Forward — Backend

**Files:**
- Modify: `backend/internal/smtp/sender.go` — add `ReplyTo` header support
- Modify: `backend/internal/api/compose.go` — accept `in_reply_to` and `references` fields
- Modify: `backend/internal/api/routes.go` — add `GET /api/messages/:uid/headers` endpoint

**Changes:**
1. Add a `GetMessageHeaders` function to `backend/internal/imap/operations.go` that fetches the envelope (from, to, cc, subject, date, message-id, in-reply-to, references) without the full body
2. Add a `GET /api/messages/:uid/headers?folder=INBOX` endpoint that returns parsed headers
3. Ensure `sendEmail` in `compose.go` passes `InReplyTo` and `References` to the SMTP message builder
4. Update `BuildMessage` in `sender.go` to include `In-Reply-To` and `References` headers

**Verify:** `go test ./...` passes. Manual test: fetch headers for a message, verify `message_id`, `in_reply_to`, `references` are returned.

---

### Task 3: Reply / Forward — Frontend

**Files:**
- Modify: `frontend/src/components/ComposePanel.tsx`
- Modify: `frontend/src/components/MessageView.tsx`
- Modify: `frontend/src/types/index.ts`

**Changes:**
1. Add `replyTo` and `forwardFrom` props to ComposePanel
2. In MessageView, add Reply and Forward buttons in the header area
3. On Reply click: open ComposePanel pre-filled with:
   - To: sender's email
   - Subject: "Re: original subject"
   - Body: quoted original (blockquote with `> ` prefix or styled `<blockquote>`)
   - `in_reply_to`: original message-id
   - `references`: original references + message-id
4. On Forward click: open ComposePanel pre-filled with:
   - To: empty
   - Subject: "Fwd: original subject"
   - Body: forwarded message with "---------- Forwarded message ---------" header
5. Add `mode` field to ComposePanel state: `'new' | 'reply' | 'forward'`
6. Fetch headers via `GET /api/messages/:uid/headers` to get the message-id for threading

**Verify:** `npm run build` passes. Manual test: click Reply on a message, verify pre-filled fields.

---

### Task 4: Attachment Download — Backend

**Files:**
- Modify: `backend/internal/imap/operations.go`
- Modify: `backend/internal/api/messages.go`
- Modify: `backend/internal/api/routes.go`

**Changes:**
1. Add `GetMessagePart(conn, folder, uid, partID)` function to `operations.go`:
   - Fetch the specific MIME part using `goimap.FetchBodySection` with a `BodySectionName` parsed from the part ID
   - Return the raw bytes + content type + filename
2. Add `ListAttachments(conn, folder, uid)` function:
   - Fetch the message structure (`goimap.FetchBodyStructure`)
   - Walk the MIME tree, collect non-text parts (or text parts with Content-Disposition: attachment)
   - Return `[]AttachmentInfo{ PartID, Filename, ContentType, Size }`
3. Add `GET /api/messages/:uid/attachments?folder=INBOX` endpoint — list attachments
4. Add `GET /api/messages/:uid/attachments/:partId?folder=INBOX` endpoint — download attachment
5. Set `Content-Type` and `Content-Disposition` headers on download

**Verify:** `go test ./...` passes. Manual test: list attachments for a message with attachments, download one.

---

### Task 5: Attachment Upload — Backend

**Files:**
- Modify: `backend/internal/api/compose.go`
- Modify: `backend/internal/api/routes.go`
- Modify: `backend/internal/smtp/sender.go`

**Changes:**
1. Add `POST /api/attachments/upload` endpoint:
   - Accept `multipart/form-data` with file field
   - Store the file in a temp directory (or in-memory for simplicity)
   - Return `{ attachment_id, filename, size }`
2. Modify `sendEmail` to accept an `attachments` array in the request body:
   ```json
   { "to": [...], "subject": "...", "body": "...", "attachments": [{ "filename": "file.pdf", "content": "base64..." }] }
   ```
3. Update `BuildMessage` in `sender.go` to construct `multipart/mixed` MIME messages with attachments:
   - Use `mime/multipart` to build the message
   - Each attachment gets its own part with proper `Content-Type`, `Content-Disposition`, `Content-Transfer-Encoding`

**Verify:** `go test ./...` passes. Manual test: send an email with an attachment, verify it arrives.

---

### Task 6: Attachments — Frontend

**Files:**
- Modify: `frontend/src/components/ComposePanel.tsx`
- Modify: `frontend/src/components/MessageView.tsx`
- Modify: `frontend/src/services/messages.ts`
- Modify: `frontend/src/types/index.ts`

**Changes:**
1. Add `AttachmentInfo` type:
   ```ts
   export interface AttachmentInfo {
     part_id: string;
     filename: string;
     content_type: string;
     size: number;
   }
   ```
2. Add `listAttachments(folder, uid)` and `downloadAttachment(folder, uid, partId)` to `messages.ts`
3. In MessageView:
   - Call `listAttachments` when viewing a message
   - Show attachment list below the header (filename, size, download link)
   - On click, call `downloadAttachment` and trigger browser download via `Blob` + `URL.createObjectURL`
4. In ComposePanel:
   - Add file picker button ("Attach files")
   - Show attached files as chips with remove button
   - Convert files to base64 on send (or use FormData)

**Verify:** `npm run build` passes. Manual test: view a message with attachments, download one.

---

### Task 7: IMAP IDLE Watcher — Backend

**Files:**
- Modify: `backend/internal/imap/manager.go`
- Create: `backend/internal/imap/idle.go`
- Create: `backend/internal/imap/idle_test.go`

**Changes:**
1. Add `StartIdle(email string, onUpdate func(event ws.Event))` method to Manager:
   - Get the user's IMAP connection
   - SELECT INBOX
   - Start IDLE command using `go-imap-idle`
   - On notification: FETCH new message metadata, push event via callback
   - On error: reconnect with exponential backoff (1s → 2s → 4s → max 30s)
   - On user idle > 30 min: stop IDLE, close connection
2. Add `StopIdle(email string)` method
3. Wire IDLE watcher into the login flow:
   - After successful login, start IDLE for that user
   - On logout, stop IDLE
4. Event types to push:
   - `new_message`: `{ folder, uid, from, subject }`
   - `flags_changed`: `{ folder, uid, flags }`
   - `message_deleted`: `{ folder, uid }`

**Verify:** `go test ./...` passes. Manual test: log in, send yourself an email, verify WebSocket receives `new_message` event.

---

### Task 8: IMAP IDLE — Frontend Integration

**Files:**
- Modify: `frontend/src/hooks/useMailboxUpdates.ts`
- Modify: `frontend/src/hooks/useWebSocket.ts`

**Changes:**
1. Update `useMailboxUpdates` to handle the new event types:
   - `new_message`: prepend to message list (or refetch if on first page)
   - `flags_changed`: update flags in store
   - `message_deleted`: remove from store
2. Add desktop notification support:
   - On `new_message`, if the browser has notification permission, show a notification
   - Request permission on first login
3. Add sound/visual indicator for new mail (optional — subtle highlight on folder name)

**Verify:** `npm run build` passes. Manual test: send yourself an email, verify it appears in the list without refresh.

---

### Task 9: Batch Operations — Backend

**Files:**
- Modify: `backend/internal/api/messages.go`
- Modify: `backend/internal/api/routes.go`

**Changes:**
1. Add `POST /api/messages/batch` endpoint:
   ```json
   {
     "folder": "INBOX",
     "uids": [1, 2, 3],
     "action": "mark_read" | "mark_unread" | "flag" | "unflag" | "delete" | "move",
     "dest_folder": "Trash"  // only for "move" action
   }
   ```
2. Implement using existing `UpdateFlags`, `DeleteMessage`, `MoveMessage` functions

**Verify:** `go test ./...` passes.

---

### Task 10: Batch Operations — Frontend

**Files:**
- Modify: `frontend/src/components/MessageList.tsx`
- Modify: `frontend/src/services/messages.ts`
- Modify: `frontend/src/stores/mailboxStore.ts`

**Changes:**
1. Add checkbox to each message row in MessageList
2. Add `selectedUIDs: Set<number>` state to mailboxStore
3. Add toolbar at top of message list when messages are selected:
   - "Mark read" / "Mark unread" buttons
   - "Flag" / "Unflag" button
   - "Delete" button
   - "Move to..." dropdown
4. Add `batchOperation(folder, uids, action, destFolder?)` to `messages.ts`
5. On action: call batch API, then update local store

**Verify:** `npm run build` passes. Manual test: select 3 messages, mark them read.

---

### Task 11: Pagination & Sort — Frontend

**Files:**
- Modify: `frontend/src/components/MessageList.tsx`
- Modify: `frontend/src/stores/mailboxStore.ts`

**Changes:**
1. Add pagination controls at the bottom of the message list:
   - "Previous" / "Next" buttons
   - Page indicator ("Page 1 of 25")
2. Add sort dropdown (top of list):
   - Date (newest first) — default
   - Date (oldest first)
   - From (A-Z)
   - Subject (A-Z)
3. Update `listMessages` call to pass sort parameters
4. Add `sort` and `page` state to mailboxStore

**Verify:** `npm run build` passes. Manual test: change page, verify different messages load.

---

### Task 12: Embed SPA in Go Binary

**Files:**
- Create: `backend/internal/static/embed.go`
- Modify: `backend/cmd/webmail/main.go`

**Changes:**
1. Create `embed.go`:
   ```go
   package static

   import "embed"

   //go:embed all:../../frontend/dist
   var StaticFiles embed.FS
   ```
2. In `main.go`, serve the embedded files:
   - Use `fiber.New(fiber.Config{Static: ...})` or a custom handler
   - Serve `/` → `index.html` for all non-API routes (SPA fallback)
   - Serve static assets from the embedded filesystem
3. Update the build script to:
   ```bash
   cd frontend && npm run build
   cd ../backend && go build -o webmail ./cmd/webmail
   ```

**Verify:** Build the binary, run it, open `http://localhost:8080` — should serve the React app.

---

## Part B: Phase 2 — Contacts, Identities & Search

### Task 13: Contacts — Backend

**Files:**
- Modify: `backend/internal/models/models.go` — add Contact model
- Create: `backend/internal/api/contacts.go`
- Modify: `backend/internal/api/routes.go`

**Changes:**
1. Add Contact GORM model:
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
2. Add CRUD endpoints:
   - `GET /api/contacts` — list (paginated, search by name/email)
   - `POST /api/contacts` — create
   - `PATCH /api/contacts/:id` — update
   - `DELETE /api/contacts/:id` — delete
   - `GET /api/contacts/autocomplete?q=john` — autocomplete (top 10 matches)
3. Add AutoMigrate for Contact model

**Verify:** `go test ./...` passes. Manual test: create a contact, list contacts, autocomplete.

---

### Task 14: Contacts — Frontend

**Files:**
- Create: `frontend/src/pages/Contacts.tsx`
- Create: `frontend/src/services/contacts.ts`
- Modify: `frontend/src/App.tsx` — add route
- Modify: `frontend/src/components/Sidebar.tsx` — add "Contacts" nav link

**Changes:**
1. Add Contact types to `types/index.ts`
2. Add contacts service functions (list, create, update, delete, autocomplete)
3. Build Contacts page:
   - Table with columns: Name, Email, Phone, Company
   - Add/Edit modal with form fields
   - Delete confirmation
   - Search/filter bar
4. Add "Contacts" link in Sidebar
5. Add route `/contacts` in App.tsx

**Verify:** `npm run build` passes. Manual test: navigate to contacts, create a contact.

---

### Task 15: Identities & Signatures — Backend

**Files:**
- Modify: `backend/internal/models/models.go` — add Identity and Signature models
- Create: `backend/internal/api/identities.go`
- Modify: `backend/internal/api/routes.go`

**Changes:**
1. Add Identity model:
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
2. Add Signature model:
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
3. Add CRUD endpoints for both
4. Add AutoMigrate

**Verify:** `go test ./...` passes.

---

### Task 16: Identities & Signatures — Frontend

**Files:**
- Create: `frontend/src/pages/Settings.tsx`
- Create: `frontend/src/services/settings.ts`
- Modify: `frontend/src/App.tsx` — add route
- Modify: `frontend/src/components/Sidebar.tsx` — add "Settings" nav link

**Changes:**
1. Build Settings page with tabs:
   - Identities tab: list/add/edit/delete sender identities
   - Signatures tab: list/add/edit/delete signatures (TipTap editor for HTML content)
2. Wire compose panel to use selected identity (From dropdown)
3. Wire compose panel to append default signature

**Verify:** `npm run build` passes.

---

### Task 17: Message Cache — Backend

**Files:**
- Modify: `backend/internal/models/models.go` — add CachedMessage model
- Create: `backend/internal/cache/message_cache.go`

**Changes:**
1. Add CachedMessage model:
   ```go
   type CachedMessage struct {
     ID        uint      `gorm:"primaryKey"`
     Email     string    `gorm:"index;not null"`
     Folder    string    `gorm:"index;not null"`
     UID       uint32    `gorm:"not null"`
     MessageID string    `gorm:"index"`
     From      string
     To        string
     Subject   string
     Date      time.Time `gorm:"index"`
     Size      uint32
     Flags     string    `gorm:"type:jsonb"`
     HasAttach bool
     Preview   string    `gorm:"type:text"`
     CreatedAt time.Time
     UpdatedAt time.Time
   }
   ```
2. Add composite index: `(email, folder, date DESC)` and `(email, folder, uid)`
3. Add cache layer functions:
   - `SyncFolder(email, folder)` — fetch message metadata from IMAP, upsert into cache
   - `GetCachedMessages(email, folder, page, pageSize, sort)` — read from cache
   - `UpdateCacheOnEvent(email, event)` — update cache on IDLE events
4. Modify message list endpoint to use cache (fall back to IMAP if cache empty)
5. Trigger `SyncFolder` on first folder access

**Verify:** `go test ./...` passes. Manual test: log in, check that messages load faster on second visit.

---

### Task 18: Full-Text Search — Backend

**Files:**
- Modify: `backend/internal/cache/message_cache.go`
- Modify: `backend/internal/api/search.go`

**Changes:**
1. Add PostgreSQL full-text search:
   - Add `SearchVec` field (type `tsvector`) to CachedMessage
   - Populate on cache sync: `to_tsvector('english', subject || ' ' || from_addr || ' ' || preview)`
   - Add GIN index on `search_vec`
2. Update search endpoint to use PostgreSQL full-text search:
   - First: try `tsvector` search on cached messages
   - Fall back: IMAP SEARCH if cache is empty
3. Add search query parsing (AND, OR, exact phrase with quotes)

**Verify:** `go test ./...` passes. Manual test: search for a term, verify results come from cache.

---

## Task Count Summary

| Part | Tasks | Description |
|------|-------|-------------|
| Part A (Phase 1.5) | 12 | Missing MVP features + quick fixes |
| Part B (Phase 2) | 6 | Contacts, Identities, Signatures, Cache, Search |
| **Total** | **18** | |

## Recommended Execution Order

1. **Task 1** (Quick fixes) — 5 min, immediate quality-of-life improvement
2. **Tasks 2-3** (Reply/Forward) — high impact, makes app usable for real email
3. **Tasks 4-6** (Attachments) — high impact, common email operation
4. **Tasks 7-8** (IMAP IDLE) — high impact, real-time experience
5. **Tasks 9-10** (Batch ops) — medium impact, power user feature
6. **Task 11** (Pagination) — medium impact, large mailbox support
7. **Task 12** (Embed SPA) — deployment enabler
8. **Tasks 13-14** (Contacts) — Phase 2 domain feature
9. **Tasks 15-16** (Identities/Signatures) — Phase 2 domain feature
10. **Tasks 17-18** (Cache/Search) — Phase 2 performance + search quality

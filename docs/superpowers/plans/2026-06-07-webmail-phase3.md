# Phase 3 Implementation Plan

**Date**: 2026-06-07
**Status**: Draft
**Prerequisite**: Phase 1 (24 tasks) + Phase 2 (18 tasks) complete

---

## Overview

Phase 3 focuses on two areas:
1. **Phase 3A — Missing Frontend Integration** (Tasks 1-6): Folder management UI, desktop notifications, IDLE multi-folder, reply attribution, keyboard shortcuts, SMTP relay settings
2. **Phase 3B — UX Polish & Power Features** (Tasks 7-10): Undo operations, message threading, draft auto-save, contact groups

---

## Prerequisites

### Task 0: Install Sonner (Toast Library)

**Files:**
- Install: `sonner` (npm)
- Create: `frontend/src/components/ui/sonner.tsx`
- Modify: `frontend/src/app/App.tsx`

**Changes:**
1. Install `sonner`:
   ```bash
   cd frontend && npm install sonner
   ```
2. Create `frontend/src/components/ui/sonner.tsx`:
   ```tsx
   import { Toaster as Sonner } from "sonner"
   import type { ToasterProps } from "sonner"
   
   export function Toaster(props: ToasterProps) {
     return (
       <Sonner
         className="toaster group"
         toastOptions={{
           classNames: {
             toast: "group toast group-[.toaster]:bg-[var(--color-surface-elevated)] group-[.toaster]:text-[var(--color-text-primary)] group-[.toaster]:border-[var(--color-border)] group-[.toaster]:shadow-[var(--shadow-md)]",
             description: "group-[.toast]:text-[var(--color-text-secondary)]",
             actionButton: "group-[.toast]:bg-[var(--color-accent)] group-[.toast]:text-white",
             cancelButton: "group-[.toast]:bg-[var(--color-surface)] group-[.toast]:text-[var(--color-text-secondary)]",
           },
         }}
         {...props}
       />
     )
   }
   ```
3. In `App.tsx`, add `<Toaster />` at the root level (after `<BrowserRouter>`):
   ```tsx
   import { Toaster } from '../components/ui/sonner'
   // ...
   return (
     <BrowserRouter>
       {/* ... */}
       <Toaster />
     </BrowserRouter>
   )
   ```
4. Sonner uses the project's design tokens via CSS custom properties — no additional theme configuration needed

**Verify:** `npx tsc --noEmit` passes. Manual test: open app, verify Toaster renders without errors.

---

## Part A: Missing Frontend Integration

### Task 1: Folder Management UI — Sidebar Context Menu

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/services/messages.ts`
- Modify: `frontend/src/stores/mailboxStore.ts`

**Changes:**
1. Add right-click context menu on folder items in the Sidebar
2. Context menu options:
   - **Create folder** — opens a small inline form or modal
   - **Rename folder** — inline rename with input field
   - **Delete folder** — confirmation dialog
3. Add folder CRUD functions to `messages.ts`:
   - `createFolder(name: string): Promise<void>`
   - `renameFolder(oldName: string, newName: string): Promise<void>`
   - `deleteFolder(name: string): Promise<void>`
4. After folder operations, refresh the folder list from the store
5. Add keyboard shortcuts: `N` for new folder (when sidebar is focused)
6. Style the context menu with `var(--color-surface-elevated)` background, `var(--shadow-md)`, `var(--radius-md)` corners

**Verify:** `npx tsc --noEmit` passes. Manual test: right-click a folder, create/rename/delete.

---

### Task 2: Notifications (Browser + Sonner)

**Files:**
- Create: `frontend/src/hooks/useNotifications.ts`
- Modify: `frontend/src/lib/wsEventHandlers.ts`
- Modify: `frontend/src/app/App.tsx`

**Changes:**
1. Create `useNotifications` hook with two notification channels:
   - **Browser notifications** (when tab is in background):
     - Check `Notification.permission`, request on first interaction
     - On `new_message` event + `document.hidden`: show browser notification
     - Notification click: focus tab, navigate to message
   - **Sonner toasts** (when tab is in foreground):
     - On `new_message` event + tab visible: `toast.info('New message', { description: 'From: sender — Subject line' })`
     - Auto-dismiss after 4 seconds
2. In `wsEventHandlers.ts`, on `new_message` event:
   - If tab is hidden → browser notification (if permitted)
   - If tab is visible → Sonner toast
   - Don't notify if the message is in the currently selected folder
3. Add a toggle in Settings to enable/disable notifications (stored in localStorage)
4. Handle `graceful-degradation`: if browser notification permission is denied, silently skip (Sonner always works)

**Verify:** Manual test: send yourself an email while tab is in background → browser notification. While tab is in foreground → Sonner toast.

---

### Task 3: IDLE on Selected Folder

**Files:**
- Modify: `backend/internal/imap/idle.go`
- Modify: `backend/internal/api/routes.go`

**Changes:**
1. Refactor `idle.go` to accept a folder parameter instead of hardcoding INBOX
2. Add `POST /api/idle/start` endpoint:
   ```json
   { "folder": "INBOX" }
   ```
3. Add `POST /api/idle/stop` endpoint
4. Track active IDLE connections per user in the connection manager
5. On folder switch in frontend, stop IDLE on old folder, start on new
6. Add `GetActiveIdleFolders(email string) []string` to manager

**Verify:** `go test ./...` passes. Manual test: switch to Sent folder, send an email to yourself, verify new message notification.

---

### Task 4: Reply Attribution Headers

**Files:**
- Modify: `frontend/src/components/mail/ComposeDialog.tsx`
- Modify: `frontend/src/services/messages.ts`

**Changes:**
1. Update `handleReply` in `ComposeDialog.tsx`:
   - Fetch original message headers (From, Date) via `GET /api/messages/:uid/headers`
   - Format attribution: `On [date], [sender] wrote:`
   - Wrap original body in `<blockquote>` with proper styling
2. Update `handleForward`:
   - Format forwarded message with `---------- Forwarded message ---------` header
   - Include: From, Date, Subject, To fields from original
3. Style blockquote: left border, muted color, slightly indented
4. Ensure quoted content is not editable (contenteditable=false or separate section)

**Verify:** Manual test: click Reply on a message, verify attribution header appears above quoted content.

---

### Task 5: Keyboard Shortcuts

**Files:**
- Create: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/components/mail/MessageList.tsx`
- Modify: `frontend/src/components/mail/MessageView.tsx`

**Changes:**
1. Create `useKeyboardShortcuts` hook that registers global shortcuts:
   - `J` / `K` — Next / Previous message in list
   - `Enter` — Open selected message
   - `R` — Reply to current message
   - `F` — Forward current message
   - `A` — Reply all
   - `E` / `Y` — Archive (move to Archive)
   - `#` — Delete
   - `S` — Star/Flag toggle
   - `U` — Toggle read/unread
   - `/` — Focus search bar
   - `?` — Show keyboard shortcuts help modal
2. Don't fire shortcuts when user is typing in an input/textarea/contenteditable
3. Add keyboard shortcuts help modal (`?` key):
   - List all shortcuts in a simple grid
   - Modal uses `var(--color-surface-elevated)` background
4. Store current message index in `mailboxStore` for J/K navigation
5. Update `MessageList` to highlight the "focused" message (separate from selected)

**Verify:** `npx tsc --noEmit` passes. Manual test: press `?` to see shortcuts, use `J`/`K` to navigate.

---

### Task 6: SMTP Relay Configuration

**Files:**
- Modify: `backend/internal/config/config.go`
- Modify: `backend/internal/smtp/sender.go`
- Create: `frontend/src/components/settings/SmtpSettings.tsx`
- Modify: `frontend/src/app/routes/Settings.tsx`

**Changes:**
1. Backend: Add SMTP relay config fields:
   ```go
   type SMTPRelayConfig struct {
       Host     string
       Port     int
       Username string
       Password string
       From     string
       Auth     string // "plain", "login", "oauth2"
   }
   ```
2. Modify `sender.go` to use relay config when available (fall back to IMAP credentials)
3. Add `GET /api/settings/smtp` and `PUT /api/settings/smtp` endpoints
4. Frontend: Add SMTP settings tab in Settings page:
   - Host, Port, Username, Password fields
   - Auth method dropdown (Plain, Login, OAuth2)
   - Test connection button
   - Save button
5. Store SMTP settings in PostgreSQL (not just env vars)

**Verify:** `go test ./...` passes. Manual test: configure SMTP relay, send test email.

---

## Part B: UX Polish & Power Features

### Task 7: Undo Operations (Sonner Toasts)

**Files:**
- Create: `frontend/src/hooks/useUndo.ts`
- Modify: `frontend/src/lib/wsEventHandlers.ts`
- Modify: `frontend/src/components/mail/MessageRow.tsx`

**Changes:**
1. Install `sonner` (if not already installed in Task 0):
   ```bash
   cd frontend && npm install sonner
   ```
2. Create `useUndo` hook that uses Sonner's `toast()` API:
   ```tsx
   import { toast } from 'sonner'
   
   function showUndoToast(message: string, onUndo: () => void) {
     toast(message, {
       action: {
         label: 'Undo',
         onClick: onUndo,
       },
       duration: 5000,
     })
   }
   ```
3. Wire into message actions:
   - On delete: `showUndoToast('Message deleted', () => restoreMessage(uid))`
   - On move: `showUndoToast('Moved to Archive', () => moveBack(uid, originalFolder))`
   - On mark read/unread: `showUndoToast('Marked as read', () => toggleRead(uid))`
4. Wire into batch operations:
   - `showUndoToast(`${count} messages deleted`, () => batchRestore(uids))`
5. On undo: call the reverse action (e.g., `restoreMessage` API call)
6. Toast auto-dismisses after 5 seconds (Sonner default)
7. Multiple toasts stack automatically (Sonner behavior)

**Verify:** Manual test: delete a message, verify Sonner toast appears with "Undo" button, click Undo, verify message is restored.

---

### Task 8: Draft Auto-Save

**Files:**
- Modify: `frontend/src/components/mail/ComposeDialog.tsx`
- Create: `frontend/src/hooks/useDraftAutoSave.ts`
- Modify: `frontend/src/stores/uiStore.ts`

**Changes:**
1. Create `useDraftAutoSave` hook:
   - Debounce 2 seconds after last edit
   - Save to localStorage with key `draft-{mode}-{timestamp}`
   - On open compose, check for existing draft and offer to restore
2. In ComposeDialog:
   - On mount, check for saved drafts
   - Show "Restore draft?" banner if found
   - On send/close, clear saved draft
   - On typing, trigger auto-save
3. Draft includes: To, Subject, Body, Attachments (as metadata)
4. Add "Drafts" section to Settings or Sidebar (optional — could be just localStorage)

**Verify:** Manual test: type a compose message, close without sending, reopen, verify draft is offered.

---

### Task 9: Message Threading (Conversation View)

**Files:**
- Create: `frontend/src/hooks/useThreading.ts`
- Modify: `frontend/src/components/mail/MessageList.tsx`
- Modify: `frontend/src/stores/mailboxStore.ts`
- Modify: `frontend/src/services/messages.ts`

**Changes:**
1. Add `threadId` field to `MessageSummary` type (populated from `references` header)
2. Backend: Add `GET /api/messages/thread/:threadId` endpoint that returns all messages in a thread
3. Frontend: Create `useThreading` hook:
   - Group messages by `threadId` (or subject normalization as fallback)
   - Show thread count badge on message rows
   - Expand/collapse thread inline in the message list
4. MessageRow: Show thread indicator (e.g., "3 messages") and expand button
5. Thread expansion: fetch all messages in thread, display as nested list
6. Add thread view toggle in TopBar: "Conversation view" / "Flat view"

**Verify:** Manual test: send a reply to an email, verify messages are grouped in the list.

---

### Task 10: Contact Groups

**Files:**
- Modify: `backend/internal/models/contact.go`
- Modify: `backend/internal/api/contacts.go`
- Modify: `frontend/src/app/routes/Contacts.tsx`
- Modify: `frontend/src/services/contacts.ts`

**Changes:**
1. Backend: Add `ContactGroup` model:
   ```go
   type ContactGroup struct {
       ID        uint   `gorm:"primaryKey"`
       Name      string `gorm:"not null"`
       Email     string `gorm:"index;not null"`
       Members   []Contact `gorm:"many2many:contact_group_members;"`
       CreatedAt time.Time
       UpdatedAt time.Time
   }
   ```
2. Add CRUD endpoints for groups
3. Frontend: Add "Groups" tab or section in Contacts page
4. Add group autocomplete in compose To field
5. Expand group to individual addresses on send

**Verify:** `go test ./...` passes. Manual test: create a group, add contacts, compose to group.

---

## Task Count Summary

| Part | Tasks | Description |
|------|-------|-------------|
| Prerequisites | 1 | Install Sonner toast library |
| Part A | 6 | Missing frontend integration (folders, notifications, IDLE, reply, shortcuts, SMTP) |
| Part B | 4 | UX polish & power features (undo, drafts, threading, groups) |
| **Total** | **11** | |

## Recommended Execution Order

0. **Task 0** (Install Sonner) — prerequisite for all toast-based features
1. **Task 1** (Folder management) — high impact, enables folder operations from UI
2. **Task 5** (Keyboard shortcuts) — power user feature, high usability
3. **Task 4** (Reply attribution) — improves email usability
4. **Task 2** (Notifications) — real-time experience (browser + Sonner)
5. **Task 7** (Undo operations) — safety net for destructive actions (Sonner)
6. **Task 3** (IDLE multi-folder) — extends real-time to all folders
7. **Task 6** (SMTP relay) — deployment flexibility
8. **Task 8** (Draft auto-save) — prevents data loss
9. **Task 9** (Message threading) — conversation organization
10. **Task 10** (Contact groups) — power user feature

## Technical Notes

### Design System Tokens (use throughout all tasks)
- Colors: `var(--color-bg)`, `var(--color-surface)`, `var(--color-surface-elevated)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-accent)`, `var(--color-error)`, `var(--color-success)`
- Spacing: `var(--space-1)` through `var(--space-8)`
- Border radius: `var(--radius-sm)`, `var(--radius-md)`, `var(--radius-lg)`
- Shadows: `var(--shadow-low)`, `var(--shadow-md)`, `var(--shadow-high)`
- Motion: `var(--duration-fast)`, `var(--duration-normal)`, `var(--duration-slow)`, `var(--ease-out-expo)`, `var(--ease-spring)`
- Touch targets: 44×44px minimum for interactive elements
- Focus rings: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2`
- ARIA labels on all interactive elements

### Testing Strategy
- Unit tests for new hooks (useUndo, useThreading, useNotifications)
- Component tests for new UI (FolderContextMenu, SmtpSettings)
- Sonner toast tests: mock `toast()` from sonner, verify undo callbacks fire
- Property-based tests for threading logic (grouping by threadId)
- Backend tests for folder CRUD, SMTP relay, threading API

### Dependencies
- **New npm package**: `sonner` — toast library for undo notifications, in-app alerts, and confirmations
- Backend: existing GORM, Fiber, go-imap packages

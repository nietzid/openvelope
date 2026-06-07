# Implementation Plan: Frontend Redesign

## Overview

Incremental implementation of the webmail frontend redesign following a foundation-up build order: design tokens and infrastructure first, then primitives, layout, feature components, real-time enhancements, performance optimizations, accessibility polish, and property-based tests. Each task builds on completed prior tasks to avoid orphaned code.

## Tasks

- [x] 1. Foundation — Design tokens, theme engine, motion utilities, directory structure
  - [x] 1.1 Create directory structure and style foundation
    - Create `frontend/src/app/`, `frontend/src/app/routes/`, `frontend/src/components/primitives/`, `frontend/src/components/layout/`, `frontend/src/components/mail/`, `frontend/src/components/search/`, `frontend/src/hooks/`, `frontend/src/lib/`
    - Create `frontend/src/styles/tokens.css` with all CSS custom properties (color, spacing, radius, shadow, typography, motion tokens) for `:root` (light) and `[data-theme="dark"]`, including the `@media (prefers-reduced-motion: reduce)` override
    - Create `frontend/src/styles/index.css` with `@import "tailwindcss"` and the `@theme` block mapping CSS custom properties to Tailwind utilities
    - Update Vite config / `index.html` to import `styles/index.css` instead of `src/index.css`
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.5_

  - [x] 1.2 Implement theme store (`stores/themeStore.ts`)
    - Create `useThemeStore` with Zustand + persist middleware supporting modes: 'light', 'dark', 'system'
    - Implement `resolve()` helper, `applyTheme()` that sets `data-theme` on `<html>`, `getSystemTheme()` using `prefers-color-scheme`
    - Add `onRehydrateStorage` handler to apply persisted theme on load
    - Add `matchMedia` change listener for real-time system theme tracking
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 1.3 Implement UI store (`stores/uiStore.ts`)
    - Create `useUIStore` with panel state (`activePanel`), compose state (`composeOpen`, `composeMode`, `composeReplyTo`), search state (`searchOpen`), and WebSocket connection state (`wsStatus`, `wsRetryCount`)
    - Implement actions: `setActivePanel`, `openCompose`, `closeCompose`, `toggleSearch`, `setWsStatus`
    - _Requirements: 7.3, 11.1, 12.1, 13.5_

  - [x] 1.4 Implement motion utilities (`lib/motion.ts`)
    - Implement `staggerDelay(index, intervalMs)` — returns `index × interval` for index < 10, else 0
    - Implement `staggerStyle(index, intervalMs)` — returns CSSProperties with `transitionDelay`, `opacity: 0`, `transform: translateY(4px)`
    - Export `easing` and `duration` constant objects
    - _Requirements: 3.3, 3.4, 3.6, 3.7_

  - [x] 1.5 Implement `hooks/useReducedMotion.ts`
    - Create hook using `useSyncExternalStore` that subscribes to `prefers-reduced-motion` media query
    - Return boolean indicating whether reduced motion is active
    - _Requirements: 3.5_

  - [x] 1.6 Implement formatting utilities (`lib/format.ts`)
    - Implement `formatSize(bytes)` — returns human-readable file size (B, KB with 1 decimal, MB with 1 decimal)
    - Implement `formatBadgeCount(count)` — returns empty string for 0, string for 1–99, "99+" for >99
    - _Requirements: 8.1, 10.5_

  - [x] 1.7 Implement HTML sanitizer (`lib/sanitize.ts`)
    - Implement `sanitize(html: string): string` that strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<link>` elements
    - Strip all inline event handler attributes (`on*`)
    - Strip `javascript:` and `data:` URI schemes from `href` and `src` attributes
    - Preserve safe HTML structure
    - _Requirements: 10.3_

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Primitives — Reusable design system atoms
  - [x] 3.1 Implement Button primitive (`components/primitives/Button.tsx`)
    - Create `Button` component with `variant` (primary, secondary, ghost), `size` (sm, md, lg), `loading`, and `tooltip` props
    - Apply press scale (0.97 → 1.0) via CSS `:active` + transitions (150ms ease-out / 200ms ease-out-expo)
    - Apply hover highlight (150ms ease-out), focus-visible ring (2px, 2px offset, accent color)
    - Handle disabled state (opacity 0.5, pointer-events none, aria-disabled)
    - Ensure 44×44px minimum touch target
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.2 Implement Tooltip primitive (`components/primitives/Tooltip.tsx`)
    - Create `Tooltip` component with `content`, `placement`, `delayMs` props and children render
    - Implement 500ms initial delay, warm-up logic (0ms delay within 300ms of last close)
    - Animate enter: scale(0.96)/opacity 0 → scale(1)/opacity 1, 200ms ease-out-expo
    - Animate exit: 150ms ease-in-quad
    - Position with 8px gap, auto-flip on viewport overflow
    - Apply `role="tooltip"`, `aria-describedby`, Escape dismissal
    - Truncate content at 80 characters
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 3.3 Implement Dialog primitive (`components/primitives/Dialog.tsx`)
    - Create `Dialog` component with backdrop (opacity 0.3), focus trap, and return-focus-on-close
    - Animate open: scale(0.96)/opacity 0 → scale(1)/opacity 1, 300ms ease-out-expo
    - Animate close: scale(0.98)/opacity 0, 200ms ease-in-quad
    - Handle Escape key close, click-outside close
    - Expose ARIA `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
    - _Requirements: 11.1, 11.2, 14.3, 14.5_

  - [x] 3.4 Implement Skeleton primitive (`components/primitives/Skeleton.tsx`)
    - Create `Skeleton` component with configurable width/height
    - Implement pulse animation: opacity cycles 0.4–0.7 at 1.5s period
    - _Requirements: 10.6_

  - [x] 3.5 Implement Badge primitive (`components/primitives/Badge.tsx`)
    - Create `Badge` component that uses `formatBadgeCount` from `lib/format.ts`
    - Render nothing when count is 0, formatted string otherwise
    - Style: small rounded pill with accent background
    - _Requirements: 8.1_

- [x] 4. Layout — Application shell and responsive panels
  - [x] 4.1 Implement LayoutShell (`components/layout/LayoutShell.tsx`)
    - Create three-panel responsive layout: Sidebar + MessageList + MessageView
    - ≥1024px: all three panels visible, Sidebar at 240px
    - 768–1024px: Sidebar as 56px icon rail, rest fills available space
    - <768px: single panel mode driven by `uiStore.activePanel`
    - Mobile panel transitions: horizontal slide, 300ms ease-out-expo, GPU-composited `translateX`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_

  - [x] 4.2 Implement ResizeDivider (`components/layout/ResizeDivider.tsx`)
    - Create draggable divider between MessageList and MessageView panels
    - Use pointer capture for smooth drag
    - Clamp MessageList width: min 280px, max 50vw
    - _Requirements: 7.4_

  - [x] 4.3 Implement Sidebar (`components/layout/Sidebar.tsx`)
    - Render folders from `mailboxStore.folders` with icon, name (ellipsis truncate), and Badge (unread count)
    - Active folder: background highlight with 200ms ease-out transition
    - Hover: distinct background highlight, 150ms transition
    - Stagger-animate folder items on load (30ms, max 10 items, translateX(-8px) entrance)
    - Compose button at top (44px min height, Button press behavior)
    - User email (truncated) + logout at bottom
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Feature components — Mail interactions
  - [x] 6.1 Implement MessageList (`components/mail/MessageList.tsx`)
    - Virtualize with `@tanstack/react-virtual`, overscan 5, estimated row height 72px
    - Render `MessageRow` for each item
    - Stagger-animate on page load (30ms cascade, opacity/translateY, max 10 items)
    - Selected row: background fill transition 150ms ease-out
    - Pagination footer: page size selector (25, 50, 100, 200) + Prev/Next buttons with correct disabled states
    - Loading state: skeleton indicators, disabled pagination
    - Error state: error message, preserve pagination state
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.8, 9.9_

  - [x] 6.2 Implement MessageRow (`components/mail/MessageRow.tsx`)
    - Render sender (single-line truncated), subject (single-line truncated), preview (≤120 chars, truncated), timestamp
    - Unread: 6px accent dot + semibold sender/subject
    - Checkbox for batch selection
    - _Requirements: 9.2, 9.3_

  - [x] 6.3 Implement BatchToolbar (`components/mail/BatchToolbar.tsx`)
    - Slides in from top (250ms ease-out-expo translateY) when `selectedUIDs.size > 0`
    - Show selected count and batch actions (mark read/unread, delete, move)
    - _Requirements: 9.7_

  - [x] 6.4 Implement MessageView (`components/mail/MessageView.tsx`)
    - Enter animation: opacity 0 + translateX(8px) → resting, 250ms ease-out-expo
    - Headers: from, to, cc, date in labeled vertical list (muted labels)
    - HTML body: render sanitized output from `lib/sanitize.ts`
    - Plain-text fallback: `<pre>` with `white-space: pre-wrap`
    - Attachments: filename + formatted size + download button
    - Reply/Forward buttons with Button press behavior → open ComposeDialog
    - Loading: Skeleton pulse
    - Empty state: centered prompt
    - Error state: inline error, no navigation away
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [x] 6.5 Implement ComposeDialog (`components/mail/ComposeDialog.tsx`)
    - Use Dialog primitive for open/close animations and focus trap
    - Reply mode: pre-fill recipient, "Re:" subject (avoid double prefix), blockquote original body
    - Forward mode: "Fwd:" subject (avoid double prefix), empty recipient, forwarded separator
    - Lazy-load TipTap editor with formatting toolbar (bold, italic, underline, lists, link, blockquote)
    - Attachment support: max 25MB/file, max 10 files, chip display with remove
    - Upload loading indicator, disable Send during upload
    - Send: Button press animation, "Sending…" label, disable until complete
    - Error: inline red message, dialog stays open, content preserved
    - TipTap load failure: inline error with retry
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 15.1, 15.6_

  - [x] 6.6 Implement SearchInterface (`components/search/SearchInterface.tsx`)
    - Open via Cmd/Ctrl+K, centered command-palette overlay, scale(0.96)/opacity 0, 250ms ease-out-expo
    - Input: search from/to/subject/body, min 2 chars, 300ms debounce
    - Results: up to 50, scrollable, MessageRow-style layout
    - Select result: close overlay, navigate to message in folder
    - Empty results: "no messages matched" message
    - Error: error message with retry
    - Close: Escape or click outside, 150ms ease-in-quad exit
    - Focus trap while open
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 14.5_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Real-time — WebSocket enhancements and connection UI
  - [x] 8.1 Enhance WebSocket service with exponential backoff
    - Add reconnection logic: delay = min(3000 × 2^attempt, 30000), max 10 retries
    - Reset attempt counter on successful connection
    - After max retries: stop reconnecting, update `uiStore.wsStatus` to 'disconnected'
    - On reconnect success: reset counter, re-subscribe to events
    - _Requirements: 13.4, 13.6_

  - [x] 8.2 Implement WebSocket event handlers for store mutations
    - `new_message`: prepend to `mailboxStore.messages` if current folder matches, slideDown animation
    - `flags_changed`: update flags on matching UID in message list, cross-fade transition
    - `message_deleted`: remove message from list, opacity fade-out + height collapse animation
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 8.3 Implement connection status indicator
    - Create a small UI banner/indicator driven by `uiStore.wsStatus`
    - 'reconnecting': subtle indicator that real-time updates are unavailable
    - 'disconnected': persistent error with manual retry button calling `manualRetry()`
    - Use ARIA live region for screen reader announcements
    - _Requirements: 13.5, 13.6, 14.6_

- [x] 9. Application wiring — Router, providers, entry point
  - [x] 9.1 Create app entry point and route structure
    - Create `app/App.tsx` with BrowserRouter, React.lazy route splitting (Login, Mailbox)
    - Create `app/routes/Login.tsx` — move login page with entrance animation (opacity 0/translateY(8px) → resting, 350ms ease-out-expo), error shake, loading state, 30s timeout
    - Create `app/routes/Mailbox.tsx` — compose LayoutShell with Sidebar, MessageList, MessageView, ComposeDialog, SearchInterface, BatchToolbar, connection indicator
    - Wire `usePrefetch` hook: prefetch message on 200ms hover
    - Update `frontend/src/main.tsx` to import `app/App.tsx`
    - Remove old `src/App.tsx`, `src/pages/`, old component files once new structure is wired
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 15.2, 15.5_

  - [x] 9.2 Implement `hooks/usePrefetch.ts`
    - Create hook that triggers message content prefetch after 200ms hover on a message row
    - Use AbortController to cancel if hover ends before threshold
    - _Requirements: 15.5_

  - [x] 9.3 Implement `hooks/useWebSocket.ts` and `hooks/useMailboxUpdates.ts`
    - `useWebSocket`: connect on auth, disconnect on logout, expose via uiStore status
    - `useMailboxUpdates`: subscribe to WS events and dispatch mailboxStore mutations
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Performance — Code splitting, lazy loading, virtualization tuning
  - [x] 11.1 Configure route-level code splitting
    - Use `React.lazy` + `Suspense` for Login and Mailbox routes
    - Verify initial bundle < 150KB gzipped via Vite build output
    - Lazy-load TipTap editor chunk only when ComposeDialog opens
    - _Requirements: 15.1, 15.2_

  - [x] 11.2 Verify virtualization configuration
    - Confirm `@tanstack/react-virtual` overscan is 5
    - Confirm estimated row size is 72px
    - Ensure DOM node count equals visible rows + 10 (5 overscan each direction)
    - _Requirements: 15.3, 15.4_

- [x] 12. Accessibility — ARIA, focus management, skip links
  - [x] 12.1 Add ARIA landmarks and roles
    - Sidebar: `role="navigation"`, `aria-label`
    - MessageList: `role="list"`, rows as `role="listitem"`
    - MessageView: `role="main"` or `role="region"` with `aria-label`
    - BatchToolbar: `role="toolbar"`
    - Connection indicator: `role="status"` with `aria-live="polite"` / `aria-live="assertive"` for errors
    - _Requirements: 14.3, 14.6_

  - [x] 12.2 Implement skip-to-main-content link
    - Add as first focusable element in the document
    - On activation, move focus to MessageList panel
    - Visually hidden until focused
    - _Requirements: 14.7_

  - [x] 12.3 Verify focus management
    - Ensure all interactive elements reachable via Tab/Shift+Tab
    - Verify Dialog and SearchInterface focus traps
    - Verify return-focus-on-close for ComposeDialog and SearchInterface
    - Ensure focus-visible indicators (2px ring, 2px offset, 3:1 contrast)
    - _Requirements: 14.1, 14.2, 14.5_

- [x] 13. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Property-based tests — fast-check tests for all 19 correctness properties
  - [x] 14.1 Write property test: Token structure completeness and theme parity
    - **Property 1: Token structure completeness and theme parity**
    - Generate arbitrary token config objects; validate minimum counts for color roles (5), spacing (6), radius (3), shadow (3), typography; verify light/dark key set equality
    - **Validates: Requirements 1.1, 1.2**

  - [x] 14.2 Write property test: Theme resolution correctness
    - **Property 2: Theme resolution correctness**
    - Generate combinations of ThemeMode × OS preference × localStorage availability; verify resolved value and DOM attribute
    - **Validates: Requirements 2.2, 2.4, 2.6, 2.7, 2.8**

  - [x] 14.3 Write property test: Stagger delay calculation
    - **Property 3: Stagger delay calculation**
    - Generate non-negative integers × positive intervals; verify `staggerDelay(i, interval)` returns `i × interval` for i < 10, else 0
    - **Validates: Requirements 3.7**

  - [x] 14.4 Write property test: Interactive duration bounds
    - **Property 4: Interactive duration bounds**
    - Enumerate all duration tokens; verify interactive ≤ 350ms and decorative ≤ 500ms
    - **Validates: Requirements 3.6**

  - [x] 14.5 Write property test: Tooltip positioning never overflows viewport
    - **Property 5: Tooltip positioning never overflows viewport**
    - Generate arbitrary trigger rects × viewport dimensions; verify computed tooltip stays within bounds with 8px gap
    - **Validates: Requirements 5.4**

  - [x] 14.6 Write property test: Tooltip warm-up behavior
    - **Property 6: Tooltip warm-up behavior**
    - Generate time intervals (0–1000ms); verify 0ms delay when gap < 300ms, 500ms delay otherwise
    - **Validates: Requirements 5.1, 5.2**

  - [x] 14.7 Write property test: Tooltip text length constraint
    - **Property 7: Tooltip text length constraint**
    - Generate arbitrary strings; verify rendered text ≤ 80 characters
    - **Validates: Requirements 5.7**

  - [x] 14.8 Write property test: Panel resize clamping
    - **Property 8: Panel resize clamping**
    - Generate viewport widths × drag deltas; verify resulting width in [280px, viewport × 0.5]
    - **Validates: Requirements 7.4**

  - [x] 14.9 Write property test: Unread badge formatting
    - **Property 9: Unread badge formatting**
    - Generate non-negative integers; verify no badge at 0, count string at 1–99, "99+" at >99
    - **Validates: Requirements 8.1**

  - [x] 14.10 Write property test: Message row rendering completeness
    - **Property 10: Message row rendering completeness**
    - Generate arbitrary MessageSummary objects; verify presence of sender, subject, preview (≤120 chars), timestamp, and unread dot when `flags.seen` is false
    - **Validates: Requirements 9.2, 9.3**

  - [x] 14.11 Write property test: Pagination control disabled states
    - **Property 11: Pagination control disabled states**
    - Generate page × pageSize × total combinations; verify Previous disabled at page=0, Next disabled when (page+1)×pageSize ≥ total
    - **Validates: Requirements 9.6**

  - [x] 14.12 Write property test: HTML sanitization removes all dangerous content
    - **Property 12: HTML sanitization removes all dangerous content**
    - Generate arbitrary HTML strings (including malicious payloads); verify no dangerous elements/attributes in output; verify safe content preserved
    - **Validates: Requirements 10.3**

  - [x] 14.13 Write property test: File size formatting
    - **Property 13: File size formatting**
    - Generate non-negative integers (0 to 10GB); verify correct unit selection (B, KB, MB) and formatting
    - **Validates: Requirements 10.5**

  - [x] 14.14 Write property test: Compose reply/forward pre-fill
    - **Property 14: Compose reply/forward pre-fill**
    - Generate arbitrary sender × subject × body; verify reply sets recipient, "Re:" prefix (no double), blockquote; forward sets "Fwd:" prefix (no double), empty recipient, separator
    - **Validates: Requirements 11.3, 11.4**

  - [x] 14.15 Write property test: Attachment validation
    - **Property 15: Attachment validation**
    - Generate file sizes × attachment counts; verify reject when size > 25MB or count ≥ 10, accept otherwise
    - **Validates: Requirements 11.6**

  - [x] 14.16 Write property test: Search input validation and result capping
    - **Property 16: Search input validation and result capping**
    - Generate arbitrary strings; verify search not triggered when trimmed length < 2; generate result arrays; verify rendered ≤ 50 items
    - **Validates: Requirements 12.2, 12.3**

  - [x] 14.17 Write property test: WebSocket exponential backoff
    - **Property 17: WebSocket exponential backoff**
    - Generate attempt numbers 0–20; verify delay = min(3000 × 2^n, 30000) for n < 10; verify stop at n ≥ 10
    - **Validates: Requirements 13.4**

  - [x] 14.18 Write property test: WebSocket event store mutations
    - **Property 18: WebSocket event store mutations**
    - Generate arbitrary events × message lists; verify new_message prepends, flags_changed updates correct UID, message_deleted removes UID
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [x] 14.19 Write property test: Color contrast compliance
    - **Property 19: Color contrast compliance**
    - Extract all foreground/background token pairs from both themes; compute WCAG contrast ratio; verify ≥ 4.5:1 for normal text, ≥ 3:1 for large text
    - **Validates: Requirements 14.4**

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- Existing stores (`authStore`, `mailboxStore`), services (`api.ts`, `auth.ts`, `compose.ts`, `folders.ts`, `messages.ts`, `search.ts`, `websocket.ts`), and types (`types/index.ts`) are preserved — do not rewrite
- The implementation language is TypeScript (React 19, Vite 8, Tailwind CSS 4, Zustand 5)
- Install `fast-check` as a devDependency before running property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.5", "1.6", "1.7"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["3.1", "3.4", "3.5"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.6"] },
    { "id": 7, "tasks": ["6.5"] },
    { "id": 8, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 9, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 10, "tasks": ["11.1", "11.2"] },
    { "id": 11, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 12, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.9", "14.13"] },
    { "id": 13, "tasks": ["14.5", "14.6", "14.7", "14.8"] },
    { "id": 14, "tasks": ["14.10", "14.11", "14.12", "14.14", "14.15", "14.16"] },
    { "id": 15, "tasks": ["14.17", "14.18", "14.19"] }
  ]
}
```

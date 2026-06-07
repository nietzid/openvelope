# Requirements Document

## Introduction

Complete redesign and rewrite of the webmail frontend application to deliver a modern, premium user experience inspired by Linear, Superhuman, and Arc Browser. The redesign preserves the existing backend API contracts and tech stack (React, Vite, Tailwind CSS, Zustand, TipTap) while introducing Emil Kowalski's design engineering philosophy, sophisticated motion design, dark/light theming, responsive layouts, and WCAG 2.1 AA accessibility compliance.

## Glossary

- **Application**: The webmail frontend React application
- **Design_System**: The shared set of design tokens, CSS custom properties, utility classes, and reusable primitives that define the visual language
- **Theme_Engine**: The subsystem responsible for managing dark/light color scheme switching and persisting user preference
- **Motion_System**: The animation layer providing consistent, performant transitions across the Application using CSS transitions, custom easing curves, and stagger patterns
- **Layout_Shell**: The top-level responsive container that manages the sidebar, message list, and message view panels
- **Sidebar**: The navigation panel displaying folders, compose action, and user account controls
- **Message_List**: The virtualized scrollable panel displaying message summaries for the current folder
- **Message_View**: The reading pane displaying the full content of a selected message
- **Compose_Dialog**: The modal overlay for composing, replying to, or forwarding emails
- **Search_Interface**: The UI for querying messages across folders
- **Batch_Toolbar**: The contextual toolbar that appears when multiple messages are selected
- **Tooltip**: A non-modal overlay that shows descriptive text on hover or focus
- **Button**: An interactive control that triggers an action on activation

## Requirements

### Requirement 1: Design Token System

**User Story:** As a developer, I want a centralized design token system, so that visual consistency is maintained across all components and theming is achievable through token overrides.

#### Acceptance Criteria

1. THE Design_System SHALL define CSS custom properties organized into the following scales: color (at least 5 semantic roles: background, surface, text-primary, text-secondary, and border), spacing (at least 6 stops from 4px to 64px), border-radius (at least 3 stops: small, medium, and large), shadow (at least 3 elevations: low, medium, and high), and typography (font-family, at least 4 font-size stops, and corresponding line-height values)
2. THE Design_System SHALL provide a light token set and a dark token set that declare identical CSS custom property names, differing only in their assigned values, such that every semantic color token defined in light mode has a corresponding definition in dark mode
3. WHEN the user activates the theme toggle control, THE Theme_Engine SHALL replace the active token set with the alternate token set and apply the new values to all rendered components within 100ms without triggering a full page navigation or destroying existing DOM state
4. THE Design_System SHALL define motion tokens for duration (150ms, 200ms, 250ms, 350ms), easing curves (ease-out-expo, ease-in-quad, spring), and stagger intervals (30ms, 50ms, 80ms)
5. THE Design_System SHALL expose all token values through Tailwind CSS v4 @theme directive so that each defined token is consumable as a Tailwind utility class (e.g., a spacing token is usable via a padding or margin utility)
6. IF the user's operating system reports a dark color scheme preference and the user has not previously set an explicit theme choice, THEN THE Theme_Engine SHALL activate the dark token set as the default

### Requirement 2: Theme Engine

**User Story:** As a user, I want to switch between dark and light themes, so that I can use the application comfortably in different lighting conditions.

#### Acceptance Criteria

1. WHEN no user preference is stored in localStorage, THE Theme_Engine SHALL default to the operating system color scheme preference via the prefers-color-scheme media query
2. WHEN the user manually selects a theme, THE Theme_Engine SHALL persist the selection to localStorage and apply the chosen theme without a full page reload within 100ms of the user interaction
3. THE Theme_Engine SHALL support three modes: light, dark, and system (follow OS preference)
4. WHILE the theme mode is set to system, THE Theme_Engine SHALL update the active theme when the operating system preference changes without requiring a page reload or additional user interaction
5. WHEN the theme changes, THE Theme_Engine SHALL apply a 200ms CSS transition to background-color and color properties to avoid abrupt visual switches
6. WHEN the application loads and a theme preference exists in localStorage, THE Theme_Engine SHALL apply the stored preference, taking priority over the operating system color scheme preference
7. IF localStorage is unavailable or unreadable, THEN THE Theme_Engine SHALL fall back to the operating system color scheme preference and continue to operate in system mode without displaying an error to the user
8. WHEN the theme is applied, THE Theme_Engine SHALL set a data attribute or CSS class on the document root element so that all styled components reflect the active theme

### Requirement 3: Motion System

**User Story:** As a user, I want smooth, polished animations throughout the interface, so that the application feels premium and responsive.

#### Acceptance Criteria

1. THE Motion_System SHALL use CSS transitions (not CSS keyframe animations) for all interactive state changes (hover, focus, active, pressed, expanded, and collapsed) to ensure interruptibility
2. THE Motion_System SHALL only animate the transform and opacity properties to guarantee GPU-accelerated compositing
3. THE Motion_System SHALL define custom easing curves: ease-out-expo (cubic-bezier(0.16, 1, 0.3, 1)) for entrances, ease-in-quad (cubic-bezier(0.55, 0.085, 0.68, 0.53)) for exits
4. THE Motion_System SHALL use asymmetric timing: entrance durations between 250ms-350ms and exit durations between 150ms-200ms
5. IF the user has enabled prefers-reduced-motion, THEN THE Motion_System SHALL set all transition durations to 0ms and disable stagger delays, while preserving instantaneous final-state rendering so that UI state changes remain visible without animation
6. THE Motion_System SHALL limit all UI animation durations to a maximum of 350ms for interactive elements and a maximum of 500ms for non-interactive decorative transitions
7. THE Motion_System SHALL apply stagger intervals of 30ms between list items for cascade entrance animations, capped at 10 items maximum, and SHALL render any items beyond the 10-item cap at full opacity with no entrance delay

### Requirement 4: Button and Interactive Controls

**User Story:** As a user, I want buttons and controls to feel tactile and responsive, so that the interface feels direct and alive.

#### Acceptance Criteria

1. WHEN a Button is pressed (mouse down or touch start), THE Application SHALL apply a scale transform of 0.97 with a 150ms ease-out transition
2. WHEN a Button is released, THE Application SHALL return the scale to 1.0 with a 200ms ease-out-expo transition
3. WHILE a Button or interactive control has keyboard focus (focus-visible), THE Application SHALL display a 2px solid ring with 2px offset using the current accent color, meeting a minimum 3:1 contrast ratio against adjacent backgrounds
4. THE Application SHALL ensure all interactive controls have a minimum touch target of 44x44 CSS pixels
5. WHILE a Button is disabled, THE Application SHALL reduce opacity to 0.5, remove pointer events, set cursor to not-allowed, and expose the disabled state to assistive technology via the disabled attribute or aria-disabled
6. WHEN the user hovers over an enabled Button, THE Application SHALL display a background highlight with a 150ms ease-out transition, and remove the highlight on pointer leave with the same timing

### Requirement 5: Tooltip System

**User Story:** As a user, I want informative tooltips that appear quickly after the first one, so that I can efficiently learn the interface.

#### Acceptance Criteria

1. WHEN the user hovers over or focuses a control with a tooltip, THE Tooltip SHALL appear after a 500ms delay
2. WHEN the user moves to another tooltip-bearing control within 300ms of closing the previous Tooltip, THE Tooltip SHALL appear immediately without delay
3. WHEN the Tooltip appears, THE Tooltip SHALL animate in from scale(0.96) and opacity 0 to scale(1) and opacity 1 using a 200ms ease-out-expo transition
4. THE Tooltip SHALL position itself with a preferred placement of top-center, an 8px gap from the trigger element, and SHALL reposition to the opposite side if the preferred placement would cause the Tooltip to overflow the viewport
5. WHEN the user moves the pointer away or blurs the control, THE Tooltip SHALL exit with a 150ms ease-in-quad transition
6. THE Tooltip SHALL have an accessible role of tooltip, be associated with its trigger via aria-describedby, and SHALL be dismissible by pressing the Escape key
7. THE Tooltip SHALL display a single line of descriptive text with a maximum length of 80 characters

### Requirement 6: Login Page

**User Story:** As a user, I want a visually refined login experience, so that the application makes a strong first impression.

#### Acceptance Criteria

1. THE Application SHALL center the login form vertically and horizontally with a background gradient that adapts to the active theme (light or dark)
2. WHEN the login form mounts, THE Application SHALL animate the form container from opacity 0 and translateY(8px) to opacity 1 and translateY(0) using a 350ms ease-out-expo transition
3. IF the server responds with an authentication error after form submission, THEN THE Application SHALL display an error message below the form with a shake animation (translateX ±4px for 300ms) and the error message SHALL remain visible until the user modifies any input field or resubmits the form
4. WHILE a login request is in progress, THE Application SHALL replace the submit button label with a spinning indicator and text "Signing in…", and SHALL disable all form inputs until the response is received or a 30-second timeout elapses
5. WHEN login succeeds, THE Application SHALL transition out the login form with a 200ms fade (opacity 1 to 0) before navigating to the /mailbox route
6. IF the login request does not receive a response within 30 seconds, THEN THE Application SHALL cancel the request, re-enable the form inputs, and display an error message indicating the server is unreachable

### Requirement 7: Layout Shell and Responsive Panels

**User Story:** As a user, I want a responsive three-panel layout that adapts to my screen size, so that I can use the application on any device.

#### Acceptance Criteria

1. WHILE the viewport width is above 1024px, THE Layout_Shell SHALL render all three panels (Sidebar, Message_List, Message_View) simultaneously in a horizontal arrangement
2. WHILE the viewport width is between 768px and 1024px, THE Layout_Shell SHALL collapse the Sidebar into an icon-only rail of 56px width, displaying a tooltip label on each icon when the user hovers or focuses the icon
3. WHILE the viewport width is below 768px, THE Layout_Shell SHALL display one panel at a time starting with Message_List as the default visible panel, and SHALL provide navigation controls to switch between Sidebar, Message_List, and Message_View
4. WHILE the viewport width is above 768px, THE Layout_Shell SHALL allow the user to resize the Message_List panel width by dragging a divider, constraining the width to a minimum of 280px and a maximum of 50% of the viewport width
5. WHEN a panel transition occurs on viewports below 768px, THE Layout_Shell SHALL animate the transition between panels with a horizontal slide animation completing within 300ms
6. WHEN the user selects a message from Message_List on viewports below 768px, THE Layout_Shell SHALL navigate to the Message_View panel with a slide transition

### Requirement 8: Sidebar Navigation

**User Story:** As a user, I want an elegant sidebar that provides quick access to my folders and actions, so that navigation feels effortless.

#### Acceptance Criteria

1. THE Sidebar SHALL display each folder item with an icon, a folder name truncated with an ellipsis if it exceeds the available width, and an unread badge showing the unseen count (capped at displaying "99+" for counts exceeding 99) when the unseen count is greater than 0
2. WHEN the user selects a folder, THE Sidebar SHALL highlight the active folder with a background fill that animates using a 200ms ease-out transition
3. WHEN the folder list is loaded, THE Sidebar SHALL stagger-animate folder items with a 30ms delay between each item from opacity 0 and translateX(-8px) to their resting state, applying the stagger to a maximum of 10 items with remaining items appearing immediately
4. THE Sidebar SHALL display a full-width Compose button at the top with a minimum height of 44px and the Button press interaction defined in Requirement 4
5. THE Sidebar SHALL display the user email (truncated with an ellipsis if it exceeds the available width) and a logout action in a bottom section
6. WHEN the user hovers over a folder item, THE Sidebar SHALL show a background highlight visually distinct from both the inactive state and the active folder highlight, with a 150ms transition

### Requirement 9: Message List

**User Story:** As a user, I want a fast, scannable message list with clear visual hierarchy, so that I can quickly identify important emails.

#### Acceptance Criteria

1. THE Message_List SHALL use virtualized rendering (TanStack Virtual) to maintain 60fps scroll performance with lists exceeding 1000 items
2. THE Message_List SHALL display each message row with sender name (truncated to a single line), subject line (truncated to a single line), preview text (truncated to a single line, maximum 120 characters), timestamp, and unread indicator
3. IF a message row is unread, THEN THE Message_List SHALL display a 6px accent-colored dot and render the sender and subject in semibold weight
4. WHEN the user selects a message, THE Message_List SHALL highlight the selected row with a background fill transition of 150ms ease-out
5. WHEN new messages are loaded (page change), THE Message_List SHALL stagger-animate incoming rows with a 30ms cascade delay from opacity 0 and translateY(4px), capped at 10 items maximum
6. THE Message_List SHALL display pagination controls with page size selector (25, 50, 100, 200) and Previous/Next navigation buttons in the footer, with navigation buttons disabled when no further pages exist in that direction
7. WHILE a batch selection is active (one or more messages selected), THE Batch_Toolbar SHALL slide in from the top with a 250ms ease-out-expo translateY animation displaying the count of selected messages and available actions
8. IF the message list fails to load, THEN THE Message_List SHALL display an error message indicating the failure reason and preserve the current pagination state
9. WHILE messages are loading, THE Message_List SHALL display a loading indicator in the list area and disable pagination controls

### Requirement 10: Message View

**User Story:** As a user, I want a clean, readable message viewing experience, so that I can focus on email content without distraction.

#### Acceptance Criteria

1. WHEN a message is selected, THE Message_View SHALL animate in from opacity 0 and translateX(8px) to opacity 1 and translateX(0) using a 250ms ease-out-expo transition
2. THE Message_View SHALL display message headers (from, to, cc, date) in a labeled list where each field label is visually distinct from its value through reduced font weight or muted color, and all header fields are vertically stacked with consistent spacing
3. THE Message_View SHALL render HTML email content in a sandboxed container with dangerous elements removed (script, iframe, object, embed, style, link) and inline event handler attributes and javascript: or data: URI schemes stripped from remaining elements
4. THE Message_View SHALL display Reply and Forward action buttons with the tactile press behavior defined in Requirement 4
5. WHEN attachments are present, THE Message_View SHALL display an attachment section showing each attachment's file name, human-readable size (bytes, KB, or MB as appropriate), and a download action
6. WHILE a message is loading, THE Message_View SHALL display a skeleton placeholder with a pulse animation cycling opacity between 0.4 and 0.7 at a 1.5s period
7. IF the message fails to load, THEN THE Message_View SHALL display an error indication describing the failure and allow the user to remain in the current view without navigation
8. IF the email has no HTML body, THEN THE Message_View SHALL render the plain-text body in a preformatted block with word wrapping enabled
9. WHILE no message is selected, THE Message_View SHALL display an empty state with a prompt instructing the user to select a message

### Requirement 11: Compose Dialog

**User Story:** As a user, I want a polished compose experience that feels like a focused workspace, so that writing emails is pleasant and efficient.

#### Acceptance Criteria

1. WHEN the Compose_Dialog opens, THE Application SHALL animate a backdrop overlay to opacity 0.3 and scale the dialog from scale(0.96) and opacity 0 to scale(1) and opacity 1 using a 300ms ease-out-expo transition
2. WHEN the Compose_Dialog closes, THE Application SHALL animate the dialog to scale(0.98) and opacity 0 using a 200ms ease-in-quad transition
3. IF the Compose_Dialog is opened in reply mode, THEN THE Compose_Dialog SHALL pre-fill the recipient with the original sender address, set the subject with a "Re:" prefix (if not already present), and display the original message body in a visually distinct blockquote
4. IF the Compose_Dialog is opened in forward mode, THEN THE Compose_Dialog SHALL set the subject with a "Fwd:" prefix (if not already present), leave the recipient field empty, and include the original message body below a forwarded-message separator
5. THE Compose_Dialog SHALL integrate the TipTap rich text editor with a formatting toolbar providing bold, italic, underline, ordered list, unordered list, link insertion, and blockquote controls
6. THE Compose_Dialog SHALL support file attachments up to 25MB per file and a maximum of 10 attachments per message, displaying each attachment as a labeled chip showing file name and size with a remove button
7. WHILE a file upload is in progress, THE Compose_Dialog SHALL display a loading indicator on the Attach control and disable the Send button until the upload completes
8. IF a send operation fails, THEN THE Compose_Dialog SHALL display an inline error message with a red accent color without closing the dialog, and SHALL preserve all form content so the user can retry
9. WHEN the send button is clicked, THE Application SHALL apply the Button press animation defined in Requirement 4 and replace the button label with a "Sending…" text while disabling the button until the operation completes or fails

### Requirement 12: Search Interface

**User Story:** As a user, I want a fast, keyboard-friendly search, so that I can quickly find any email.

#### Acceptance Criteria

1. WHEN the user activates search (click or keyboard shortcut Cmd/Ctrl+K), THE Search_Interface SHALL open with a centered command-palette style overlay animated from scale(0.96) and opacity 0 using 250ms ease-out-expo
2. THE Search_Interface SHALL provide a text input that searches across from, to, subject, and body fields, requiring a minimum of 2 characters before initiating a search query and debouncing input by 300ms
3. WHEN search results are returned, THE Search_Interface SHALL display up to 50 results in a scrollable list showing sender, subject, date, and preview in the same row layout as the Message_List
4. WHEN the search query returns zero results, THE Search_Interface SHALL display a message indicating no messages matched the query
5. IF the search request fails due to a network or server error, THEN THE Search_Interface SHALL display an error message indicating the search could not be completed and allow the user to retry
6. WHEN the user selects a search result, THE Search_Interface SHALL close the overlay and navigate to the selected message in its containing folder
7. WHEN the user presses Escape or clicks outside the overlay, THE Search_Interface SHALL close with a 150ms ease-in-quad exit animation

### Requirement 13: Real-Time Updates

**User Story:** As a user, I want the interface to update instantly when new emails arrive or flags change, so that I always see current state without refreshing.

#### Acceptance Criteria

1. WHEN a new_message WebSocket event is received for the current folder, THE Application SHALL prepend the new message to the Message_List with a slideDown animation (translateY(-100%) to translateY(0) over 250ms ease-out-expo)
2. WHEN a flags_changed WebSocket event is received for a message visible in the current folder, THE Application SHALL update the affected message row's read-status indicator and flagged-status indicator with a 200ms cross-fade transition
3. WHEN a message_deleted WebSocket event is received for a message visible in the current folder, THE Application SHALL animate the removed row with opacity fade-out and height collapse over 200ms
4. THE Application SHALL maintain the WebSocket connection with automatic reconnection using exponential backoff starting at 3 seconds, doubling on each attempt, up to a maximum of 30 seconds between attempts, for a maximum of 10 consecutive reconnection attempts
5. IF the WebSocket connection is lost and has not yet been re-established, THEN THE Application SHALL display a visible connection-status indicator informing the user that real-time updates are unavailable
6. IF the maximum number of reconnection attempts is exhausted without a successful connection, THEN THE Application SHALL display an error indicator with an option for the user to manually retry the connection

### Requirement 14: Accessibility

**User Story:** As a user with accessibility needs, I want the application to be fully navigable via keyboard and compatible with screen readers, so that I can use the webmail effectively.

#### Acceptance Criteria

1. THE Application SHALL ensure all interactive elements are reachable via sequential keyboard navigation (Tab/Shift+Tab)
2. THE Application SHALL provide visible focus indicators (2px ring, offset 2px) that meet a minimum 3:1 contrast ratio against adjacent colors
3. THE Application SHALL assign appropriate ARIA roles (dialog, navigation, list, listitem, status) and labels to all landmark regions and interactive widgets
4. THE Application SHALL maintain a color contrast ratio of at least 4.5:1 for normal text and 3:1 for large text in both light and dark themes
5. THE Application SHALL ensure the Compose_Dialog and Search_Interface trap focus while open and return focus to the triggering element on close
6. THE Application SHALL announce dynamic content changes (new messages, errors, loading states) to assistive technology using ARIA live regions with appropriate politeness levels (polite for new messages, assertive for errors)
7. THE Application SHALL provide a skip-to-main-content link as the first focusable element that navigates keyboard focus to the Message_List panel

### Requirement 15: Performance

**User Story:** As a user, I want the application to load quickly and remain smooth during interaction, so that it never feels sluggish.

#### Acceptance Criteria

1. WHEN the Compose_Dialog is opened for the first time, THE Application SHALL lazy-load the TipTap editor bundle asynchronously and display the editor within 2 seconds of the dialog opening
2. THE Application SHALL use code splitting at the route level to keep the initial bundle under 150KB gzipped
3. WHILE the user is scrolling, resizing panels, or animations are playing, THE Application SHALL maintain a frame rate of at least 55fps (measured as no more than 5% of frames exceeding 16.7ms frame budget) by compositing animations on GPU layers (transform and opacity only)
4. THE Application SHALL virtualize the Message_List so that the rendered DOM node count equals the number of visible rows plus a 5-item overscan buffer above and below the visible area
5. WHEN the user hovers over a message row for more than 200ms, THE Application SHALL prefetch that message's full content so that selecting the message displays its content without an additional loading state
6. IF the lazy-loaded TipTap editor bundle fails to load, THEN THE Application SHALL display an inline error message within the Compose_Dialog indicating the editor could not be loaded and offer a retry action

import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMailboxStore } from "../../stores/mailboxStore";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import { listFolders } from "../../services/folders";
import { staggerDelay } from "../../lib/motion";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { Button } from "../primitives/Button";
import { Badge } from "../primitives/Badge";

/** Map common folder names to SVG icon paths */
function getFolderIcon(name: string, large = false): React.ReactNode {
  const cls = large ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0";
  const lower = name.toLowerCase();

  if (lower === "inbox") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    );
  }
  if (
    lower === "sent" ||
    lower === "sent mail" ||
    lower === "[gmail]/sent mail"
  ) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    );
  }
  if (lower === "drafts" || lower === "[gmail]/drafts") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }
  if (lower === "trash" || lower === "[gmail]/trash" || lower === "deleted") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    );
  }
  if (lower === "spam" || lower === "junk" || lower === "[gmail]/spam") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  if (lower === "archive" || lower === "[gmail]/all mail") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    );
  }
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/**
 * Sidebar navigation component.
 * Supports compact mode (icon rail) toggled via a button. No auto-fold/hover behavior.
 */
export function Sidebar() {
  const folders = useMailboxStore((state) => state.folders);
  const currentFolder = useMailboxStore((state) => state.currentFolder);
  const setFolders = useMailboxStore((state) => state.setFolders);
  const setCurrentFolder = useMailboxStore((state) => state.setCurrentFolder);

  const email = useAuthStore((state) => state.email);

  const openCompose = useUIStore((state) => state.openCompose);
  const sidebarCompact = useUIStore((state) => state.sidebarCompact);
  const toggleSidebarCompact = useUIStore(
    (state) => state.toggleSidebarCompact,
  );

  const navigate = useNavigate();
  const location = useLocation();
  const isContactsActive = location.pathname === "/contacts";
  const isSettingsActive = location.pathname === "/settings";

  const reducedMotion = useReducedMotion();
  const folderListRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  const isCompact = sidebarCompact;

  // Load folders on mount
  useEffect(() => {
    listFolders()
      .then(setFolders)
      .catch(() => {});
  }, [setFolders]);

  // Stagger-animate folder items on load
  useEffect(() => {
    if (hasAnimated.current || reducedMotion || folders.length === 0) return;
    const listEl = folderListRef.current;
    if (!listEl) return;
    const items = listEl.querySelectorAll<HTMLElement>("[data-folder-item]");
    if (items.length === 0) return;

    items.forEach((item, index) => {
      const delay = staggerDelay(index, 30);
      item.style.opacity = "0";
      item.style.transform = "translateX(-8px)";
      item.style.transition = `opacity 200ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 200ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`;
    });
    requestAnimationFrame(() => {
      items.forEach((item) => {
        item.style.opacity = "1";
        item.style.transform = "translateX(0)";
      });
    });
    hasAnimated.current = true;
  }, [folders, reducedMotion]);

  const handleCompose = useCallback(() => {
    openCompose("new");
  }, [openCompose]);

  return (
    <aside
      className={[
        "flex h-full flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]",
        isCompact ? "w-14" : "w-60",
        "transition-[width] duration-[200ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
      ].join(" ")}
      aria-label="Sidebar navigation"
    >
      {/* Compose Button */}
      <div className={isCompact ? "p-1.5" : "p-3"}>
        <Button
          variant="primary"
          size={isCompact ? "sm" : "md"}
          onClick={handleCompose}
          className={
            isCompact
              ? "w-10 h-10 !p-0 mx-auto flex items-center justify-center"
              : "w-full"
          }
          aria-label="Compose new email"
        >
          {isCompact ? (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          ) : (
            "Compose"
          )}
        </Button>
      </div>

      {/* Folder List */}
      <nav
        ref={folderListRef}
        className={
          isCompact
            ? "flex-1 overflow-y-auto px-1.5"
            : "flex-1 overflow-y-auto px-2"
        }
        aria-label="Mail folders"
      >
        <ul className="space-y-1" role="list">
          {folders.map((folder) => {
            const isActive = currentFolder === folder.name;
            return (
              <li key={folder.name}>
                <button
                  type="button"
                  data-folder-item
                  onClick={() => setCurrentFolder(folder.name)}
                  title={isCompact ? folder.name : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "flex w-full items-center rounded-[var(--radius-md)]",
                    isCompact
                      ? "justify-center h-10 w-10 mx-auto"
                      : "gap-2.5 px-2.5 py-2 text-sm",
                    "text-[var(--color-text-primary)]",
                    "transition-[background-color] duration-[150ms] ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2",
                    isActive
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "hover:bg-[var(--color-surface-elevated)]",
                  ].join(" ")}
                >
                  {getFolderIcon(folder.name, isCompact)}
                  {!isCompact && (
                    <>
                      <span className="flex-1 truncate text-left">
                        {folder.name}
                      </span>
                      <Badge count={folder.unseen} />
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Contacts link */}
      <div className={isCompact ? "px-1.5 pb-1" : "px-2 pb-1"}>
        <button
          type="button"
          onClick={() => navigate("/contacts")}
          title={isCompact ? "Contacts" : undefined}
          aria-current={isContactsActive ? "page" : undefined}
          className={[
            "flex w-full items-center rounded-[var(--radius-md)]",
            isCompact
              ? "justify-center h-10 w-10 mx-auto"
              : "gap-2.5 px-2.5 py-2 text-sm",
            "text-[var(--color-text-primary)]",
            "transition-[background-color] duration-[150ms] ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2",
            isContactsActive
              ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "hover:bg-[var(--color-surface-elevated)]",
          ].join(" ")}
        >
          <svg
            className={isCompact ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {!isCompact && (
            <span className="flex-1 truncate text-left">Contacts</span>
          )}
        </button>
      </div>

      {/* Settings link */}
      <div className={isCompact ? "px-1.5 pb-1" : "px-2 pb-1"}>
        <button
          type="button"
          onClick={() => navigate("/settings")}
          title={isCompact ? "Settings" : undefined}
          aria-current={isSettingsActive ? "page" : undefined}
          className={[
            "flex w-full items-center rounded-[var(--radius-md)]",
            isCompact
              ? "justify-center h-10 w-10 mx-auto"
              : "gap-2.5 px-2.5 py-2 text-sm",
            "text-[var(--color-text-primary)]",
            "transition-[background-color] duration-[150ms] ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2",
            isSettingsActive
              ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "hover:bg-[var(--color-surface-elevated)]",
          ].join(" ")}
        >
          <svg
            className={isCompact ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {!isCompact && (
            <span className="flex-1 truncate text-left">Settings</span>
          )}
        </button>
      </div>

      {/* Bottom: compact toggle + user info */}
      <div
        className={[
          "border-t border-[var(--color-border)]",
          isCompact ? "flex flex-col items-center gap-3 py-3 px-1.5" : "p-3",
        ].join(" ")}
      >
        {/* Compact/Full toggle button */}
        <button
          type="button"
          onClick={toggleSidebarCompact}
          title={isCompact ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
          className={[
            "inline-flex items-center justify-center rounded-[var(--radius-md)] transition-[background-color] duration-[150ms] ease-out",
            "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2",
            isCompact ? "h-10 w-10" : "h-8 w-8 mb-3",
          ].join(" ")}
        >
          {isCompact ? (
            // Expand icon (chevrons right)
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          ) : (
            // Collapse icon (chevrons left)
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          )}
        </button>

        {/* User info */}
        {isCompact ? (
          <div
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-semibold"
            title={email ?? ""}
            aria-label={email ?? "User"}
          >
            {email ? email.charAt(0).toUpperCase() : "?"}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-semibold">
              {email ? email.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {email ? email.split("@")[0] : ""}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] truncate">
                {email ?? ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

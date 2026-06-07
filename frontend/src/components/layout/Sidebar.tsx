import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMailboxStore } from "../../stores/mailboxStore";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from "../../services/folders";
import { toast } from "sonner";
import { staggerDelay } from "../../lib/motion";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { Button } from "../primitives/Button";
import { Badge } from "../primitives/Badge";
import { Dialog } from "../primitives/Dialog";

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

/** Shared refresh helper */
async function refreshFolders(setFolders: (f: ReturnType<typeof useMailboxStore.getState>["folders"]) => void) {
  try {
    const fresh = await listFolders();
    setFolders(fresh);
  } catch {
    // silently ignore – the list will remain stale until next navigation
  }
}

/**
 * Sidebar navigation component.
 * Supports compact mode (icon rail) toggled via a button.
 * Folder items support a right-click context menu for create / rename / delete.
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
  const sidebarRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  const isCompact = sidebarCompact;

  // ── Context menu state ────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderName: string;
  } | null>(null);

  // Inline editing: 'create' = new folder form, 'rename' = rename existing
  const [editingMode, setEditingMode] = useState<
    { type: "create" } | { type: "rename"; folderName: string } | null
  >(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  // Loading guard for async folder ops
  const [isOperating, setIsOperating] = useState(false);

  // ── Load folders on mount ─────────────────────────────────────────
  useEffect(() => {
    listFolders()
      .then(setFolders)
      .catch(() => {});
  }, [setFolders]);

  // ── Stagger-animate folder items on load ──────────────────────────
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

  // ── Keyboard shortcuts (N = new folder) ──────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input, dialog is open, or compose is open
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        editingMode ||
        deletingFolder
      )
        return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openCreateInline();
      }
    }

    // Global shortcut — works from anywhere in the app
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingMode, deletingFolder]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close context menu on outside click / escape ─────────────────
  useEffect(() => {
    if (!contextMenu) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-context-menu]")) {
        setContextMenu(null);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  // ── Focus the inline input when editing starts ───────────────────
  useEffect(() => {
    if (editingMode && editInputRef.current) {
      // Small delay to ensure DOM is painted
      requestAnimationFrame(() => editInputRef.current?.focus());
    }
  }, [editingMode]);

  // ── Helpers ──────────────────────────────────────────────────────
  const handleCompose = useCallback(() => {
    openCompose("new");
  }, [openCompose]);

  const openCreateInline = useCallback(() => {
    setEditingMode({ type: "create" });
    setEditValue("");
    setEditError(null);
    setDeletingFolder(null);
    setContextMenu(null);
  }, []);

  const openRenameInline = useCallback((folderName: string) => {
    setEditingMode({ type: "rename", folderName });
    setEditValue(folderName);
    setEditError(null);
    setDeletingFolder(null);
    setContextMenu(null);
  }, []);

  const openDeleteConfirm = useCallback((folderName: string) => {
    setEditingMode(null);
    setEditError(null);
    setDeletingFolder(folderName);
    setContextMenu(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMode(null);
    setEditValue("");
    setEditError(null);
  }, []);

  const confirmEdit = useCallback(async () => {
    if (!editingMode || isOperating) return;
    const value = editValue.trim();
    if (!value) {
      setEditError("Folder name cannot be empty");
      return;
    }

    setIsOperating(true);
    try {
      if (editingMode.type === "create") {
        await createFolder(value);
      } else {
        if (value === editingMode.folderName) {
          cancelEditing();
          return;
        }
        await renameFolder(editingMode.folderName, value);
      }
      setEditingMode(null);
      setEditValue("");
      setEditError(null);
      await refreshFolders(setFolders);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Operation failed";
      setEditError(msg);
    } finally {
      setIsOperating(false);
    }
  }, [editingMode, editValue, isOperating, setFolders, cancelEditing]);

  const confirmDelete = useCallback(async () => {
    if (!deletingFolder || isOperating) return;
    setIsOperating(true);
    try {
      await deleteFolder(deletingFolder);
      // If the deleted folder was selected, go back to INBOX
      if (currentFolder === deletingFolder) {
        setCurrentFolder("INBOX");
      }
      setDeletingFolder(null);
      await refreshFolders(setFolders);
    } catch (err: unknown) {
      toast.error("Failed to delete folder");
      setDeletingFolder(null);
    } finally {
      setIsOperating(false);
    }
  }, [deletingFolder, isOperating, currentFolder, setCurrentFolder, setFolders]);

  // ── Context menu position clamping ────────────────────────────────
  const getClampedPosition = useCallback((x: number, y: number) => {
    const menuWidth = 200;
    const menuHeight = 140;
    const maxX = window.innerWidth - menuWidth - 4;
    const maxY = window.innerHeight - menuHeight - 4;
    return {
      x: Math.min(x, maxX),
      y: Math.min(y, maxY),
    };
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, folderName: string) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = getClampedPosition(e.clientX, e.clientY);
      setContextMenu({ ...pos, folderName });
    },
    [getClampedPosition],
  );

  // ── Render ───────────────────────────────────────────────────────
  return (
    <aside
      ref={sidebarRef}
      className={[
        "flex h-full flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]",
        isCompact ? "w-14" : "w-60",
        "transition-[width] duration-[200ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "outline-none",
      ].join(" ")}
      aria-label="Sidebar navigation"
      tabIndex={-1}
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
          {/* Inline create folder row */}
          {editingMode?.type === "create" && !isCompact && (
            <li className="px-2.5 py-1">
              <FolderInlineInput
                ref={editInputRef}
                value={editValue}
                error={editError}
                placeholder="New folder name"
                onChange={setEditValue}
                onConfirm={confirmEdit}
                onCancel={cancelEditing}
                disabled={isOperating}
              />
            </li>
          )}

          {folders.map((folder) => {
            const isActive = currentFolder === folder.name;
            const isRenaming =
              editingMode?.type === "rename" &&
              editingMode.folderName === folder.name;

            return (
              <li key={folder.name}>
                {isRenaming && !isCompact ? (
                  <div className="px-2.5 py-1">
                    <FolderInlineInput
                      ref={editInputRef}
                      value={editValue}
                      error={editError}
                      placeholder="New folder name"
                      onChange={setEditValue}
                      onConfirm={confirmEdit}
                      onCancel={cancelEditing}
                      disabled={isOperating}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    data-folder-item
                    onClick={() => setCurrentFolder(folder.name)}
                    onContextMenu={(e) => handleContextMenu(e, folder.name)}
                    title={isCompact ? folder.name : undefined}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`Folder: ${folder.name}${folder.unseen > 0 ? `, ${folder.unseen} unread` : ""}`}
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
                )}
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

      {/* ── Context Menu ─────────────────────────────────────────── */}
      {contextMenu && (
        <div
          data-context-menu
          role="menu"
          aria-label="Folder actions"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className={[
            "fixed z-[100] min-w-[180px] py-1",
            "bg-[var(--color-surface-elevated)] shadow-[var(--shadow-md)]",
            "rounded-[var(--radius-md)] border border-[var(--color-border)]",
            "animate-in fade-in zoom-in-95 duration-150",
          ].join(" ")}
        >
          <ContextMenuButton
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            }
            label="Create folder"
            shortcut="N"
            onClick={openCreateInline}
          />
          <ContextMenuButton
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            }
            label="Rename"
            onClick={() => openRenameInline(contextMenu.folderName)}
          />
          <div className="my-1 border-t border-[var(--color-border)]" />
          <ContextMenuButton
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            }
            label="Delete"
            variant="danger"
            onClick={() => openDeleteConfirm(contextMenu.folderName)}
          />
        </div>
      )}

      {/* ── Delete Confirmation Dialog ───────────────────────────── */}
      <Dialog
        open={deletingFolder !== null}
        onClose={() => setDeletingFolder(null)}
        title="Delete Folder"
        labelId="delete-folder-dialog-title"
      >
        <p className="text-sm text-[var(--color-text-secondary)] mb-[var(--space-4)]">
          Are you sure you want to delete the folder{" "}
          <strong className="text-[var(--color-text-primary)]">
            {deletingFolder}
          </strong>
          ? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-[var(--space-2)]">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDeletingFolder(null)}
            disabled={isOperating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={confirmDelete}
            disabled={isOperating}
            className="!bg-[var(--color-error)] hover:!bg-[var(--color-error)]/90"
          >
            {isOperating ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </aside>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

/** Inline input used for create/rename folder actions. */
import { forwardRef } from "react";

const FolderInlineInput = forwardRef<HTMLInputElement, {
  value: string;
  error: string | null;
  placeholder: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
}>(function FolderInlineInput(
  { value, error, placeholder, onChange, onConfirm, onCancel, disabled },
  ref,
) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={placeholder}
        className={[
          "w-full rounded-[var(--radius-sm)] border px-2 py-1 text-sm",
          "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]",
          "placeholder:text-[var(--color-text-secondary)]",
          "outline-none transition-[border-color] duration-[150ms]",
          error
            ? "border-[var(--color-error)] focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
            : "border-[var(--color-border)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          "focus-visible:ring-offset-1",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        Press <kbd className="rounded bg-[var(--color-surface)] px-1 py-0.5 text-[10px] font-mono border border-[var(--color-border)]">Enter</kbd> to confirm,{" "}
        <kbd className="rounded bg-[var(--color-surface)] px-1 py-0.5 text-[10px] font-mono border border-[var(--color-border)]">Esc</kbd> to cancel
      </p>
    </div>
  );
});

/** Single context menu item button. */
function ContextMenuButton({
  icon,
  label,
  shortcut,
  variant = "default",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  variant?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 px-3 py-3 text-sm text-left min-h-[44px]",
        "transition-[background-color] duration-[100ms] ease-out",
        "focus-visible:outline-none focus-visible:bg-[var(--color-surface)]",
        variant === "danger"
          ? "text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]",
      ].join(" ")}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded px-1 py-0.5 border border-[var(--color-border)]">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

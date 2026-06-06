import { useUIStore } from '../../stores/uiStore'
import { easing } from '../../lib/motion'

/**
 * LayoutShell — Three-panel responsive layout container.
 *
 * Breakpoints:
 *  ≥1024px  — Full sidebar (240px) or icon rail (56px) when auto-fold + MessageList + MessageView
 *  768–1024 — Icon rail (56px) + MessageList + MessageView
 *  <768px   — Single panel driven by uiStore.activePanel, slide transitions
 */

interface LayoutShellProps {
  sidebar: React.ReactNode
  messageList: React.ReactNode
  messageView: React.ReactNode
}

/** Map panel name to translateX offset for mobile slide transitions */
const panelTranslateX: Record<'sidebar' | 'list' | 'view', string> = {
  sidebar: '0%',
  list: '-100%',
  view: '-200%',
}

export function LayoutShell({ sidebar, messageList, messageView }: LayoutShellProps) {
  const activePanel = useUIStore((s) => s.activePanel)
  const sidebarCompact = useUIStore((s) => s.sidebarCompact)

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      {/* Desktop / Tablet layout (≥768px) */}
      <div className="hidden md:flex h-full w-full">
        {/* Sidebar container */}
        <div
          className={[
            'relative h-full shrink-0',
            sidebarCompact ? 'w-[56px]' : 'lg:w-[240px] md:w-[56px]',
            'transition-[width] duration-[200ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
          ].join(' ')}
          role="navigation"
          aria-label="Sidebar"
        >
          {sidebar}
        </div>

        {/* Message List + Message View fill remaining space */}
        <div className="flex h-full flex-1 min-w-0">
          <div
            id="main-content"
            tabIndex={-1}
            className="h-full min-w-[280px] shrink-0 outline-none"
            role="main"
            aria-label="Message list"
          >
            {messageList}
          </div>
          <div className="h-full flex-1 min-w-0">{messageView}</div>
        </div>
      </div>

      {/* Mobile layout (<768px) — single panel with slide transitions */}
      <div
        className="flex md:hidden h-full w-[300%]"
        style={{
          transform: `translateX(${panelTranslateX[activePanel]})`,
          transition: `transform 300ms ${easing.outExpo}`,
          willChange: 'transform',
        }}
      >
        <div className="h-full w-1/3 overflow-auto">{sidebar}</div>
        <div
          data-main-content
          tabIndex={-1}
          className="h-full w-1/3 overflow-auto outline-none"
          role="main"
          aria-label="Message list"
        >
          {messageList}
        </div>
        <div className="h-full w-1/3 overflow-auto">{messageView}</div>
      </div>
    </div>
  )
}

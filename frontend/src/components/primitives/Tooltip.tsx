import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps {
  content: string // max 80 chars
  children: ReactElement
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delayMs?: number // default 500ms
}

/** Module-level variable to track warm-up (last close time across all tooltips) */
let lastCloseTime = 0

/** Gap between trigger and tooltip in pixels */
export const GAP = 8

/** Maximum content length */
export const MAX_CONTENT_LENGTH = 80

/** Warm-up window in milliseconds */
export const WARMUP_WINDOW_MS = 300

/** Default delay in milliseconds */
export const DEFAULT_DELAY_MS = 500

type Position = { top: number; left: number }

/**
 * Computes tooltip position relative to trigger, auto-flipping
 * to the opposite side when the preferred placement overflows the viewport.
 */
export function computePosition(
  triggerRect: DOMRect,
  tooltipRect: { width: number; height: number },
  placement: NonNullable<TooltipProps['placement']>,
): Position {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const positions: Record<string, Position> = {
    top: {
      top: triggerRect.top - tooltipRect.height - GAP + window.scrollY,
      left:
        triggerRect.left +
        triggerRect.width / 2 -
        tooltipRect.width / 2 +
        window.scrollX,
    },
    bottom: {
      top: triggerRect.bottom + GAP + window.scrollY,
      left:
        triggerRect.left +
        triggerRect.width / 2 -
        tooltipRect.width / 2 +
        window.scrollX,
    },
    left: {
      top:
        triggerRect.top +
        triggerRect.height / 2 -
        tooltipRect.height / 2 +
        window.scrollY,
      left: triggerRect.left - tooltipRect.width - GAP + window.scrollX,
    },
    right: {
      top:
        triggerRect.top +
        triggerRect.height / 2 -
        tooltipRect.height / 2 +
        window.scrollY,
      left: triggerRect.right + GAP + window.scrollX,
    },
  }

  const preferred = positions[placement]

  // Check if preferred placement overflows viewport
  const overflows = wouldOverflow(preferred, tooltipRect, viewportWidth, viewportHeight)

  if (!overflows) return preferred

  // Try the opposite side
  const opposite = getOpposite(placement)
  const fallback = positions[opposite]
  const fallbackOverflows = wouldOverflow(fallback, tooltipRect, viewportWidth, viewportHeight)

  if (!fallbackOverflows) return fallback

  // If both overflow, clamp the preferred position
  return clampPosition(preferred, tooltipRect, viewportWidth, viewportHeight)
}

function wouldOverflow(
  pos: Position,
  size: { width: number; height: number },
  vw: number,
  vh: number,
): boolean {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const left = pos.left - scrollX
  const top = pos.top - scrollY

  return left < 0 || top < 0 || left + size.width > vw || top + size.height > vh
}

function clampPosition(
  pos: Position,
  size: { width: number; height: number },
  vw: number,
  vh: number,
): Position {
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  let left = pos.left - scrollX
  let top = pos.top - scrollY

  if (left < 0) left = GAP
  if (top < 0) top = GAP
  if (left + size.width > vw) left = vw - size.width - GAP
  if (top + size.height > vh) top = vh - size.height - GAP

  return { left: left + scrollX, top: top + scrollY }
}

function getOpposite(
  placement: NonNullable<TooltipProps['placement']>,
): NonNullable<TooltipProps['placement']> {
  const opposites: Record<string, NonNullable<TooltipProps['placement']>> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  }
  return opposites[placement]
}

/**
 * Tooltip primitive with warm-up logic, animated enter/exit,
 * viewport-aware positioning, and accessible ARIA attributes.
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delayMs = 500,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 })

  const triggerRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tooltipId = useId()

  // Truncate content at 80 characters
  const truncatedContent =
    content.length > MAX_CONTENT_LENGTH
      ? content.slice(0, MAX_CONTENT_LENGTH)
      : content

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()

    const pos = computePosition(
      triggerRect,
      { width: tooltipRect.width, height: tooltipRect.height },
      placement,
    )
    setPosition(pos)
  }, [placement])

  const show = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    // Warm-up: if another tooltip closed within 300ms, show immediately
    const timeSinceLastClose = Date.now() - lastCloseTime
    const effectiveDelay =
      timeSinceLastClose < WARMUP_WINDOW_MS ? 0 : delayMs

    showTimeoutRef.current = setTimeout(() => {
      setVisible(true)
      // Start enter animation on next frame
      requestAnimationFrame(() => {
        setAnimating(true)
        updatePosition()
      })
    }, effectiveDelay)
  }, [delayMs, updatePosition])

  const hide = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }

    // Start exit animation
    setAnimating(false)

    // Remove from DOM after exit animation completes (150ms)
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false)
      lastCloseTime = Date.now()
    }, 150)
  }, [])

  // Escape key dismissal
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hide()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, hide])

  // Update position on scroll/resize while visible
  useEffect(() => {
    if (!visible) return

    const handleReposition = () => updatePosition()

    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [visible, updatePosition])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // Position update after tooltip mounts
  useEffect(() => {
    if (visible && tooltipRef.current) {
      updatePosition()
    }
  }, [visible, updatePosition])

  const tooltip = visible
    ? createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: animating ? 'scale(1)' : 'scale(0.96)',
            opacity: animating ? 1 : 0,
            transition: animating
              ? 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)'
              : 'transform 150ms cubic-bezier(0.55, 0.085, 0.68, 0.53), opacity 150ms cubic-bezier(0.55, 0.085, 0.68, 0.53)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="rounded-[var(--radius-sm)] bg-[var(--color-text-primary)] px-2 py-1 text-xs text-[var(--color-bg)] shadow-[var(--shadow-md)]"
        >
          {truncatedContent}
        </div>,
        document.body,
      )
    : null

  // Clone the child element and attach event handlers + refs
  const child = children as ReactElement<Record<string, unknown>>

  return (
    <>
      <span
        ref={triggerRef as React.RefObject<HTMLSpanElement>}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={visible ? tooltipId : undefined}
        style={{ display: 'contents' }}
      >
        {child}
      </span>
      {tooltip}
    </>
  )
}

Tooltip.displayName = 'Tooltip'

// Export for testing purposes
export { lastCloseTime }
export function _resetLastCloseTime() {
  lastCloseTime = 0
}
export function _setLastCloseTime(time: number) {
  lastCloseTime = time
}

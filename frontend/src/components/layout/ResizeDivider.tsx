import { useCallback, useRef, useState } from 'react'

export const MIN_PANEL_WIDTH = 280
export const MAX_PANEL_WIDTH_RATIO = 0.5

/**
 * Clamps a panel width to the allowed range [280px, viewportWidth * 0.5].
 */
export function clampPanelWidth(width: number, viewportWidth: number): number {
  const min = MIN_PANEL_WIDTH
  const max = viewportWidth * MAX_PANEL_WIDTH_RATIO
  return Math.min(Math.max(width, min), max)
}

interface ResizeDividerProps {
  /** Current width of the panel to the left of the divider */
  width: number
  /** Callback fired during drag with the new clamped width */
  onResize: (newWidth: number) => void
}

/**
 * A draggable vertical divider that allows resizing the MessageList panel.
 * Uses pointer capture for smooth, uninterrupted drag behavior.
 */
export function ResizeDivider({ width, onResize }: ResizeDividerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      startXRef.current = e.clientX
      startWidthRef.current = width
      setIsDragging(true)
    },
    [width],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      const delta = e.clientX - startXRef.current
      const viewportWidth = window.innerWidth
      const newWidth = clampPanelWidth(startWidthRef.current + delta, viewportWidth)
      onResize(newWidth)
    },
    [isDragging, onResize],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.releasePointerCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      setIsDragging(false)
    },
    [],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-label="Resize message list"
      className={`
        relative flex items-center justify-center
        w-1 cursor-col-resize select-none
        transition-colors duration-[var(--duration-fast)]
        ${isDragging ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)] hover:bg-[var(--color-accent-hover)]'}
      `}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Invisible wider hit area for easier grab */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  )
}

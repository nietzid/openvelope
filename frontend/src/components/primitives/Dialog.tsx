import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  labelId?: string
}

/** Selector for all focusable elements inside the dialog */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Dialog primitive with backdrop, focus trap, return-focus-on-close,
 * Escape key close, click-outside close, and CSS transition animations.
 *
 * Open: scale(0.96)/opacity 0 → scale(1)/opacity 1, 300ms ease-out-expo
 * Close: scale(0.98)/opacity 0, 200ms ease-in-quad
 */
export function Dialog({ open, onClose, title, children, labelId }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  const resolvedLabelId = labelId || 'dialog-title'

  // Mount/unmount with animation support
  useEffect(() => {
    if (open) {
      // Remember the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement | null
      setMounted(true)
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      })
    } else {
      setVisible(false)
    }
  }, [open])

  // Handle transitionend for unmount
  const handleTransitionEnd = useCallback(() => {
    if (!visible && !open) {
      setMounted(false)
      // Return focus to previously focused element
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [visible, open])

  // Focus the dialog when it becomes visible
  useEffect(() => {
    if (visible && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      } else {
        dialogRef.current.focus()
      }
    }
  }, [visible])

  // Escape key handler
  useEffect(() => {
    if (!mounted) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mounted, onClose])

  // Focus trap
  useEffect(() => {
    if (!visible || !dialogRef.current) return

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusableElements.length === 0) {
        e.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [visible])

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (mounted) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-[300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
        style={{ opacity: visible ? 0.3 : 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelId}
        tabIndex={-1}
        className={[
          'relative z-10 w-full max-w-lg rounded-[var(--radius-lg)]',
          'bg-[var(--color-surface-elevated)] shadow-[var(--shadow-high)]',
          'p-[var(--space-6)]',
          'outline-none',
          'transition-[transform,opacity]',
          visible
            ? 'scale-100 opacity-100 duration-[300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
            : open
              ? 'scale-[0.96] opacity-0 duration-[300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
              : 'scale-[0.98] opacity-0 duration-[200ms] [transition-timing-function:cubic-bezier(0.55,0.085,0.68,0.53)]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Dialog title */}
        <h2
          id={resolvedLabelId}
          className="text-lg font-semibold text-[var(--color-text-primary)] mb-[var(--space-4)]"
        >
          {title}
        </h2>

        {/* Dialog content */}
        {children}
      </div>
    </div>,
    document.body,
  )
}

Dialog.displayName = 'Dialog'

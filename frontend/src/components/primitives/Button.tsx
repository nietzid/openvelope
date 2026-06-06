import { forwardRef } from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  tooltip?: string
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]',
  ghost:
    'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'min-h-[44px] min-w-[44px] px-3 py-1.5 text-sm',
  md: 'min-h-[44px] min-w-[44px] px-4 py-2 text-base',
  lg: 'min-h-[44px] min-w-[44px] px-6 py-3 text-lg',
}

/**
 * Button primitive with press scale, hover highlight, focus ring,
 * and accessible disabled state. All sizes enforce 44×44px minimum touch target.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      tooltip,
      disabled,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        title={tooltip}
        className={[
          // Base styles
          'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium',
          'select-none whitespace-nowrap',
          // Transition: 200ms ease-out-expo for release, 150ms ease-out for hover/active
          'transition-[transform,background-color,opacity]',
          'duration-[200ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
          // Press scale
          'active:scale-[0.97] active:duration-[150ms] active:[transition-timing-function:ease-out]',
          // Focus-visible ring: 2px solid, 2px offset, accent color
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
          // Disabled state
          isDisabled && 'pointer-events-none cursor-not-allowed opacity-50',
          // Variant and size
          variantClasses[variant],
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'

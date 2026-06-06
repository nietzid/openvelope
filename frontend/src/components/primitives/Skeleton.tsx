import type React from 'react'

const pulseKeyframes = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
`

interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
}

/**
 * Skeleton loading placeholder with pulse animation.
 * Cycles opacity between 0.4 and 0.7 at a 1.5s period.
 *
 * Validates: Requirements 10.6
 */
export function Skeleton({ width, height, className = '' }: SkeletonProps) {
  const style: React.CSSProperties = {
    width,
    height,
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  }

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div
        className={`rounded-md bg-surface ${className}`}
        style={style}
        aria-hidden="true"
      />
    </>
  )
}

/**
 * Motion utilities for stagger calculation, easing, and duration tokens.
 * CSS-first motion system with a thin TypeScript utility layer.
 */

import type React from 'react'

/**
 * Maximum number of items that receive a stagger delay.
 * Items beyond this index render immediately with no entrance delay.
 */
const MAX_STAGGER_ITEMS = 10

/**
 * Calculates stagger delay for list item animations.
 * Items beyond MAX_STAGGER_ITEMS render immediately (delay = 0).
 */
export function staggerDelay(index: number, intervalMs: number = 30): number {
  if (index >= MAX_STAGGER_ITEMS) return 0
  return index * intervalMs
}

/**
 * Returns inline style for stagger entrance animation.
 * Used with CSS: opacity 0 + translateY(4px) → opacity 1 + translateY(0)
 */
export function staggerStyle(index: number, intervalMs?: number): React.CSSProperties {
  const delay = staggerDelay(index, intervalMs)
  return {
    transitionDelay: delay > 0 ? `${delay}ms` : undefined,
    opacity: 0,
    transform: 'translateY(4px)',
  }
}

/** Easing tokens for programmatic use */
export const easing = {
  outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.075)',
} as const

/** Duration tokens for programmatic use (milliseconds) */
export const duration = {
  fast: 150,
  normal: 200,
  slow: 250,
  slower: 350,
} as const

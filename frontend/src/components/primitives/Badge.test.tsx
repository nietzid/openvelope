import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('returns null when count is 0', () => {
    const result = Badge({ count: 0 })
    expect(result).toBeNull()
  })

  it('renders formatted count for values 1-99', () => {
    const result = Badge({ count: 5 })
    expect(result).not.toBeNull()
    expect(result?.props.children).toBe('5')
  })

  it('renders "99+" for counts exceeding 99', () => {
    const result = Badge({ count: 150 })
    expect(result).not.toBeNull()
    expect(result?.props.children).toBe('99+')
  })

  it('renders with correct aria-label', () => {
    const result = Badge({ count: 42 })
    expect(result?.props['aria-label']).toBe('42 unread')
  })

  it('returns null for negative counts', () => {
    const result = Badge({ count: -1 })
    expect(result).toBeNull()
  })

  it('renders count of exactly 99', () => {
    const result = Badge({ count: 99 })
    expect(result).not.toBeNull()
    expect(result?.props.children).toBe('99')
  })

  it('renders count of exactly 100 as "99+"', () => {
    const result = Badge({ count: 100 })
    expect(result).not.toBeNull()
    expect(result?.props.children).toBe('99+')
  })
})

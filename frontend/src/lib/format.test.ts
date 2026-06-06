import { describe, it, expect } from 'vitest'
import { formatSize, formatBadgeCount } from './format'

describe('formatSize', () => {
  it('returns bytes with B suffix for values < 1024', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(1)).toBe('1 B')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(1023)).toBe('1023 B')
  })

  it('returns KB with one decimal for values < 1,048,576', () => {
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(10240)).toBe('10.0 KB')
    expect(formatSize(1048575)).toBe('1024.0 KB')
  })

  it('returns MB with one decimal for values >= 1,048,576', () => {
    expect(formatSize(1048576)).toBe('1.0 MB')
    expect(formatSize(1572864)).toBe('1.5 MB')
    expect(formatSize(10485760)).toBe('10.0 MB')
    expect(formatSize(26214400)).toBe('25.0 MB')
  })
})

describe('formatBadgeCount', () => {
  it('returns empty string for 0', () => {
    expect(formatBadgeCount(0)).toBe('')
  })

  it('returns the count as a string for 1–99', () => {
    expect(formatBadgeCount(1)).toBe('1')
    expect(formatBadgeCount(50)).toBe('50')
    expect(formatBadgeCount(99)).toBe('99')
  })

  it('returns "99+" for counts > 99', () => {
    expect(formatBadgeCount(100)).toBe('99+')
    expect(formatBadgeCount(500)).toBe('99+')
    expect(formatBadgeCount(9999)).toBe('99+')
  })
})

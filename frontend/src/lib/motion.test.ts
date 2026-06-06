import { describe, it, expect } from 'vitest'
import { staggerDelay, staggerStyle, easing, duration } from './motion'

describe('staggerDelay', () => {
  it('returns index × interval for index < 10', () => {
    expect(staggerDelay(0)).toBe(0)
    expect(staggerDelay(1)).toBe(30)
    expect(staggerDelay(5)).toBe(150)
    expect(staggerDelay(9)).toBe(270)
  })

  it('returns 0 for index >= 10', () => {
    expect(staggerDelay(10)).toBe(0)
    expect(staggerDelay(15)).toBe(0)
    expect(staggerDelay(100)).toBe(0)
  })

  it('uses custom interval when provided', () => {
    expect(staggerDelay(3, 50)).toBe(150)
    expect(staggerDelay(5, 80)).toBe(400)
    expect(staggerDelay(10, 50)).toBe(0)
  })

  it('defaults interval to 30ms', () => {
    expect(staggerDelay(4)).toBe(120)
  })
})

describe('staggerStyle', () => {
  it('returns style with transitionDelay for index > 0 and < 10', () => {
    const style = staggerStyle(3)
    expect(style.transitionDelay).toBe('90ms')
    expect(style.opacity).toBe(0)
    expect(style.transform).toBe('translateY(4px)')
  })

  it('returns style without transitionDelay for index 0', () => {
    const style = staggerStyle(0)
    expect(style.transitionDelay).toBeUndefined()
    expect(style.opacity).toBe(0)
    expect(style.transform).toBe('translateY(4px)')
  })

  it('returns style without transitionDelay for index >= 10', () => {
    const style = staggerStyle(10)
    expect(style.transitionDelay).toBeUndefined()
    expect(style.opacity).toBe(0)
    expect(style.transform).toBe('translateY(4px)')
  })

  it('uses custom interval when provided', () => {
    const style = staggerStyle(2, 50)
    expect(style.transitionDelay).toBe('100ms')
  })
})

describe('easing', () => {
  it('defines outExpo easing curve', () => {
    expect(easing.outExpo).toBe('cubic-bezier(0.16, 1, 0.3, 1)')
  })

  it('defines inQuad easing curve', () => {
    expect(easing.inQuad).toBe('cubic-bezier(0.55, 0.085, 0.68, 0.53)')
  })

  it('defines spring easing curve', () => {
    expect(easing.spring).toBe('cubic-bezier(0.175, 0.885, 0.32, 1.075)')
  })
})

describe('duration', () => {
  it('defines fast duration as 150ms', () => {
    expect(duration.fast).toBe(150)
  })

  it('defines normal duration as 200ms', () => {
    expect(duration.normal).toBe(200)
  })

  it('defines slow duration as 250ms', () => {
    expect(duration.slow).toBe(250)
  })

  it('defines slower duration as 350ms', () => {
    expect(duration.slower).toBe(350)
  })

  it('all interactive durations are <= 350ms', () => {
    for (const value of Object.values(duration)) {
      expect(value).toBeLessThanOrEqual(350)
    }
  })
})

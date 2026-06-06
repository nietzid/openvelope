import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Button } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined()
  })

  it('defaults to type="button"', () => {
    render(<Button>Test</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-[var(--color-accent)]')
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Sec</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-[var(--color-surface)]')
    expect(btn.className).toContain('border')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-transparent')
  })

  it('applies size sm classes', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-3')
    expect(btn.className).toContain('text-sm')
  })

  it('applies size md classes', () => {
    render(<Button size="md">Medium</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-4')
    expect(btn.className).toContain('text-base')
  })

  it('applies size lg classes', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-6')
    expect(btn.className).toContain('text-lg')
  })

  it('ensures 44×44px minimum touch target via min-h and min-w classes', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('min-h-[44px]')
    expect(btn.className).toContain('min-w-[44px]')
  })

  describe('disabled state', () => {
    it('sets disabled attribute when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)
      const btn = screen.getByRole('button')
      expect(btn.hasAttribute('disabled')).toBe(true)
    })

    it('sets aria-disabled when disabled', () => {
      render(<Button disabled>Disabled</Button>)
      const btn = screen.getByRole('button')
      expect(btn.getAttribute('aria-disabled')).toBe('true')
    })

    it('applies opacity and pointer-events-none classes when disabled', () => {
      render(<Button disabled>Disabled</Button>)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('opacity-50')
      expect(btn.className).toContain('pointer-events-none')
      expect(btn.className).toContain('cursor-not-allowed')
    })

    it('does not set aria-disabled when enabled', () => {
      render(<Button>Enabled</Button>)
      const btn = screen.getByRole('button')
      expect(btn.hasAttribute('aria-disabled')).toBe(false)
    })
  })

  describe('loading state', () => {
    it('disables the button when loading', () => {
      render(<Button loading>Send</Button>)
      const btn = screen.getByRole('button')
      expect(btn.hasAttribute('disabled')).toBe(true)
      expect(btn.getAttribute('aria-disabled')).toBe('true')
    })

    it('renders a spinner when loading', () => {
      render(<Button loading>Send</Button>)
      const btn = screen.getByRole('button')
      const svg = btn.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg!.classList.contains('animate-spin')).toBe(true)
    })

    it('still renders children alongside the spinner', () => {
      render(<Button loading>Send</Button>)
      expect(screen.getByRole('button').textContent).toContain('Send')
    })
  })

  describe('tooltip', () => {
    it('sets title attribute when tooltip prop is provided', () => {
      render(<Button tooltip="Compose email">New</Button>)
      const btn = screen.getByRole('button')
      expect(btn.getAttribute('title')).toBe('Compose email')
    })

    it('does not set title attribute when tooltip is not provided', () => {
      render(<Button>No Tooltip</Button>)
      const btn = screen.getByRole('button')
      expect(btn.hasAttribute('title')).toBe(false)
    })
  })

  describe('motion classes', () => {
    it('includes active scale transform class', () => {
      render(<Button>Press</Button>)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('active:scale-[0.97]')
    })

    it('includes transition classes for transform and background', () => {
      render(<Button>Motion</Button>)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('transition-[transform,background-color,opacity]')
    })

    it('includes ease-out-expo timing function for release', () => {
      render(<Button>Motion</Button>)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]')
    })

    it('includes 200ms duration for release transition', () => {
      render(<Button>Motion</Button>)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('duration-[200ms]')
    })

    it('includes 150ms active duration for press', () => {
      render(<Button>Motion</Button>)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('active:duration-[150ms]')
    })
  })

  describe('focus-visible ring', () => {
    it('includes focus-visible ring classes', () => {
      render(<Button>Focus</Button>)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('focus-visible:ring-2')
      expect(btn.className).toContain('focus-visible:ring-[var(--color-accent)]')
      expect(btn.className).toContain('focus-visible:ring-offset-2')
    })
  })

  it('forwards ref to the button element', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>
    render(<Button ref={ref}>Ref</Button>)
    expect(ref.current).not.toBeNull()
    expect(ref.current!.tagName).toBe('BUTTON')
  })

  it('passes through additional HTML attributes', () => {
    render(<Button data-testid="my-btn" aria-label="Custom label">Custom</Button>)
    const btn = screen.getByTestId('my-btn')
    expect(btn.getAttribute('aria-label')).toBe('Custom label')
  })

  it('merges custom className with default classes', () => {
    render(<Button className="custom-class">Custom</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('custom-class')
    expect(btn.className).toContain('inline-flex')
  })
})

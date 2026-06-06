import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LayoutShell } from './LayoutShell'
import { useUIStore } from '../../stores/uiStore'

describe('LayoutShell', () => {
  beforeEach(() => {
    useUIStore.setState({ activePanel: 'list' })
  })

  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    sidebar: <div data-testid="sidebar">Sidebar</div>,
    messageList: <div data-testid="message-list">MessageList</div>,
    messageView: <div data-testid="message-view">MessageView</div>,
  }

  it('renders all three panels', () => {
    render(<LayoutShell {...defaultProps} />)

    expect(screen.getAllByTestId('sidebar').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('message-list').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('message-view').length).toBeGreaterThanOrEqual(1)
  })

  it('applies correct translateX for mobile panel transitions based on activePanel', () => {
    const { container } = render(<LayoutShell {...defaultProps} />)

    // Default activePanel is 'list', translateX should be -100%
    const mobileContainer = container.querySelector('.w-\\[300\\%\\]') as HTMLElement
    expect(mobileContainer).toBeTruthy()
    expect(mobileContainer.style.transform).toBe('translateX(-100%)')
  })

  it('applies translateX 0% when activePanel is sidebar', () => {
    useUIStore.setState({ activePanel: 'sidebar' })
    const { container } = render(<LayoutShell {...defaultProps} />)

    const mobileContainer = container.querySelector('.w-\\[300\\%\\]') as HTMLElement
    expect(mobileContainer.style.transform).toBe('translateX(0%)')
  })

  it('applies translateX -200% when activePanel is view', () => {
    useUIStore.setState({ activePanel: 'view' })
    const { container } = render(<LayoutShell {...defaultProps} />)

    const mobileContainer = container.querySelector('.w-\\[300\\%\\]') as HTMLElement
    expect(mobileContainer.style.transform).toBe('translateX(-200%)')
  })

  it('uses ease-out-expo easing and 300ms duration for mobile transitions', () => {
    const { container } = render(<LayoutShell {...defaultProps} />)

    const mobileContainer = container.querySelector('.w-\\[300\\%\\]') as HTMLElement
    expect(mobileContainer.style.transition).toContain('300ms')
    expect(mobileContainer.style.transition).toContain('cubic-bezier(0.16, 1, 0.3, 1)')
  })

  it('uses GPU-composited transform for transitions (willChange)', () => {
    const { container } = render(<LayoutShell {...defaultProps} />)

    const mobileContainer = container.querySelector('.w-\\[300\\%\\]') as HTMLElement
    expect(mobileContainer.style.willChange).toBe('transform')
  })

  it('desktop sidebar has navigation role and label', () => {
    render(<LayoutShell {...defaultProps} />)

    // getAllByRole matches by accessible name which uses aria-label
    const navs = screen.getAllByRole('navigation', { name: 'Sidebar' })
    expect(navs.length).toBeGreaterThanOrEqual(1)
    expect(navs[0].getAttribute('aria-label')).toBe('Sidebar')
  })

  it('message list panel has id="main-content" and tabindex="-1" as skip-link target', () => {
    render(<LayoutShell {...defaultProps} />)

    const mainContent = document.getElementById('main-content')
    expect(mainContent).not.toBeNull()
    expect(mainContent!.getAttribute('tabindex')).toBe('-1')
    expect(mainContent!.getAttribute('role')).toBe('main')
    expect(mainContent!.getAttribute('aria-label')).toBe('Message list')
  })

  it('mobile message list panel has data-main-content attribute as fallback skip target', () => {
    const { container } = render(<LayoutShell {...defaultProps} />)

    const mobileTarget = container.querySelector('[data-main-content]')
    expect(mobileTarget).not.toBeNull()
    expect(mobileTarget!.getAttribute('tabindex')).toBe('-1')
    expect(mobileTarget!.getAttribute('role')).toBe('main')
    expect(mobileTarget!.getAttribute('aria-label')).toBe('Message list')
  })
})

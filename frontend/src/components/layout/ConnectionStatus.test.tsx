import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { ConnectionStatus, manualRetry } from './ConnectionStatus'
import { useUIStore } from '../../stores/uiStore'

describe('ConnectionStatus', () => {
  beforeEach(() => {
    useUIStore.setState({ wsStatus: 'connected', wsRetryCount: 0 })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when wsStatus is connected', () => {
    const { container } = render(<ConnectionStatus />)
    expect(container.innerHTML).toBe('')
  })

  it('renders reconnecting banner with role="status" and aria-live="polite"', () => {
    useUIStore.setState({ wsStatus: 'reconnecting', wsRetryCount: 2 })
    render(<ConnectionStatus />)

    const banner = screen.getByRole('status')
    expect(banner).toBeTruthy()
    expect(banner.getAttribute('aria-live')).toBe('polite')
    expect(banner.textContent).toContain('Reconnecting to server')
  })

  it('renders disconnected banner with role="alert" and aria-live="assertive"', () => {
    useUIStore.setState({ wsStatus: 'disconnected', wsRetryCount: 10 })
    render(<ConnectionStatus />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.getAttribute('aria-live')).toBe('assertive')
    expect(alert.textContent).toContain('Connection lost')
  })

  it('renders a Retry button when disconnected', () => {
    useUIStore.setState({ wsStatus: 'disconnected' })
    render(<ConnectionStatus />)

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton).toBeTruthy()
  })

  it('dispatches ws:manual-retry event when Retry button is clicked', () => {
    useUIStore.setState({ wsStatus: 'disconnected' })
    render(<ConnectionStatus />)

    const handler = vi.fn()
    window.addEventListener('ws:manual-retry', handler)

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener('ws:manual-retry', handler)
  })

  it('manualRetry function dispatches custom event on window', () => {
    const handler = vi.fn()
    window.addEventListener('ws:manual-retry', handler)

    manualRetry()

    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener('ws:manual-retry', handler)
  })

  it('Retry button meets 44px minimum touch target', () => {
    useUIStore.setState({ wsStatus: 'disconnected' })
    render(<ConnectionStatus />)

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton.className).toContain('min-h-[44px]')
    expect(retryButton.className).toContain('min-w-[44px]')
  })

  it('does not show Retry button in reconnecting state', () => {
    useUIStore.setState({ wsStatus: 'reconnecting' })
    render(<ConnectionStatus />)

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})

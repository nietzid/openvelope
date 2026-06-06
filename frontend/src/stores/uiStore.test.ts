import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUIStore.setState({
      activePanel: 'list',
      composeOpen: false,
      composeMode: null,
      composeReplyTo: null,
      searchOpen: false,
      wsStatus: 'disconnected',
      wsRetryCount: 0,
    })
  })

  describe('initial state', () => {
    it('has correct default values', () => {
      const state = useUIStore.getState()
      expect(state.activePanel).toBe('list')
      expect(state.composeOpen).toBe(false)
      expect(state.composeMode).toBeNull()
      expect(state.composeReplyTo).toBeNull()
      expect(state.searchOpen).toBe(false)
      expect(state.wsStatus).toBe('disconnected')
      expect(state.wsRetryCount).toBe(0)
    })
  })

  describe('setActivePanel', () => {
    it('sets active panel to sidebar', () => {
      useUIStore.getState().setActivePanel('sidebar')
      expect(useUIStore.getState().activePanel).toBe('sidebar')
    })

    it('sets active panel to view', () => {
      useUIStore.getState().setActivePanel('view')
      expect(useUIStore.getState().activePanel).toBe('view')
    })

    it('sets active panel to list', () => {
      useUIStore.getState().setActivePanel('view')
      useUIStore.getState().setActivePanel('list')
      expect(useUIStore.getState().activePanel).toBe('list')
    })
  })

  describe('openCompose', () => {
    it('opens compose in new mode without replyTo', () => {
      useUIStore.getState().openCompose('new')
      const state = useUIStore.getState()
      expect(state.composeOpen).toBe(true)
      expect(state.composeMode).toBe('new')
      expect(state.composeReplyTo).toBeNull()
    })

    it('opens compose in reply mode with replyTo data', () => {
      const replyTo = { to: 'sender@example.com', subject: 'Re: Hello', body: 'Original message' }
      useUIStore.getState().openCompose('reply', replyTo)
      const state = useUIStore.getState()
      expect(state.composeOpen).toBe(true)
      expect(state.composeMode).toBe('reply')
      expect(state.composeReplyTo).toEqual(replyTo)
    })

    it('opens compose in forward mode with replyTo data', () => {
      const replyTo = { to: '', subject: 'Fwd: Hello', body: 'Forwarded message' }
      useUIStore.getState().openCompose('forward', replyTo)
      const state = useUIStore.getState()
      expect(state.composeOpen).toBe(true)
      expect(state.composeMode).toBe('forward')
      expect(state.composeReplyTo).toEqual(replyTo)
    })
  })

  describe('closeCompose', () => {
    it('resets compose state', () => {
      useUIStore.getState().openCompose('reply', { to: 'a@b.com', subject: 'Re: X', body: 'body' })
      useUIStore.getState().closeCompose()
      const state = useUIStore.getState()
      expect(state.composeOpen).toBe(false)
      expect(state.composeMode).toBeNull()
      expect(state.composeReplyTo).toBeNull()
    })
  })

  describe('toggleSearch', () => {
    it('toggles search open', () => {
      useUIStore.getState().toggleSearch()
      expect(useUIStore.getState().searchOpen).toBe(true)
    })

    it('toggles search closed', () => {
      useUIStore.getState().toggleSearch()
      useUIStore.getState().toggleSearch()
      expect(useUIStore.getState().searchOpen).toBe(false)
    })
  })

  describe('setWsStatus', () => {
    it('sets status to connected and resets retry count', () => {
      useUIStore.setState({ wsRetryCount: 5 })
      useUIStore.getState().setWsStatus('connected')
      const state = useUIStore.getState()
      expect(state.wsStatus).toBe('connected')
      expect(state.wsRetryCount).toBe(0)
    })

    it('sets status to reconnecting and preserves existing retry count', () => {
      useUIStore.setState({ wsRetryCount: 3 })
      useUIStore.getState().setWsStatus('reconnecting')
      const state = useUIStore.getState()
      expect(state.wsStatus).toBe('reconnecting')
      expect(state.wsRetryCount).toBe(3)
    })

    it('sets status with explicit retry count', () => {
      useUIStore.getState().setWsStatus('reconnecting', 7)
      const state = useUIStore.getState()
      expect(state.wsStatus).toBe('reconnecting')
      expect(state.wsRetryCount).toBe(7)
    })

    it('sets status to disconnected and preserves retry count', () => {
      useUIStore.setState({ wsRetryCount: 10 })
      useUIStore.getState().setWsStatus('disconnected')
      const state = useUIStore.getState()
      expect(state.wsStatus).toBe('disconnected')
      expect(state.wsRetryCount).toBe(10)
    })
  })
})

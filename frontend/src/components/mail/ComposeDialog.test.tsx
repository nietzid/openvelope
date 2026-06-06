import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ComposeDialog } from './ComposeDialog'
import { useUIStore } from '../../stores/uiStore'

// Mock the compose service
vi.mock('../../services/compose', () => ({
  sendEmail: vi.fn(),
  uploadAttachment: vi.fn(),
}))

// Mock TipTapEditor with a simple textarea for testing
vi.mock('../TipTapEditor', () => ({
  default: ({ initialContent, onChange }: { initialContent?: string; onChange?: (html: string) => void }) => (
    <textarea
      data-testid="mock-editor"
      defaultValue={initialContent}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

afterEach(() => {
  cleanup()
  // Reset store state
  useUIStore.getState().closeCompose()
})

describe('ComposeDialog', () => {
  describe('visibility', () => {
    it('does not render dialog content when composeOpen is false', () => {
      render(<ComposeDialog />)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('renders dialog when composeOpen is true', () => {
      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)
      expect(screen.getByRole('dialog')).toBeDefined()
    })
  })

  describe('new message mode', () => {
    beforeEach(() => {
      useUIStore.getState().openCompose('new')
    })

    it('shows "New Message" title', () => {
      render(<ComposeDialog />)
      expect(screen.getByText('New Message')).toBeDefined()
    })

    it('shows empty To and Subject fields', () => {
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To') as HTMLInputElement
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement
      expect(toInput.value).toBe('')
      expect(subjectInput.value).toBe('')
    })
  })

  describe('reply mode', () => {
    beforeEach(() => {
      useUIStore.getState().openCompose('reply', {
        to: 'alice@example.com',
        subject: 'Hello World',
        body: '<p>Original message body</p>',
      })
    })

    it('shows "Reply" title', () => {
      render(<ComposeDialog />)
      expect(screen.getByText('Reply')).toBeDefined()
    })

    it('pre-fills recipient with replyTo.to', () => {
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To') as HTMLInputElement
      expect(toInput.value).toBe('alice@example.com')
    })

    it('prefixes subject with "Re: "', () => {
      render(<ComposeDialog />)
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement
      expect(subjectInput.value).toBe('Re: Hello World')
    })

    it('avoids double "Re: Re:" prefix', () => {
      useUIStore.getState().closeCompose()
      useUIStore.getState().openCompose('reply', {
        to: 'bob@example.com',
        subject: 'Re: Already replied',
        body: '<p>body</p>',
      })
      render(<ComposeDialog />)
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement
      expect(subjectInput.value).toBe('Re: Already replied')
    })

    it('includes original body in editor as blockquote content', () => {
      render(<ComposeDialog />)
      const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement
      expect(editor.defaultValue).toContain('blockquote')
      expect(editor.defaultValue).toContain('Original message body')
    })
  })

  describe('forward mode', () => {
    beforeEach(() => {
      useUIStore.getState().openCompose('forward', {
        to: 'alice@example.com',
        subject: 'Important Info',
        body: '<p>Forward this message</p>',
      })
    })

    it('shows "Forward" title', () => {
      render(<ComposeDialog />)
      expect(screen.getByText('Forward')).toBeDefined()
    })

    it('leaves recipient empty', () => {
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To') as HTMLInputElement
      expect(toInput.value).toBe('')
    })

    it('prefixes subject with "Fwd: "', () => {
      render(<ComposeDialog />)
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement
      expect(subjectInput.value).toBe('Fwd: Important Info')
    })

    it('avoids double "Fwd: Fwd:" prefix', () => {
      useUIStore.getState().closeCompose()
      useUIStore.getState().openCompose('forward', {
        to: 'x@x.com',
        subject: 'Fwd: Already forwarded',
        body: '<p>body</p>',
      })
      render(<ComposeDialog />)
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement
      expect(subjectInput.value).toBe('Fwd: Already forwarded')
    })

    it('includes forwarded separator in editor content', () => {
      render(<ComposeDialog />)
      const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement
      expect(editor.defaultValue).toContain('Forwarded message')
      expect(editor.defaultValue).toContain('Forward this message')
    })
  })

  describe('send button', () => {
    beforeEach(() => {
      useUIStore.getState().openCompose('new')
    })

    it('is disabled when To field is empty', () => {
      render(<ComposeDialog />)
      const sendBtn = screen.getByRole('button', { name: /send/i })
      expect(sendBtn.hasAttribute('disabled')).toBe(true)
    })

    it('is enabled when To field has a value', () => {
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'test@example.com' } })
      const sendBtn = screen.getByRole('button', { name: /send/i })
      expect(sendBtn.hasAttribute('disabled')).toBe(false)
    })
  })

  describe('send flow', () => {
    it('shows "Sending…" label when sending', async () => {
      const { sendEmail } = await import('../../services/compose')
      const mockedSend = vi.mocked(sendEmail)
      // Make send hang
      mockedSend.mockImplementation(() => new Promise(() => {}))

      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'test@example.com' } })

      const sendBtn = screen.getByRole('button', { name: /send/i })
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(screen.getByText('Sending…')).toBeDefined()
      })
    })

    it('shows inline error on send failure and preserves content', async () => {
      const { sendEmail } = await import('../../services/compose')
      const mockedSend = vi.mocked(sendEmail)
      mockedSend.mockRejectedValueOnce(new Error('Network error'))

      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'test@example.com' } })

      const subjectInput = screen.getByLabelText('Subject')
      fireEvent.change(subjectInput, { target: { value: 'Test Subject' } })

      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined()
        expect(screen.getByText('Network error')).toBeDefined()
      })

      // Content should be preserved
      expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('test@example.com')
      expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Test Subject')

      // Dialog should still be open
      expect(screen.getByRole('dialog')).toBeDefined()
    })
  })

  describe('attachments', () => {
    beforeEach(() => {
      useUIStore.getState().openCompose('new')
    })

    it('shows attachment counter', () => {
      render(<ComposeDialog />)
      expect(screen.getByText('0/10 · Max 25 MB each')).toBeDefined()
    })

    it('shows "Attach files" button', () => {
      render(<ComposeDialog />)
      expect(screen.getByRole('button', { name: /attach files/i })).toBeDefined()
    })
  })

  describe('cancel', () => {
    it('closes dialog on Cancel click', () => {
      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(useUIStore.getState().composeOpen).toBe(false)
    })
  })
})

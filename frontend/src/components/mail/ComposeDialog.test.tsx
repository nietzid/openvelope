import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react'
import { ComposeDialog } from './ComposeDialog'
import { useUIStore } from '../../stores/uiStore'

// Mock the compose service
vi.mock('../../services/compose', () => ({
  sendEmail: vi.fn(),
  uploadAttachment: vi.fn(),
}))

// Mock the contacts service for autocomplete
vi.mock('../../services/contacts', () => ({
  autocompleteContacts: vi.fn().mockResolvedValue([]),
}))

// Mock settings services (listIdentities, listSignatures used in useEffect)
vi.mock('../../services/settings', () => ({
  listIdentities: vi.fn().mockResolvedValue([]),
  listSignatures: vi.fn().mockResolvedValue([]),
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
  localStorage.clear()
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
    it('closes dialog on Cancel click when message is empty', () => {
      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(useUIStore.getState().composeOpen).toBe(false)
    })

    it('asks whether to save a draft on Cancel when message has content', () => {
      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Draft subject' } })
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(screen.getByRole('alertdialog', { name: /save draft before closing/i })).toBeDefined()
      expect(useUIStore.getState().composeOpen).toBe(true)
    })

    it('saves a draft immediately when choosing Save draft from Cancel prompt', () => {
      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      fireEvent.change(screen.getByLabelText('To'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Draft subject' } })
      fireEvent.change(screen.getByTestId('mock-editor'), { target: { value: '<p>Draft body</p>' } })
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

      const draft = JSON.parse(localStorage.getItem('webmail-draft') ?? '{}')
      expect(draft.to).toBe('test@example.com')
      expect(draft.subject).toBe('Draft subject')
      expect(draft.body).toBe('<p>Draft body</p>')
      expect(useUIStore.getState().composeOpen).toBe(false)
    })

    it('clears draft when choosing Discard from Cancel prompt', () => {
      localStorage.setItem('webmail-draft', JSON.stringify({
        to: 'old@example.com',
        subject: 'Old draft',
        body: '<p>Old body</p>',
        mode: 'new',
        savedAt: Date.now(),
      }))
      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'New draft' } })
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      fireEvent.click(within(screen.getByRole('alertdialog', { name: /save draft before closing/i })).getByRole('button', { name: /discard/i }))

      expect(localStorage.getItem('webmail-draft')).toBeNull()
      expect(useUIStore.getState().composeOpen).toBe(false)
    })

    it('saves a draft immediately when dialog is dismissed', async () => {
      useUIStore.getState().openCompose('new')
      render(<ComposeDialog />)

      fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Dismissed draft' } })
      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(useUIStore.getState().composeOpen).toBe(false)
      })

      const draft = JSON.parse(localStorage.getItem('webmail-draft') ?? '{}')
      expect(draft.subject).toBe('Dismissed draft')
    })
  })

  describe('contact autocomplete', () => {
    beforeEach(() => {
      useUIStore.getState().openCompose('new')
    })

    it('To field accepts text input', () => {
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'test@example.com' } })
      expect((toInput as HTMLInputElement).value).toBe('test@example.com')
    })

    it('To field accepts comma-separated values', () => {
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'alice@example.com, bob@example.com' } })
      expect((toInput as HTMLInputElement).value).toBe('alice@example.com, bob@example.com')
    })

    it('contacts service mock is available', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      expect(typeof autocompleteContacts).toBe('function')
    })

    it('To field has combobox role and aria attributes', () => {
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      expect(toInput.getAttribute('role')).toBe('combobox')
      expect(toInput.getAttribute('aria-autocomplete')).toBe('list')
      expect(toInput.getAttribute('aria-expanded')).toBe('false')
    })

    it('does not show dropdown when query is less than 2 chars', async () => {
      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'a' } })
      await act(async () => { vi.advanceTimersByTime(400) })

      expect(screen.queryByRole('listbox', { name: /contact suggestions/i })).toBeNull()
      vi.useRealTimers()
    })

    it('renders autocomplete dropdown after debounce with valid query', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockResolvedValue([
        { id: 1, display_name: 'Alice', email_addr: 'alice@example.com' },
        { id: 2, display_name: 'Bob', email_addr: 'bob@example.com' },
      ])

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'al' } })
      expect(screen.queryByRole('listbox', { name: /contact suggestions/i })).toBeNull()

      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(screen.getByRole('listbox', { name: /contact suggestions/i })).toBeDefined()
        expect(screen.getByText('Alice')).toBeDefined()
        expect(screen.getByText('Bob')).toBeDefined()
      })
    })

    it('shows "No contacts found" when results are empty', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockResolvedValue([])

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'zz' } })
      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(screen.getByText('No contacts found')).toBeDefined()
      })
    })

    it('shows loading spinner while fetching', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockImplementation(() => new Promise(() => {}))

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'lo' } })
      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(screen.getByText('Searching…')).toBeDefined()
      })
    })

    it('click selection fills To field and closes dropdown', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockResolvedValue([
        { id: 1, display_name: 'Alice Smith', email_addr: 'alice@example.com' },
      ])

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'ali' } })
      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeDefined()
      })

      const option = screen.getAllByRole('option')[0]
      fireEvent.mouseDown(option)

      await waitFor(() => {
        expect((toInput as HTMLInputElement).value).toContain('Alice Smith')
        expect((toInput as HTMLInputElement).value).toContain('alice@example.com')
        expect(screen.queryByRole('listbox', { name: /contact suggestions/i })).toBeNull()
      })
    })

    it('ArrowDown/ArrowUp navigate autocomplete options', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockResolvedValue([
        { id: 1, display_name: 'Alice', email_addr: 'alice@example.com' },
        { id: 2, display_name: 'Bob', email_addr: 'bob@example.com' },
      ])

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'ab' } })
      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(screen.getByRole('listbox', { name: /contact suggestions/i })).toBeDefined()
      })

      fireEvent.keyDown(toInput, { key: 'ArrowDown' })
      expect(document.getElementById('compose-to-option-0')?.getAttribute('aria-selected')).toBe('true')

      fireEvent.keyDown(toInput, { key: 'ArrowDown' })
      expect(document.getElementById('compose-to-option-1')?.getAttribute('aria-selected')).toBe('true')

      fireEvent.keyDown(toInput, { key: 'ArrowUp' })
      expect(document.getElementById('compose-to-option-0')?.getAttribute('aria-selected')).toBe('true')
    })

    it('Escape closes autocomplete dropdown', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockResolvedValue([
        { id: 1, display_name: 'Alice', email_addr: 'alice@example.com' },
      ])

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'al' } })
      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(screen.getByRole('listbox', { name: /contact suggestions/i })).toBeDefined()
      })

      fireEvent.keyDown(toInput, { key: 'Escape' })

      expect(screen.queryByRole('listbox', { name: /contact suggestions/i })).toBeNull()
      expect(toInput.getAttribute('aria-expanded')).toBe('false')
    })

    it('Enter selects active autocomplete option', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockResolvedValue([
        { id: 1, display_name: 'Alice', email_addr: 'alice@example.com' },
      ])

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'al' } })
      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(screen.getByRole('listbox', { name: /contact suggestions/i })).toBeDefined()
      })

      fireEvent.keyDown(toInput, { key: 'ArrowDown' })
      fireEvent.keyDown(toInput, { key: 'Enter' })

      await waitFor(() => {
        expect((toInput as HTMLInputElement).value).toContain('alice@example.com')
        expect(screen.queryByRole('listbox', { name: /contact suggestions/i })).toBeNull()
      })
    })

    it('dropdown has motion animation class', async () => {
      const { autocompleteContacts } = await import('../../services/contacts')
      vi.mocked(autocompleteContacts).mockResolvedValue([
        { id: 1, display_name: 'Alice', email_addr: 'alice@example.com' },
      ])

      vi.useFakeTimers()
      render(<ComposeDialog />)
      const toInput = screen.getByLabelText('To')
      fireEvent.change(toInput, { target: { value: 'al' } })
      await act(async () => { vi.advanceTimersByTime(350) })
      vi.useRealTimers()

      await waitFor(() => {
        const listbox = screen.getByRole('listbox', { name: /contact suggestions/i })
        expect(listbox.style.animation).toContain('autocomplete-enter')
      })
    })

    it('identity selector is rendered when identities are available', async () => {
      const { listIdentities } = await import('../../services/settings')
      vi.mocked(listIdentities).mockResolvedValue([
        {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          from_email: 'test@example.com',
          reply_to: '',
          is_default: true,
          signature_id: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<ComposeDialog />)

      await waitFor(() => {
        expect(screen.getByLabelText('From')).toBeDefined()
        expect(screen.getByText(/Test User/)).toBeDefined()
      })
    })

    it('body editor is rendered with mock', () => {
      render(<ComposeDialog />)
      expect(screen.getByTestId('mock-editor')).toBeDefined()
    })

    it('editor receives initialContent and onChange works', () => {
      useUIStore.getState().closeCompose()
      useUIStore.getState().openCompose('reply', {
        to: 'test@example.com',
        subject: 'Re: Test',
        body: '<p>Original body</p>',
      })
      render(<ComposeDialog />)
      const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement
      expect(editor.defaultValue).toContain('Original body')
      fireEvent.change(editor, { target: { value: '<p>Updated</p>' } })
      expect(editor.value).toBe('<p>Updated</p>')
    })
  })
})

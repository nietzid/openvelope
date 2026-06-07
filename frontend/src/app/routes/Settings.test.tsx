import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import Settings from './Settings'
import { useAuthStore } from '../../stores/authStore'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock settings services
vi.mock('../../services/settings', () => ({
  listIdentities: vi.fn().mockResolvedValue([]),
  createIdentity: vi.fn(),
  updateIdentity: vi.fn(),
  deleteIdentity: vi.fn(),
  listSignatures: vi.fn().mockResolvedValue([]),
  createSignature: vi.fn(),
  updateSignature: vi.fn(),
  deleteSignature: vi.fn(),
}))

// Helper to get mocked functions
async function getMocks() {
  const mod = await import('../../services/settings')
  return {
    listIdentities: vi.mocked(mod.listIdentities),
    createIdentity: vi.mocked(mod.createIdentity),
    updateIdentity: vi.mocked(mod.updateIdentity),
    deleteIdentity: vi.mocked(mod.deleteIdentity),
    listSignatures: vi.mocked(mod.listSignatures),
    createSignature: vi.mocked(mod.createSignature),
    updateSignature: vi.mocked(mod.updateSignature),
    deleteSignature: vi.mocked(mod.deleteSignature),
  }
}

beforeEach(async () => {
  useAuthStore.getState().setAuth('test-token', 'test@example.com')
  mockNavigate.mockClear()
  // Reset mocks to defaults
  const mocks = await getMocks()
  mocks.listIdentities.mockResolvedValue([])
  mocks.listSignatures.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

describe('Settings', () => {
  describe('authentication', () => {
    it('redirects to login when no access token', () => {
      useAuthStore.getState().clearAuth()
      render(<Settings />)
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })

    it('does not redirect when access token exists', () => {
      render(<Settings />)
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('header', () => {
    it('renders Settings title', () => {
      render(<Settings />)
      expect(screen.getByText('Settings')).toBeDefined()
    })

    it('renders back button', () => {
      render(<Settings />)
      expect(screen.getByLabelText('Back to mailbox')).toBeDefined()
    })

    it('navigates to mailbox on back button click', () => {
      render(<Settings />)
      fireEvent.click(screen.getByLabelText('Back to mailbox'))
      expect(mockNavigate).toHaveBeenCalledWith('/mailbox')
    })
  })

  describe('tab navigation', () => {
    it('renders Identities and Signatures tabs', () => {
      render(<Settings />)
      expect(screen.getByRole('tab', { name: 'Identities' })).toBeDefined()
      expect(screen.getByRole('tab', { name: 'Signatures' })).toBeDefined()
    })

    it('Identities tab is selected by default', () => {
      render(<Settings />)
      const identitiesTab = screen.getByRole('tab', { name: 'Identities' })
      expect(identitiesTab.getAttribute('aria-selected')).toBe('true')
    })

    it('clicking Signatures tab switches content', async () => {
      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Signatures' }).getAttribute('aria-selected')).toBe('true')
      })
    })

    it('tab panel has correct aria-controls', () => {
      render(<Settings />)
      const identitiesTab = screen.getByRole('tab', { name: 'Identities' })
      expect(identitiesTab.getAttribute('aria-controls')).toBe('tab-panel-identities')
    })
  })

  describe('identities tab', () => {
    it('shows loading skeleton initially', async () => {
      const mocks = await getMocks()
      mocks.listIdentities.mockImplementation(() => new Promise(() => {}))
      render(<Settings />)
      // Skeleton elements are aria-hidden
      const skeletons = document.querySelectorAll('[aria-hidden="true"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows empty state when no identities', async () => {
      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('No identities yet')).toBeDefined()
      })
    })

    it('shows "Add your first identity" button in empty state', async () => {
      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('Add your first identity')).toBeDefined()
      })
    })

    it('renders identity list when data is available', async () => {
      const mocks = await getMocks()
      mocks.listIdentities.mockResolvedValue([
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          from_email: 'john@example.com',
          reply_to: '',
          is_default: true,
          signature_id: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeDefined()
        expect(screen.getByText('john@example.com')).toBeDefined()
      })
    })

    it('shows Default badge on default identity', async () => {
      const mocks = await getMocks()
      mocks.listIdentities.mockResolvedValue([
        {
          id: 1,
          name: 'Default User',
          email: 'user@example.com',
          from_email: 'user@example.com',
          reply_to: '',
          is_default: true,
          signature_id: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('Default')).toBeDefined()
      })
    })

    it('shows error state on fetch failure', async () => {
      const mocks = await getMocks()
      mocks.listIdentities.mockRejectedValue(new Error('fail'))

      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('Failed to load identities. Please try again.')).toBeDefined()
        expect(screen.getByRole('button', { name: /retry/i })).toBeDefined()
      })
    })

    it('retry button re-fetches identities', async () => {
      const mocks = await getMocks()
      mocks.listIdentities.mockRejectedValueOnce(new Error('fail'))
      mocks.listIdentities.mockResolvedValueOnce([])

      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('Failed to load identities. Please try again.')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /retry/i }))

      await waitFor(() => {
        expect(screen.getByText('No identities yet')).toBeDefined()
      })
    })

    it('Add Identity button opens create dialog', async () => {
      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('No identities yet')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /add your first identity/i }))

      await waitFor(() => {
        expect(screen.getByText('Add Identity', { selector: 'h2' })).toBeDefined()
      })
    })

    it('create dialog has Name, Email, and Reply-To fields', async () => {
      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('No identities yet')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /add your first identity/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeDefined()
        expect(screen.getByLabelText(/from email/i)).toBeDefined()
        expect(screen.getByLabelText(/reply-to/i)).toBeDefined()
      })
    })

    it('create dialog has Set as Default checkbox', async () => {
      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('No identities yet')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /add your first identity/i }))

      await waitFor(() => {
        expect(screen.getByText('Set as default identity')).toBeDefined()
      })
    })

    it('create dialog Cancel button closes it', async () => {
      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('No identities yet')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /add your first identity/i }))
      await waitFor(() => {
        expect(screen.getByText('Add Identity', { selector: 'h2' })).toBeDefined()
      })

      // Find the visible Cancel button in the open dialog
      const dialogTitle = screen.getByText('Add Identity', { selector: 'h2' })
      const dialog = dialogTitle.closest('div[role="dialog"]') as HTMLElement
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      // Trigger transitionend so the Dialog unmounts
      await waitFor(() => {
        const dialogWrapper = document.querySelector('div[role="dialog"]')
        if (dialogWrapper) {
          dialogWrapper.dispatchEvent(new Event('transitionend', { bubbles: true }))
        }
      })

      await waitFor(() => {
        expect(screen.queryByText('Add Identity', { selector: 'h2' })).toBeNull()
      })
    })

    it('edit button opens edit dialog with pre-filled fields', async () => {
      const mocks = await getMocks()
      mocks.listIdentities.mockResolvedValue([
        {
          id: 1,
          name: 'Edit Me',
          email: 'edit@example.com',
          from_email: 'edit@example.com',
          reply_to: 'reply@example.com',
          is_default: false,
          signature_id: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('Edit Me')).toBeDefined()
      })

      fireEvent.click(screen.getByLabelText('Edit Edit Me'))

      await waitFor(() => {
        expect(screen.getByText('Edit Identity')).toBeDefined()
        expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Edit Me')
        expect((screen.getByLabelText(/from email/i) as HTMLInputElement).value).toBe('edit@example.com')
        expect((screen.getByLabelText(/reply-to/i) as HTMLInputElement).value).toBe('reply@example.com')
      })
    })

    it('delete button opens confirmation dialog', async () => {
      const mocks = await getMocks()
      mocks.listIdentities.mockResolvedValue([
        {
          id: 1,
          name: 'Delete Me',
          email: 'del@example.com',
          from_email: 'del@example.com',
          reply_to: '',
          is_default: false,
          signature_id: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('Delete Me')).toBeDefined()
      })

      fireEvent.click(screen.getByLabelText('Delete Delete Me'))

      await waitFor(() => {
        expect(screen.getByText('Delete Identity')).toBeDefined()
        expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined()
      })
    })

    it('delete confirmation calls deleteIdentity and refreshes list', async () => {
      const mocks = await getMocks()
      // First call: return identity
      mocks.listIdentities.mockResolvedValueOnce([
        {
          id: 1,
          name: 'To Delete',
          email: 'del@example.com',
          from_email: 'del@example.com',
          reply_to: '',
          is_default: false,
          signature_id: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])
      // After deletion: return empty
      mocks.listIdentities.mockResolvedValueOnce([])
      mocks.deleteIdentity.mockResolvedValue(undefined as never)

      render(<Settings />)
      await waitFor(() => {
        expect(screen.getByText('To Delete')).toBeDefined()
      })

      fireEvent.click(screen.getByLabelText('Delete To Delete'))
      await waitFor(() => {
        expect(screen.getByText('Delete Identity')).toBeDefined()
      })

      // Click Delete button in confirmation dialog
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[deleteButtons.length - 1])

      await waitFor(() => {
        expect(mocks.deleteIdentity).toHaveBeenCalledWith(1)
      })
    })
  })

  describe('signatures tab', () => {
    it('switches to signatures tab and shows empty state', async () => {
      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('No signatures yet')).toBeDefined()
      })
    })

    it('shows loading skeleton initially', async () => {
      const mocks = await getMocks()
      mocks.listSignatures.mockImplementation(() => new Promise(() => {}))

      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      const skeletons = document.querySelectorAll('[aria-hidden="true"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders signature list when data is available', async () => {
      const mocks = await getMocks()
      mocks.listSignatures.mockResolvedValue([
        {
          id: 1,
          name: 'Work Signature',
          email: 'user@example.com',
          content: 'Best regards, John',
          is_default: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('Work Signature')).toBeDefined()
        expect(screen.getByText('Best regards, John')).toBeDefined()
      })
    })

    it('shows Default badge on default signature', async () => {
      const mocks = await getMocks()
      mocks.listSignatures.mockResolvedValue([
        {
          id: 1,
          name: 'Default Sig',
          email: 'user@example.com',
          content: 'Thanks',
          is_default: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        const badges = screen.getAllByText('Default')
        expect(badges.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows error state on fetch failure', async () => {
      const mocks = await getMocks()
      mocks.listSignatures.mockRejectedValue(new Error('fail'))

      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('Failed to load signatures. Please try again.')).toBeDefined()
      })
    })

    it('Add Signature button opens create dialog', async () => {
      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('No signatures yet')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /add your first signature/i }))

      await waitFor(() => {
        expect(screen.getByText('Add Signature', { selector: 'h2' })).toBeDefined()
      })
    })

    it('signature dialog has Name and Content fields', async () => {
      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('No signatures yet')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /add your first signature/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeDefined()
        expect(screen.getByTestId('signature-content-editor')).toBeDefined()
      })
    })

    it('signature dialog has Set as Default checkbox', async () => {
      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('No signatures yet')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /add your first signature/i }))

      await waitFor(() => {
        expect(screen.getByText('Set as default signature')).toBeDefined()
      })
    })

    it('edit button opens edit dialog with pre-filled fields', async () => {
      const mocks = await getMocks()
      mocks.listSignatures.mockResolvedValue([
        {
          id: 1,
          name: 'My Sig',
          email: 'user@example.com',
          content: 'Hello World',
          is_default: false,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('My Sig')).toBeDefined()
      })

      fireEvent.click(screen.getByLabelText('Edit My Sig'))

      await waitFor(() => {
        expect(screen.getByText('Edit Signature', { selector: 'h2' })).toBeDefined()
        expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('My Sig')
      })

      // Verify the editor wrapper is present (TipTap is lazy-loaded so we check the wrapper)
      await waitFor(() => {
        expect(screen.getByTestId('signature-content-editor')).toBeDefined()
      })
    })

    it('delete button opens confirmation dialog', async () => {
      const mocks = await getMocks()
      mocks.listSignatures.mockResolvedValue([
        {
          id: 1,
          name: 'Delete Sig',
          email: 'user@example.com',
          content: 'Bye',
          is_default: false,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('Delete Sig')).toBeDefined()
      })

      fireEvent.click(screen.getByLabelText('Delete Delete Sig'))

      await waitFor(() => {
        expect(screen.getByText('Delete Signature')).toBeDefined()
        expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined()
      })
    })

    it('truncates long signature content in list', async () => {
      const mocks = await getMocks()
      const longContent = 'A'.repeat(100)
      mocks.listSignatures.mockResolvedValue([
        {
          id: 1,
          name: 'Long Sig',
          email: 'user@example.com',
          content: longContent,
          is_default: false,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ])

      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        expect(screen.getByText('Long Sig')).toBeDefined()
        // Content should be truncated with ellipsis
        const truncatedContent = 'A'.repeat(80) + '…'
        expect(screen.getByText(truncatedContent)).toBeDefined()
      })
    })
  })

  describe('animation classes', () => {
    it('active tab has accent color class', () => {
      render(<Settings />)
      const identitiesTab = screen.getByRole('tab', { name: 'Identities' })
      expect(identitiesTab.className).toContain('text-[var(--color-accent)]')
    })

    it('inactive tab has secondary color class', async () => {
      render(<Settings />)
      fireEvent.click(screen.getByRole('tab', { name: 'Signatures' }))

      await waitFor(() => {
        const identitiesTab = screen.getByRole('tab', { name: 'Identities' })
        expect(identitiesTab.className).toContain('text-[var(--color-text-secondary)]')
      })
    })
  })
})

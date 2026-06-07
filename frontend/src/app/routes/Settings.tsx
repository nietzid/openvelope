import { useEffect, useState, useCallback, Suspense, lazy, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/primitives/Button'
import { Dialog } from '../../components/primitives/Dialog'
import { Skeleton } from '../../components/primitives/Skeleton'
import {
  listIdentities,
  createIdentity,
  updateIdentity,
  deleteIdentity,
  listSignatures,
  createSignature,
  updateSignature,
  deleteSignature,
} from '../../services/settings'
import { useAuthStore } from '../../stores/authStore'
import { easing } from '../../lib/motion'
import { useNotifications } from '../../hooks/useNotifications'
import type { Identity, Signature } from '../../types'

// ─── Tab Configuration ──────────────────────────────────────────────

type TabId = 'identities' | 'signatures' | 'notifications'

const TABS: { id: TabId; label: string }[] = [
  { id: 'identities', label: 'Identities' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'notifications', label: 'Notifications' },
]

// Lazy-load TipTap editor for code-splitting
const TipTapEditor = lazy(() => import('../../components/TipTapEditor'))

/**
 * Editor loading fallback shown while TipTap chunk loads.
 */
function EditorLoadingFallback() {
  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] min-h-[200px] p-[var(--space-4)] bg-[var(--color-surface)] flex items-center justify-center">
      <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-sm">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading editor…
      </div>
    </div>
  )
}

/**
 * Simple error boundary to catch TipTap lazy-load failures.
 */
interface ErrorBoundaryEditorProps {
  onError: () => void
  children: React.ReactNode
}

interface ErrorBoundaryEditorState {
  hasError: boolean
}

class ErrorBoundaryEditor extends Component<ErrorBoundaryEditorProps, ErrorBoundaryEditorState> {
  state: ErrorBoundaryEditorState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryEditorState {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  componentDidUpdate(prevProps: ErrorBoundaryEditorProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

// ─── Main Component ─────────────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)

  // Redirect to login if token cleared
  useEffect(() => {
    if (!accessToken) {
      navigate('/login', { replace: true })
    }
  }, [accessToken, navigate])

  const [activeTab, setActiveTab] = useState<TabId>('identities')

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[var(--color-bg)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)] shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/mailbox')}
          aria-label="Back to mailbox"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Button>
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Settings</h1>
      </header>

      {/* Tab bar */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]" role="tablist" aria-label="Settings sections">
        <div className="flex px-4 gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tab-panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'relative px-4 py-3 text-sm font-medium',
                'min-h-[44px] min-w-[44px]',
                'transition-colors',
                `duration-[150ms]`,
                `[transition-timing-function:${easing.outExpo}]`,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
                activeTab === tab.id
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-accent)]"
                  style={{
                    animation: 'settings-tab-indicator 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <style>{`
          @keyframes settings-tab-indicator {
            from { opacity: 0; transform: scaleX(0.5); }
            to { opacity: 1; transform: scaleX(1); }
          }
        `}</style>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'identities' && <IdentitiesTab />}
        {activeTab === 'signatures' && <SignaturesTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  )
}

// ─── Identities Tab ─────────────────────────────────────────────────

function IdentitiesTab() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState<Identity | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingIdentity, setDeletingIdentity] = useState<Identity | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formReplyTo, setFormReplyTo] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)

  const fetchIdentities = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listIdentities()
      setIdentities(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load identities. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIdentities()
  }, [fetchIdentities])

  const handleOpenCreate = useCallback(() => {
    setEditingIdentity(null)
    setFormName('')
    setFormEmail('')
    setFormReplyTo('')
    setFormIsDefault(false)
    setFormError(null)
    setDialogOpen(true)
  }, [])

  const handleOpenEdit = useCallback((identity: Identity) => {
    setEditingIdentity(identity)
    setFormName(identity.name)
    setFormEmail(identity.from_email)
    setFormReplyTo(identity.reply_to)
    setFormIsDefault(identity.is_default)
    setFormError(null)
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formEmail.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      const payload: Partial<Identity> = {
        name: formName.trim(),
        from_email: formEmail.trim(),
        reply_to: formReplyTo.trim(),
        is_default: formIsDefault,
      }
      if (editingIdentity) {
        await updateIdentity(editingIdentity.id, payload)
      } else {
        await createIdentity(payload)
      }
      setDialogOpen(false)
      await fetchIdentities()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save identity. Please try again.'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }, [editingIdentity, formName, formEmail, formReplyTo, formIsDefault, fetchIdentities])

  const handleOpenDelete = useCallback((identity: Identity) => {
    setDeletingIdentity(identity)
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingIdentity) return
    try {
      await deleteIdentity(deletingIdentity.id)
      setDeleteDialogOpen(false)
      setDeletingIdentity(null)
      await fetchIdentities()
    } catch {
      // Error is silent
    }
  }, [deletingIdentity, fetchIdentities])

  if (loading) {
    return (
      <div className="p-[var(--space-6)] space-y-[var(--space-4)]">
        <div className="flex items-center justify-between mb-[var(--space-4)]">
          <Skeleton width="120px" height="24px" />
          <Skeleton width="100px" height="40px" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <Skeleton width="40px" height="40px" className="rounded-full shrink-0" />
            <div className="flex-1 space-y-[var(--space-2)]">
              <Skeleton width="60%" height="16px" />
              <Skeleton width="40%" height="14px" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-[var(--space-6)] flex flex-col items-center justify-center gap-[var(--space-4)] min-h-[200px]">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchIdentities}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="p-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[var(--space-6)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Identities</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage sender identities for your emails
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenCreate}>
          Add Identity
        </Button>
      </div>

      {/* Empty state */}
      {identities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-[var(--space-3)] py-[var(--space-12)] text-center">
          <div className="h-12 w-12 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
            <svg className="h-6 w-6 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">No identities yet</p>
          <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
            Add your first identity
          </Button>
        </div>
      ) : (
        <div className="space-y-[var(--space-2)]">
          {identities.map((identity) => (
            <div
              key={identity.id}
              className="flex items-center gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] transition-colors"
            >
              {/* Avatar */}
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-semibold">
                {identity.name ? identity.name.charAt(0).toUpperCase() : '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {identity.name}
                  </span>
                  {identity.is_default && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {identity.from_email}
                  {identity.reply_to && (
                    <> · Reply-To: {identity.reply_to}</>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(identity)}
                  aria-label={`Edit ${identity.name}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDelete(identity)}
                  aria-label={`Delete ${identity.name}`}
                >
                  <svg className="h-4 w-4 text-[var(--color-error)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingIdentity ? 'Edit Identity' : 'Add Identity'}
        labelId="identity-dialog-title"
      >
        <div className="flex flex-col gap-[var(--space-4)]">
          {/* Name */}
          <div className="flex flex-col gap-[var(--space-1)]">
            <label
              htmlFor="identity-name"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Name <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="identity-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* From Email */}
          <div className="flex flex-col gap-[var(--space-1)]">
            <label
              htmlFor="identity-email"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              From Email <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="identity-email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Reply-To */}
          <div className="flex flex-col gap-[var(--space-1)]">
            <label
              htmlFor="identity-reply-to"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Reply-To
            </label>
            <input
              id="identity-reply-to"
              type="email"
              value={formReplyTo}
              onChange={(e) => setFormReplyTo(e.target.value)}
              placeholder="reply@example.com (optional)"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Set as Default */}
          <label className="flex items-center gap-[var(--space-2)] cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={formIsDefault}
              onChange={(e) => setFormIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <span className="text-sm text-[var(--color-text-primary)]">Set as default identity</span>
          </label>

          {formError && <p className="text-sm text-[var(--color-error)]" role="alert">{formError}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-[var(--space-3)] pt-[var(--space-2)]">
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
              disabled={!formName.trim() || !formEmail.trim()}
            >
              {editingIdentity ? 'Save Changes' : 'Create Identity'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Identity"
        labelId="delete-identity-dialog-title"
      >
        <div className="flex flex-col gap-[var(--space-4)]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Are you sure you want to delete <strong className="text-[var(--color-text-primary)]">{deletingIdentity?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-[var(--space-3)]">
            <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

// ─── Signatures Tab ─────────────────────────────────────────────────

function SignaturesTab() {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSignature, setEditingSignature] = useState<Signature | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSignature, setDeletingSignature] = useState<Signature | null>(null)
  const [saving, setSaving] = useState(false)
  const [editorLoadError, setEditorLoadError] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)

  const fetchSignatures = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listSignatures()
      setSignatures(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load signatures. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSignatures()
  }, [fetchSignatures])

  const handleOpenCreate = useCallback(() => {
    setEditingSignature(null)
    setFormName('')
    setFormContent('')
    setFormIsDefault(false)
    setEditorLoadError(false)
    setFormError(null)
    setDialogOpen(true)
  }, [])

  const handleOpenEdit = useCallback((sig: Signature) => {
    setEditingSignature(sig)
    setFormName(sig.name)
    setFormContent(sig.content)
    setFormIsDefault(sig.is_default)
    setEditorLoadError(false)
    setFormError(null)
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback(async () => {
    // Strip HTML tags to check for actual content
    const strippedContent = formContent.replace(/<[^>]*>/g, '').trim()
    if (!formName.trim() || !strippedContent) return
    setSaving(true)
    setFormError(null)
    try {
      const payload: Partial<Signature> = {
        name: formName.trim(),
        content: formContent.trim(),
        is_default: formIsDefault,
      }
      if (editingSignature) {
        await updateSignature(editingSignature.id, payload)
      } else {
        await createSignature(payload)
      }
      setDialogOpen(false)
      await fetchSignatures()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save signature. Please try again.'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }, [editingSignature, formName, formContent, formIsDefault, fetchSignatures])

  const handleOpenDelete = useCallback((sig: Signature) => {
    setDeletingSignature(sig)
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingSignature) return
    try {
      await deleteSignature(deletingSignature.id)
      setDeleteDialogOpen(false)
      setDeletingSignature(null)
      await fetchSignatures()
    } catch {
      // Error is silent
    }
  }, [deletingSignature, fetchSignatures])

  if (loading) {
    return (
      <div className="p-[var(--space-6)] space-y-[var(--space-4)]">
        <div className="flex items-center justify-between mb-[var(--space-4)]">
          <Skeleton width="140px" height="24px" />
          <Skeleton width="110px" height="40px" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <Skeleton width="50%" height="16px" className="mb-[var(--space-2)]" />
            <Skeleton width="80%" height="14px" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-[var(--space-6)] flex flex-col items-center justify-center gap-[var(--space-4)] min-h-[200px]">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchSignatures}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="p-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[var(--space-6)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Signatures</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage email signatures
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenCreate}>
          Add Signature
        </Button>
      </div>

      {/* Empty state */}
      {signatures.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-[var(--space-3)] py-[var(--space-12)] text-center">
          <div className="h-12 w-12 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
            <svg className="h-6 w-6 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">No signatures yet</p>
          <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
            Add your first signature
          </Button>
        </div>
      ) : (
        <div className="space-y-[var(--space-2)]">
          {signatures.map((sig) => (
            <div
              key={sig.id}
              className="flex items-center gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] transition-colors"
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {sig.name}
                  </span>
                  {sig.is_default && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                  {sig.content.length > 80 ? `${sig.content.slice(0, 80)}…` : sig.content}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(sig)}
                  aria-label={`Edit ${sig.name}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDelete(sig)}
                  aria-label={`Delete ${sig.name}`}
                >
                  <svg className="h-4 w-4 text-[var(--color-error)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingSignature ? 'Edit Signature' : 'Add Signature'}
        labelId="signature-dialog-title"
      >
        <div className="flex flex-col gap-[var(--space-4)]">
          {/* Name */}
          <div className="flex flex-col gap-[var(--space-1)]">
            <label
              htmlFor="signature-name"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Name <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="signature-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Work Signature"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-[var(--space-1)]">
            <label
              htmlFor="signature-content"
              id="signature-content-label"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Content <span className="text-[var(--color-error)]">*</span>
            </label>
            {editorLoadError ? (
              <div className="border border-[var(--color-error)] rounded-[var(--radius-md)] min-h-[200px] p-[var(--space-4)] bg-[var(--color-surface)] flex flex-col items-center justify-center gap-[var(--space-3)]">
                <p className="text-sm text-[var(--color-error)]">Failed to load editor.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditorLoadError(false)}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <div
                id="signature-content"
                role="textbox"
                aria-labelledby="signature-content-label"
                aria-multiline="true"
                data-testid="signature-content-editor"
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <ErrorBoundaryEditor onError={() => setEditorLoadError(true)}>
                  <Suspense fallback={<EditorLoadingFallback />}>
                    <TipTapEditor
                      initialContent={formContent}
                      onChange={setFormContent}
                    />
                  </Suspense>
                </ErrorBoundaryEditor>
              </div>
            )}
          </div>

          {/* Set as Default */}
          <label className="flex items-center gap-[var(--space-2)] cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={formIsDefault}
              onChange={(e) => setFormIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <span className="text-sm text-[var(--color-text-primary)]">Set as default signature</span>
          </label>

          {formError && <p className="text-sm text-[var(--color-error)]" role="alert">{formError}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-[var(--space-3)] pt-[var(--space-2)]">
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
              disabled={!formName.trim() || !formContent.replace(/<[^>]*>/g, '').trim()}
            >
              {editingSignature ? 'Save Changes' : 'Create Signature'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Signature"
        labelId="delete-signature-dialog-title"
      >
        <div className="flex flex-col gap-[var(--space-4)]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Are you sure you want to delete <strong className="text-[var(--color-text-primary)]">{deletingSignature?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-[var(--space-3)]">
            <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

// ─── Notifications Tab ──────────────────────────────────────────────

function NotificationsTab() {
  const { enabled, setEnabled, permission, requestPermission } = useNotifications()

  const permissionLabel =
    permission === 'unsupported'
      ? 'Not supported in this browser'
      : permission === 'granted'
        ? 'Granted'
        : permission === 'denied'
          ? 'Denied'
          : 'Not yet requested'

  const permissionColor =
    permission === 'granted'
      ? 'text-[var(--color-accent)]'
      : permission === 'denied'
        ? 'text-[var(--color-error)]'
        : 'text-[var(--color-text-secondary)]'

  return (
    <div className="p-[var(--space-6)]">
      {/* Header */}
      <div className="mb-[var(--space-6)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Notifications</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          Configure how you are notified about new messages
        </p>
      </div>

      {/* Notification settings */}
      <div className="space-y-[var(--space-4)]">
        {/* Enable/Disable notifications */}
        <div className="flex items-center justify-between p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              New message notifications
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Show browser notifications or toast alerts when new messages arrive
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle new message notifications"
            onClick={() => setEnabled(!enabled)}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              'min-h-[44px] min-w-[44px] items-center justify-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
            ].join(' ')}
          >
            <span className="sr-only">Toggle notifications</span>
            <span
              aria-hidden="true"
              className={[
                'pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-sm ring-0 transition-transform duration-200',
                enabled
                  ? 'translate-x-6 bg-[var(--color-accent)]'
                  : 'translate-x-0 bg-[var(--color-text-secondary)]',
              ].join(' ')}
            />
          </button>
        </div>

        {/* Browser permission status */}
        <div className="flex items-center justify-between p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Browser notification permission
            </p>
            <p className="text-xs mt-0.5">
              <span className={`font-medium ${permissionColor}`}>{permissionLabel}</span>
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Browser notifications appear when the tab is in the background
            </p>
          </div>
          {permission === 'default' && (
            <Button variant="secondary" size="sm" onClick={requestPermission}>
              Allow
            </Button>
          )}
        </div>

        {/* Info box */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-secondary)]">
            {enabled
              ? 'When enabled, you will receive in-app toast notifications when the tab is visible, and browser notifications when it is in the background.'
              : 'Notifications are currently disabled. You can re-enable them at any time.'}
          </p>
        </div>
      </div>
    </div>
  )
}

import { useState, useCallback, useRef, Suspense, lazy, useEffect } from 'react'
import { Dialog } from '../primitives/Dialog'
import { Button } from '../primitives/Button'
import { useUIStore } from '../../stores/uiStore'
import { sendEmail, uploadAttachment } from '../../services/compose'
import { listIdentities, listSignatures } from '../../services/settings'
import { autocompleteContacts } from '../../services/contacts'
import { getMessageHeaders } from '../../services/messages'
import { formatSize } from '../../lib/format'
import { easing, duration } from '../../lib/motion'
import type { AttachmentUpload, ContactAutocompleteItem, Identity, Signature, MessageHeaders } from '../../types'

// Lazy-load TipTap editor for code-splitting
const TipTapEditor = lazy(() => import('../TipTapEditor'))

/** Maximum file size: 25MB */
const MAX_FILE_SIZE = 26_214_400
/** Maximum number of attachments */
const MAX_ATTACHMENTS = 10

/**
 * Prefixes subject with the given prefix, avoiding double-prefixing.
 * e.g., prefixSubject('Re: ', 'Re: Hello') => 'Re: Hello' (no double)
 */
function prefixSubject(prefix: string, subject: string): string {
  if (subject.toLowerCase().startsWith(prefix.toLowerCase())) {
    return subject
  }
  return `${prefix}${subject}`
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

/**
 * Formats a date string for reply attribution.
 */
function formatDateAttribution(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Builds the initial editor HTML content for reply mode.
 * Attribution: "On [date], [sender] wrote:" followed by blockquoted original body.
 */
function buildReplyBody(originalBody: string, from?: string, date?: string): string {
  const sender = from ? escapeHtml(from) : 'the sender'
  const dateStr = date ? formatDateAttribution(date) : 'an earlier date'
  const attribution = `<p>On ${dateStr}, ${sender} wrote:</p>`
  return `<br/>${attribution}<blockquote data-reply-quote="true" contenteditable="false" style="border-left: 3px solid var(--color-border, #ccc); padding-left: 12px; margin: 8px 0 0 0; color: var(--color-text-secondary, #666);">${originalBody}</blockquote>`
}

/**
 * Builds the initial editor HTML content for forward mode.
 * Includes a forwarded message header with From, Date, Subject, To fields.
 */
function buildForwardBody(originalBody: string, from?: string, date?: string, subject?: string, to?: string): string {
  const dateStr = date ? formatDateAttribution(date) : ''
  const header = [
    '---------- Forwarded message ---------',
    from ? `From: ${escapeHtml(from)}` : '',
    dateStr ? `Date: ${dateStr}` : '',
    subject ? `Subject: ${escapeHtml(subject)}` : '',
    to ? `To: ${escapeHtml(to)}` : '',
  ].filter(Boolean).join('<br/>')
  return `<br/><div data-forward-header="true" contenteditable="false" style="color: var(--color-text-secondary, #666); font-size: 0.9em;">${header}</div><br/>${originalBody}`
}

interface AttachmentItem {
  file: File
  upload: AttachmentUpload | null
  uploading: boolean
  error: string | null
}

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
 * ComposeDialog — full-featured compose/reply/forward dialog.
 *
 * Uses the Dialog primitive for open/close animations and focus trap.
 * Reads compose state from uiStore and closes via uiStore.closeCompose().
 */
export function ComposeDialog() {
  const { composeOpen, composeMode, composeReplyTo, closeCompose } = useUIStore()

  // Form state
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [editorLoadError, setEditorLoadError] = useState(false)

  // Identity state
  const [identities, setIdentities] = useState<Identity[]>([])
  const [selectedIdentityId, setSelectedIdentityId] = useState<number | null>(null)
  const [identitiesLoading, setIdentitiesLoading] = useState(false)

  // Signature state
  const [signatures, setSignatures] = useState<Signature[]>([])

  // Contact autocomplete state
  const [autocompleteResults, setAutocompleteResults] = useState<ContactAutocompleteItem[]>([])
  const [autocompleteOpen, setAutocompleteOpen] = useState(false)
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [autocompleteActiveIndex, setAutocompleteActiveIndex] = useState(-1)
  const toInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef<string | null>(null)

  // Derive initial values based on mode whenever compose opens
  const composeKey = composeOpen ? `${composeMode}-${composeReplyTo?.subject ?? ''}` : null

  if (composeOpen && composeKey !== initializedRef.current) {
    initializedRef.current = composeKey

    if (composeMode === 'reply' && composeReplyTo) {
      setTo(composeReplyTo.to)
      setSubject(prefixSubject('Re: ', composeReplyTo.subject))
      // Set initial body without headers; will be updated asynchronously
      setBodyHtml(buildReplyBody(composeReplyTo.body))
    } else if (composeMode === 'forward' && composeReplyTo) {
      setTo('')
      setSubject(prefixSubject('Fwd: ', composeReplyTo.subject))
      // Set initial body without headers; will be updated asynchronously
      setBodyHtml(buildForwardBody(composeReplyTo.body))
    } else {
      setTo('')
      setSubject('')
      setBodyHtml('')
    }

    setAttachments([])
    setSending(false)
    setSendError(null)
    setAttachError(null)
    setEditorLoadError(false)
  }

  // Fetch message headers asynchronously and rebuild body with attribution
  useEffect(() => {
    if (!composeOpen || !composeReplyTo || (composeMode !== 'reply' && composeMode !== 'forward')) return
    const { uid, folder } = composeReplyTo
    if (uid == null || !folder) return

    let cancelled = false
    getMessageHeaders(folder, uid)
      .then((headers: MessageHeaders) => {
        if (cancelled) return
        if (composeMode === 'reply') {
          setBodyHtml(buildReplyBody(composeReplyTo.body, headers.from, headers.date))
        } else if (composeMode === 'forward') {
          setBodyHtml(buildForwardBody(composeReplyTo.body, headers.from, headers.date, headers.subject, headers.to))
        }
      })
      .catch(() => {
        // Headers fetch failed; keep the fallback body without attribution
      })
    return () => { cancelled = true }
  }, [composeOpen, composeMode, composeReplyTo])

  // Fetch identities and signatures when compose dialog opens
  useEffect(() => {
    if (!composeOpen) return
    let cancelled = false
    setIdentitiesLoading(true)
    Promise.all([
      listIdentities().catch(() => []),
      listSignatures().catch(() => []),
    ]).then(([identityData, signatureData]) => {
      if (cancelled) return
      const list = Array.isArray(identityData) ? identityData : []
      setIdentities(list)
      const defaultIdentity = list.find((i: Identity) => i.is_default)
      setSelectedIdentityId(defaultIdentity?.id ?? list[0]?.id ?? null)

      const sigList = Array.isArray(signatureData) ? signatureData : []
      setSignatures(sigList)

      // For new messages, append default signature if available
      if (composeMode === 'new' && defaultIdentity?.signature_id) {
        const defaultSig = sigList.find((s: Signature) => s.id === defaultIdentity.signature_id && s.content)
        if (defaultSig) {
          setBodyHtml((prev) => {
            if (prev.trim()) return prev
            return '<br/><br/>' + defaultSig.content
          })
        }
      }
    }).catch(() => {
      if (!cancelled) {
        setIdentities([])
        setSelectedIdentityId(null)
        setSignatures([])
      }
    }).finally(() => {
      if (!cancelled) setIdentitiesLoading(false)
    })
    return () => { cancelled = true }
  }, [composeOpen, composeMode])

  // Reset state when dialog closes
  const handleClose = useCallback(() => {
    initializedRef.current = null
    closeCompose()
  }, [closeCompose])

  // Check if any attachment is currently uploading
  const isUploading = attachments.some((a) => a.uploading)

  // Handle file selection
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      setAttachError(null)

      const newFiles = Array.from(files)

      // Check max count
      if (attachments.length + newFiles.length > MAX_ATTACHMENTS) {
        setAttachError(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      // Validate sizes
      for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE) {
          setAttachError(`"${file.name}" exceeds 25 MB limit.`)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }
      }

      // Create attachment items and start uploads
      const newItems: AttachmentItem[] = newFiles.map((file) => ({
        file,
        upload: null,
        uploading: true,
        error: null,
      }))

      setAttachments((prev) => [...prev, ...newItems])

      // Upload each file
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        try {
          const result = await uploadAttachment(file)
          setAttachments((prev) =>
            prev.map((item) =>
              item.file === file ? { ...item, upload: result, uploading: false } : item,
            ),
          )
        } catch {
          setAttachments((prev) =>
            prev.map((item) =>
              item.file === file
                ? { ...item, uploading: false, error: 'Upload failed' }
                : item,
            ),
          )
        }
      }

      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [attachments.length],
  )

  // Remove an attachment
  const removeAttachment = useCallback((file: File) => {
    setAttachments((prev) => prev.filter((a) => a.file !== file))
  }, [])

  // Contact autocomplete — debounced search
  const handleToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTo(value)
    setAutocompleteActiveIndex(-1)

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Extract the last segment after comma for search query
    const segments = value.split(',').map((s) => s.trim())
    const lastSegment = segments[segments.length - 1] ?? ''

    if (lastSegment.length < 2) {
      setAutocompleteResults([])
      setAutocompleteOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      setAutocompleteLoading(true)
      setAutocompleteOpen(true)
      autocompleteContacts(lastSegment)
        .then((results) => {
          setAutocompleteResults(Array.isArray(results) ? results : [])
        })
        .catch(() => {
          setAutocompleteResults([])
          setAutocompleteOpen(false)
        })
        .finally(() => setAutocompleteLoading(false))
    }, 300)
  }, [])

  // Select an autocomplete contact
  const selectContact = useCallback((contact: ContactAutocompleteItem) => {
    const segments = to.split(',').map((s) => s.trim())
    // Replace last segment with the selected contact
    segments[segments.length - 1] = `${contact.display_name} <${contact.email_addr}>`
    setTo(segments.join(', '))
    setAutocompleteResults([])
    setAutocompleteOpen(false)
    setAutocompleteActiveIndex(-1)
    toInputRef.current?.focus()
  }, [to])

  // Keyboard navigation for autocomplete
  const handleToKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!autocompleteOpen || autocompleteResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setAutocompleteActiveIndex((prev) =>
          prev < autocompleteResults.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setAutocompleteActiveIndex((prev) =>
          prev > 0 ? prev - 1 : autocompleteResults.length - 1
        )
        break
      case 'Enter':
        if (autocompleteActiveIndex >= 0 && autocompleteActiveIndex < autocompleteResults.length) {
          e.preventDefault()
          selectContact(autocompleteResults[autocompleteActiveIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setAutocompleteOpen(false)
        setAutocompleteActiveIndex(-1)
        break
    }
  }, [autocompleteOpen, autocompleteResults, autocompleteActiveIndex, selectContact])

  // Close autocomplete on click outside
  useEffect(() => {
    if (!autocompleteOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node) &&
        toInputRef.current &&
        !toInputRef.current.contains(e.target as Node)
      ) {
        setAutocompleteOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [autocompleteOpen])

  // Close autocomplete on blur (with delay to allow click selection)
  const handleToBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setAutocompleteOpen(false)
      setAutocompleteActiveIndex(-1)
    }, 200)
  }, [])

  // Cleanup debounce/blur timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  // Send email
  const handleSend = useCallback(async () => {
    setSendError(null)
    setSending(true)

    try {
      const uploadedAttachments = attachments
        .filter((a) => a.upload !== null)
        .map((a) => a.upload!)

      await sendEmail({
        to: to
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        subject,
        body: bodyHtml,
        is_html: true,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      })

      // Success — close dialog
      handleClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email. Please try again.'
      setSendError(message)
      setSending(false)
    }
  }, [to, subject, bodyHtml, attachments, handleClose])

  // Determine dialog title
  const dialogTitle =
    composeMode === 'reply'
      ? 'Reply'
      : composeMode === 'forward'
        ? 'Forward'
        : 'New Message'

  return (
    <Dialog open={composeOpen} onClose={handleClose} title={dialogTitle} labelId="compose-dialog-title">
      <div className="flex flex-col gap-[var(--space-4)]">
        {/* From dropdown (identity selector) */}
        {identities.length > 0 && (
          <div className="flex flex-col gap-[var(--space-1)]">
            <label
              htmlFor="compose-from"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              From
            </label>
            <select
              id="compose-from"
              value={selectedIdentityId ?? ''}
              onChange={(e) => setSelectedIdentityId(Number(e.target.value))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]"
              disabled={sending}
            >
              {identities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  {identity.name} &lt;{identity.from_email}&gt;
                </option>
              ))}
            </select>
          </div>
        )}

        {/* To field with autocomplete */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="compose-to"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            To
          </label>
          <div className="relative">
            <input
              ref={toInputRef}
              id="compose-to"
              type="text"
              value={to}
              onChange={handleToChange}
              onKeyDown={handleToKeyDown}
              onBlur={handleToBlur}
              onFocus={() => {
                if (autocompleteResults.length > 0) setAutocompleteOpen(true)
              }}
              placeholder="recipient@example.com"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              disabled={sending}
              role="combobox"
              aria-expanded={autocompleteOpen}
              aria-controls="compose-to-autocomplete-list"
              aria-activedescendant={
                autocompleteActiveIndex >= 0 ? `compose-to-option-${autocompleteActiveIndex}` : undefined
              }
              aria-autocomplete="list"
            />
            {/* Autocomplete dropdown */}
            {autocompleteOpen && (
              <div
                ref={autocompleteRef}
                id="compose-to-autocomplete-list"
                role="listbox"
                aria-label="Contact suggestions"
                className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-md)] overflow-hidden"
                style={{
                  animation: `autocomplete-enter ${duration.normal}ms ${easing.outExpo} forwards`,
                }}
              >
                <style>{`
                  @keyframes autocomplete-enter {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                {autocompleteLoading ? (
                  <div className="flex items-center justify-center gap-2 p-[var(--space-3)] text-sm text-[var(--color-text-secondary)]">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching…
                  </div>
                ) : autocompleteResults.length === 0 ? (
                  <div className="p-[var(--space-3)] text-sm text-[var(--color-text-secondary)] text-center">
                    No contacts found
                  </div>
                ) : (
                  autocompleteResults.map((contact, index) => (
                    <div
                      key={contact.id}
                      id={`compose-to-option-${index}`}
                      role="option"
                      aria-selected={index === autocompleteActiveIndex}
                      className={`flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)] cursor-pointer transition-colors ${
                        index === autocompleteActiveIndex
                          ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'hover:bg-[var(--color-border)]/50 text-[var(--color-text-primary)]'
                      }`}
                      style={{ minHeight: '44px' }}
                      onMouseDown={(e) => {
                        // Prevent blur before click registers
                        e.preventDefault()
                        selectContact(contact)
                      }}
                      onMouseEnter={() => setAutocompleteActiveIndex(index)}
                    >
                      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-semibold">
                        {contact.display_name ? contact.display_name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{contact.display_name}</div>
                        <div className="text-xs text-[var(--color-text-secondary)] truncate">{contact.email_addr}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Subject field */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="compose-subject"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Subject
          </label>
          <input
            id="compose-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            disabled={sending}
          />
        </div>

        {/* Rich text editor (lazy-loaded) */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">Body</span>
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
            <ErrorBoundaryEditor onError={() => setEditorLoadError(true)}>
              <Suspense fallback={<EditorLoadingFallback />}>
                <TipTapEditor
                  initialContent={bodyHtml}
                  onChange={setBodyHtml}
                />
              </Suspense>
            </ErrorBoundaryEditor>
          )}
        </div>

        {/* Attachments */}
        <div className="flex flex-col gap-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || attachments.length >= MAX_ATTACHMENTS}
            >
              Attach files
            </Button>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {attachments.length}/{MAX_ATTACHMENTS} · Max 25 MB each
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            aria-label="Attach files"
          />

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-[var(--space-2)]" role="list" aria-label="Attachments">
              {attachments.map((item) => (
                <div
                  key={item.file.name + item.file.size}
                  role="listitem"
                  className="inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-1)] text-xs text-[var(--color-text-primary)]"
                >
                  {item.uploading && (
                    <svg className="h-3 w-3 animate-spin text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  <span className="max-w-[120px] truncate">{item.file.name}</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {formatSize(item.file.size)}
                  </span>
                  {item.error && (
                    <span className="text-[var(--color-error)]">{item.error}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(item.file)}
                    className="ml-1 rounded-full p-0.5 hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                    aria-label={`Remove ${item.file.name}`}
                    disabled={sending}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attachment validation error */}
          {attachError && (
            <p className="text-xs text-[var(--color-error)]" role="alert">
              {attachError}
            </p>
          )}
        </div>

        {/* Send error */}
        {sendError && (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {sendError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-[var(--space-3)] pt-[var(--space-2)]">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            loading={sending}
            disabled={sending || isUploading || !to.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

ComposeDialog.displayName = 'ComposeDialog'

/**
 * Simple error boundary to catch TipTap lazy-load failures.
 */
import { Component } from 'react'

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
    // Reset boundary when parent retries (editorLoadError toggled back to false)
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return null // Parent handles the error UI
    }
    return this.props.children
  }
}

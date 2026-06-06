import { useEffect, useRef, useState } from 'react'
import PostalMime, { type Address, type Mailbox } from 'postal-mime'
import { useMailboxStore } from '../../stores/mailboxStore'
import { useUIStore } from '../../stores/uiStore'
import {
  getMessage,
  listAttachments,
  downloadAttachment,
  updateFlags,
} from '../../services/messages'
import { sanitize } from '../../lib/sanitize'
import { formatSize } from '../../lib/format'
import { Skeleton } from '../primitives/Skeleton'
import { Button } from '../primitives/Button'
import type { AttachmentInfo, MessageSummary } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ParsedEmail {
  from: string
  to: string
  cc: string
  subject: string
  date: string
  html: string
  text: string
}

function isMailbox(addr: Address): addr is Mailbox {
  return addr.address !== undefined
}

function formatMailbox(m: Mailbox): string {
  if (m.name && m.address) return `${m.name} <${m.address}>`
  return m.address || m.name || ''
}

function formatAddress(addr: Address | undefined): string {
  if (!addr) return ''
  if (isMailbox(addr)) return formatMailbox(addr)
  return addr.group.map(formatMailbox).join(', ')
}

function formatAddressList(list: Address[] | undefined): string {
  if (!list || list.length === 0) return ''
  return list.map(formatAddress).join(', ')
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

// ─── Loading State ────────────────────────────────────────────────────────────

function MessageViewSkeleton() {
  return (
    <section className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg)] p-6">
      <div className="space-y-3 mb-6">
        <Skeleton width="60%" height={24} />
        <Skeleton width="40%" height={16} />
        <Skeleton width="35%" height={16} />
        <Skeleton width="30%" height={16} />
      </div>
      <div className="space-y-2 flex-1">
        <Skeleton width="100%" height={14} />
        <Skeleton width="95%" height={14} />
        <Skeleton width="88%" height={14} />
        <Skeleton width="92%" height={14} />
        <Skeleton width="70%" height={14} />
      </div>
    </section>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function MessageViewEmpty() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center min-w-0 bg-[var(--color-bg)]">
      <p className="text-[var(--color-text-secondary)] text-base">
        Select a message to read
      </p>
    </section>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

function MessageViewError({ message }: { message: string }) {
  return (
    <section className="flex-1 flex flex-col items-center justify-center min-w-0 bg-[var(--color-bg)]">
      <p className="text-[var(--color-error)] text-sm">{message}</p>
    </section>
  )
}

// ─── Message Body ─────────────────────────────────────────────────────────────

interface MessageBodyProps {
  folder: string
  uid: number
  summary: MessageSummary | undefined
}

function MessageBody({ folder, uid, summary }: MessageBodyProps) {
  const [parsed, setParsed] = useState<ParsedEmail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([])
  const [animateIn, setAnimateIn] = useState(false)
  const containerRef = useRef<HTMLElement>(null)

  const setCurrentMessage = useMailboxStore((s) => s.setCurrentMessage)
  const setCurrentMessageText = useMailboxStore((s) => s.setCurrentMessageText)
  const updateMessageFlags = useMailboxStore((s) => s.updateMessageFlags)
  const openCompose = useUIStore((s) => s.openCompose)

  // Trigger enter animation after mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimateIn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    let cancelled = false
    setCurrentMessage(null)
    setCurrentMessageText(null)
    setParsed(null)
    setError(null)

    void (async () => {
      // Load attachments in parallel
      listAttachments(folder, uid)
        .then((atts) => {
          if (!cancelled) setAttachments(atts)
        })
        .catch(() => {
          if (!cancelled) setAttachments([])
        })

      let rfc822: string
      try {
        rfc822 = await getMessage(folder, uid)
      } catch {
        if (cancelled) return
        setError('Failed to load message')
        return
      }
      if (cancelled) return
      setCurrentMessage(rfc822)

      // Mark as seen
      if (!summary?.flags.seen) {
        updateFlags(folder, [uid], 'seen', true).catch(() => {})
        updateMessageFlags(uid, { seen: true })
      }

      try {
        const parser = new PostalMime()
        const email = await parser.parse(rfc822)
        if (cancelled) return

        const rawHtml = email.html || ''
        const safeHtml = rawHtml ? sanitize(rawHtml) : ''

        const result: ParsedEmail = {
          from: formatAddress(email.from) || summary?.from || '',
          to: formatAddressList(email.to) || summary?.to || '',
          cc: formatAddressList(email.cc),
          subject: email.subject || summary?.subject || '',
          date: email.date || summary?.date || '',
          html: safeHtml,
          text: email.text || '',
        }
        setParsed(result)
        setCurrentMessageText({ html: safeHtml, text: email.text || '' })
      } catch {
        if (cancelled) return
        setParsed({
          from: summary?.from || '',
          to: summary?.to || '',
          cc: '',
          subject: summary?.subject || '',
          date: summary?.date || '',
          html: '',
          text: rfc822,
        })
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, uid])

  const handleDownload = async (att: AttachmentInfo) => {
    try {
      const blob = await downloadAttachment(folder, uid, att.part_id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download attachment', err)
    }
  }

  const handleReply = () => {
    if (!parsed) return
    openCompose('reply', {
      to: parsed.from,
      subject: parsed.subject,
      body: parsed.html || parsed.text,
    })
  }

  const handleForward = () => {
    if (!parsed) return
    openCompose('forward', {
      to: '',
      subject: parsed.subject,
      body: parsed.html || parsed.text,
    })
  }

  if (error) {
    return <MessageViewError message={error} />
  }

  if (!parsed) {
    return <MessageViewSkeleton />
  }

  return (
    <section
      ref={containerRef}
      className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg)] transition-[opacity,transform] duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
      style={{
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? 'translateX(0)' : 'translateX(8px)',
      }}
    >
      {/* Header */}
      <header className="px-6 py-4 border-b border-[var(--color-border)]">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 break-words leading-tight">
          {parsed.subject || '(no subject)'}
        </h1>

        {/* Headers: from, to, cc, date */}
        <dl className="text-sm space-y-1">
          {parsed.from && (
            <div className="flex gap-2">
              <dt className="text-[var(--color-text-secondary)] w-12 flex-shrink-0">From</dt>
              <dd className="text-[var(--color-text-primary)] break-words min-w-0">{parsed.from}</dd>
            </div>
          )}
          {parsed.to && (
            <div className="flex gap-2">
              <dt className="text-[var(--color-text-secondary)] w-12 flex-shrink-0">To</dt>
              <dd className="text-[var(--color-text-primary)] break-words min-w-0">{parsed.to}</dd>
            </div>
          )}
          {parsed.cc && (
            <div className="flex gap-2">
              <dt className="text-[var(--color-text-secondary)] w-12 flex-shrink-0">Cc</dt>
              <dd className="text-[var(--color-text-primary)] break-words min-w-0">{parsed.cc}</dd>
            </div>
          )}
          {parsed.date && (
            <div className="flex gap-2">
              <dt className="text-[var(--color-text-secondary)] w-12 flex-shrink-0">Date</dt>
              <dd className="text-[var(--color-text-primary)] break-words min-w-0">{formatDate(parsed.date)}</dd>
            </div>
          )}
        </dl>

        {/* Actions: Reply / Forward */}
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={handleReply}>
            Reply
          </Button>
          <Button variant="secondary" size="sm" onClick={handleForward}>
            Forward
          </Button>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-secondary)] mb-2">
              Attachments ({attachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <button
                  key={att.part_id}
                  type="button"
                  onClick={() => handleDownload(att)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors duration-[150ms] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                >
                  <span className="truncate max-w-[160px]">{att.filename}</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {formatSize(att.size)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Message Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {parsed.html ? (
          <div
            className="text-[var(--color-text-primary)] text-sm leading-relaxed prose-message"
            dangerouslySetInnerHTML={{ __html: parsed.html }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-[var(--font-sans)] text-sm text-[var(--color-text-primary)] leading-normal">
            {parsed.text}
          </pre>
        )}
      </div>
    </section>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * MessageView displays the full content of a selected email message.
 *
 * States:
 * - Empty: no message selected → centered prompt
 * - Loading: skeleton pulse
 * - Error: inline error, no navigation away
 * - Content: animated-in message with headers, body, attachments, and actions
 *
 * Entry animation: opacity 0 + translateX(8px) → opacity 1 + translateX(0), 250ms ease-out-expo
 */
export function MessageView() {
  const currentFolder = useMailboxStore((s) => s.currentFolder)
  const selectedUID = useMailboxStore((s) => s.selectedUID)
  const messages = useMailboxStore((s) => s.messages)

  if (selectedUID === null) {
    return (
      <section role="region" aria-label="Message content" className="flex flex-col h-full min-w-0">
        <MessageViewEmpty />
      </section>
    )
  }

  const summary = messages.find((m) => m.uid === selectedUID)

  return (
    <section role="region" aria-label="Message content" className="flex flex-col h-full min-w-0">
      <MessageBody
        key={`${currentFolder}:${selectedUID}`}
        folder={currentFolder}
        uid={selectedUID}
        summary={summary}
      />
    </section>
  )
}

export default MessageView

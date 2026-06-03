import { useEffect, useState } from 'react'
import PostalMime, { type Address, type Mailbox } from 'postal-mime'
import { useMailboxStore } from '../stores/mailboxStore'
import { getMessage } from '../services/messages'
import type { MessageSummary } from '../types'

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
  // Group variant: flatten members
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

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'style', 'link']

function sanitizeHTML(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove dangerous tags outright
  for (const tag of DANGEROUS_TAGS) {
    doc.querySelectorAll(tag).forEach((el) => el.remove())
  }

  // Strip event handlers and dangerous URL schemes from remaining elements
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
        continue
      }
      if (name === 'href' || name === 'src') {
        const value = attr.value.trim().toLowerCase()
        if (value.startsWith('javascript:') || value.startsWith('data:')) {
          el.removeAttribute(attr.name)
        }
      }
    }
  })

  return doc.body.innerHTML
}

interface MessageBodyProps {
  folder: string
  uid: number
  summary: MessageSummary | undefined
  onLoad: (raw: string | null) => void
}

function MessageBody({ folder, uid, summary, onLoad }: MessageBodyProps) {
  const [parsed, setParsed] = useState<ParsedEmail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    onLoad(null)

    void (async () => {
      let rfc822: string
      try {
        rfc822 = await getMessage(folder, uid)
      } catch (fetchErr) {
        if (cancelled) return
        console.error('Failed to load message', fetchErr)
        setError('Failed to load message')
        return
      }
      if (cancelled) return
      onLoad(rfc822)

      try {
        const parser = new PostalMime()
        const email = await parser.parse(rfc822)
        if (cancelled) return

        const rawHtml = email.html || ''
        const safeHtml = rawHtml ? sanitizeHTML(rawHtml) : ''

        setParsed({
          from: formatAddress(email.from) || summary?.from || '',
          to: formatAddressList(email.to) || summary?.to || '',
          cc: formatAddressList(email.cc),
          subject: email.subject || summary?.subject || '',
          date: email.date || summary?.date || '',
          html: safeHtml,
          text: email.text || '',
        })
      } catch (parseErr) {
        console.error('Failed to parse message', parseErr)
        if (cancelled) return
        // Fall back to showing the raw text and summary metadata
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
    // summary and onLoad are stable for the lifetime of this component instance
    // (parent uses `key` to remount on UID/folder change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, uid])

  if (error) {
    return (
      <section className="flex-1 bg-white flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center text-red-500">
          {error}
        </div>
      </section>
    )
  }

  if (!parsed) {
    return (
      <section className="flex-1 bg-white flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Loading...
        </div>
      </section>
    )
  }

  return (
    <section className="flex-1 bg-white flex flex-col min-w-0">
      <header className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-black mb-3 break-words">
          {parsed.subject || '(no subject)'}
        </h1>
        <dl className="text-sm space-y-1">
          {parsed.from && (
            <div className="flex">
              <dt className="text-gray-500 w-16 flex-shrink-0">From:</dt>
              <dd className="text-black break-words">{parsed.from}</dd>
            </div>
          )}
          {parsed.to && (
            <div className="flex">
              <dt className="text-gray-500 w-16 flex-shrink-0">To:</dt>
              <dd className="text-black break-words">{parsed.to}</dd>
            </div>
          )}
          {parsed.cc && (
            <div className="flex">
              <dt className="text-gray-500 w-16 flex-shrink-0">Cc:</dt>
              <dd className="text-black break-words">{parsed.cc}</dd>
            </div>
          )}
          {parsed.date && (
            <div className="flex">
              <dt className="text-gray-500 w-16 flex-shrink-0">Date:</dt>
              <dd className="text-black break-words">{formatDate(parsed.date)}</dd>
            </div>
          )}
        </dl>
      </header>
      <div className="flex-1 overflow-y-auto p-6 bg-white text-black">
        {parsed.html ? (
          <div
            className="text-black text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parsed.html }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm text-black">
            {parsed.text}
          </pre>
        )}
      </div>
    </section>
  )
}

function MessageView() {
  const currentFolder = useMailboxStore((state) => state.currentFolder)
  const selectedUID = useMailboxStore((state) => state.selectedUID)
  const setCurrentMessage = useMailboxStore((state) => state.setCurrentMessage)
  const messages = useMailboxStore((state) => state.messages)

  if (selectedUID === null) {
    return (
      <section className="flex-1 bg-white flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select a message
        </div>
      </section>
    )
  }

  const summary = messages.find((m) => m.uid === selectedUID)

  return (
    <MessageBody
      key={`${currentFolder}:${selectedUID}`}
      folder={currentFolder}
      uid={selectedUID}
      summary={summary}
      onLoad={setCurrentMessage}
    />
  )
}

export default MessageView

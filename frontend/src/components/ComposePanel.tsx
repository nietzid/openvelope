import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle, lazy, Suspense } from 'react'
import type { Editor } from '@tiptap/react'

const TipTapEditor = lazy(() => import('./TipTapEditor'))
import { sendEmail, uploadAttachment } from '../services/compose'
import type { AttachmentUpload } from '../types'

export interface ReplyData {
  to: string
  subject: string
  body: string
  inReplyTo: string
  references: string
}

export interface ForwardData {
  subject: string
  body: string
}

export interface ComposePanelHandle {
  open: () => void
  close: () => void
  openReply: (data: ReplyData) => void
  openForward: (data: ForwardData) => void
}

type ComposeMode = 'new' | 'reply' | 'forward'

const ComposePanel = forwardRef<ComposePanelHandle>(function ComposePanel(_, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<ComposeMode>('new')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inReplyTo, setInReplyTo] = useState('')
  const [references, setReferences] = useState('')
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([])
  const [uploading, setUploading] = useState(false)

  const editorRef = useRef<Editor | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setMode('new')
        setIsOpen(true)
      },
      close: () => setIsOpen(false),
      openReply: (data: ReplyData) => {
        setMode('reply')
        setTo(data.to)
        const replySubject = data.subject.toLowerCase().startsWith('re:')
          ? data.subject
          : `Re: ${data.subject}`
        setSubject(replySubject)
        const replyBody = `<blockquote style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px; color: #666;">${data.body}</blockquote>`
        setBody(replyBody)
        setInReplyTo(data.inReplyTo)
        setReferences(data.references)
        setIsOpen(true)
      },
      openForward: (data: ForwardData) => {
        setMode('forward')
        setTo('')
        const fwdSubject = data.subject.toLowerCase().startsWith('fwd:')
          ? data.subject
          : `Fwd: ${data.subject}`
        setSubject(fwdSubject)
        const fwdBody = `<br><br><div style="border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px;"><p style="color: #666;">---------- Forwarded message ----------</p><p style="color: #666;">Subject: ${data.subject}</p></div>${data.body}`
        setBody(fwdBody)
        setInReplyTo('')
        setReferences('')
        setIsOpen(true)
      },
    }),
    []
  )

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const handleEditorChange = useCallback((html: string) => {
    setBody(html)
  }, [])

  // Reset form when the panel opens fresh (only for 'new' mode)
  useEffect(() => {
    if (isOpen && mode === 'new') {
      setTo('')
      setCc('')
      setShowCc(false)
      setSubject('')
      setBody('')
      setError(null)
      setIsSending(false)
      setInReplyTo('')
      setReferences('')
      // clear editor content on next tick (after editor mounts)
      const t = setTimeout(() => {
        editorRef.current?.commands.setContent('')
      }, 0)
      return () => clearTimeout(t)
    }
    if (isOpen && (mode === 'reply' || mode === 'forward')) {
      setError(null)
      setIsSending(false)
      // Set editor content for reply/forward on next tick
      const t = setTimeout(() => {
        editorRef.current?.commands.setContent(body)
      }, 0)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isOpen, mode])

  const handleOpen = useCallback(() => setIsOpen(true), [])
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setError(null)
    setMode('new')
    setInReplyTo('')
    setReferences('')
  }, [])

  const parseEmails = (raw: string): string[] =>
    raw
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

  const handleSend = async () => {
    setError(null)
    const toList = parseEmails(to)
    if (toList.length === 0) {
      setError('Please add at least one recipient.')
      return
    }
    if (!subject.trim()) {
      setError('Please add a subject.')
      return
    }

    setIsSending(true)
    try {
      await sendEmail({
        to: toList,
        cc: showCc ? parseEmails(cc) : undefined,
        subject: subject.trim(),
        body,
        is_html: true,
        in_reply_to: inReplyTo || undefined,
        references: references ? references.split(/\s+/).filter(Boolean) : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
      setIsOpen(false)
      setMode('new')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email'
      setError(message)
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-6 right-6 bg-black text-white rounded-full shadow-lg px-6 py-3 font-medium hover:bg-gray-800 cursor-pointer z-40"
      >
        Compose
      </button>
    )
  }

  const dialogTitle = mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : 'New Message'

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: AttachmentUpload[] = []
      for (const file of Array.from(files)) {
        const data = await uploadAttachment(file)
        uploaded.push(data)
      }
      setAttachments((prev) => [...prev, ...uploaded])
    } catch (err) {
      console.error('Failed to upload attachment', err)
      setError(err instanceof Error ? err.message : 'Failed to upload attachment')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div
        className="absolute inset-0 bg-black/30 pointer-events-auto"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={dialogTitle}
        className="relative w-full max-w-3xl mx-4 mb-4 bg-white border border-gray-300 shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto"
      >
        <header className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-300">
          <h2 className="text-sm font-semibold text-black">{dialogTitle}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-600 hover:text-black px-2 py-1 cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col overflow-y-auto">
          <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
            <label htmlFor="compose-to" className="w-12 text-xs text-gray-600">
              To
            </label>
            <input
              id="compose-to"
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com, another@example.com"
              className="flex-1 text-sm focus:outline-none placeholder:text-gray-400"
            />
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="ml-2 text-xs text-gray-600 hover:text-black cursor-pointer"
              >
                Cc
              </button>
            )}
          </div>

          {showCc && (
            <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
              <label htmlFor="compose-cc" className="w-12 text-xs text-gray-600">
                Cc
              </label>
              <input
                id="compose-cc"
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 text-sm focus:outline-none placeholder:text-gray-400"
              />
            </div>
          )}

          <div className="flex items-center border-b border-gray-200 px-3 py-1.5">
            <label htmlFor="compose-subject" className="w-12 text-xs text-gray-600">
              Subject
            </label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm focus:outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="p-3">
            <Suspense fallback={<div className="border border-gray-300 min-h-[200px] p-3 bg-white text-sm text-gray-400">Loading editor...</div>}>
              <TipTapEditor
                editorRef={handleEditorReady}
                onChange={handleEditorChange}
              />
            </Suspense>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-gray-200 bg-gray-50">
            {attachments.map((att, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-gray-300 rounded"
              >
                <span>📎 {att.filename}</span>
                <span className="text-gray-400">({formatSize(att.size)})</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="ml-1 text-gray-500 hover:text-red-500 cursor-pointer"
                  aria-label={`Remove ${att.filename}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="px-4 py-2 text-sm text-red-600 border-t border-gray-200 bg-red-50">
            {error}
          </div>
        )}

        <footer className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-black cursor-pointer">
              <span>📎 Attach</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || uploading}
              className="bg-black text-white px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSending ? 'Sending…' : uploading ? 'Uploading…' : 'Send'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-gray-600 hover:text-black px-3 py-2 cursor-pointer"
          >
            Discard
          </button>
        </footer>
      </div>
    </div>
  )
})

export default ComposePanel

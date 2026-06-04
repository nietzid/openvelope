import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle, lazy, Suspense } from 'react'
import type { Editor } from '@tiptap/react'

const TipTapEditor = lazy(() => import('./TipTapEditor'))
import { sendEmail } from '../services/compose'

export interface ComposePanelHandle {
  open: () => void
  close: () => void
}

const ComposePanel = forwardRef<ComposePanelHandle>(function ComposePanel(_, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editorRef = useRef<Editor | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    []
  )

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const handleEditorChange = useCallback((html: string) => {
    setBody(html)
  }, [])

  // Reset form when the panel opens fresh
  useEffect(() => {
    if (isOpen) {
      setTo('')
      setCc('')
      setShowCc(false)
      setSubject('')
      setBody('')
      setError(null)
      setIsSending(false)
      // clear editor content on next tick (after editor mounts)
      const t = setTimeout(() => {
        editorRef.current?.commands.setContent('')
      }, 0)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isOpen])

  const handleOpen = useCallback(() => setIsOpen(true), [])
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setError(null)
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
      })
      setIsOpen(false)
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div
        className="absolute inset-0 bg-black/30 pointer-events-auto"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="New Message"
        className="relative w-full max-w-3xl mx-4 mb-4 bg-white border border-gray-300 shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto"
      >
        <header className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-300">
          <h2 className="text-sm font-semibold text-black">New Message</h2>
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

        {error && (
          <div className="px-4 py-2 text-sm text-red-600 border-t border-gray-200 bg-red-50">
            {error}
          </div>
        )}

        <footer className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="bg-black text-white px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSending ? 'Sending…' : 'Send'}
          </button>
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

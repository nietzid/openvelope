import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useEffect, useRef } from 'react'

interface TipTapEditorProps {
  initialContent?: string
  onChange?: (html: string) => void
  editorRef?: (editor: ReturnType<typeof useEditor>) => void
}

function TipTapEditor({ initialContent = '', onChange, editorRef }: TipTapEditorProps) {
  const lastEmittedContentRef = useRef<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastEmittedContentRef.current = html
      onChange?.(html)
    },
  })

  useEffect(() => {
    editorRef?.(editor)
  }, [editor, editorRef])

  // Update content when initialContent changes (for reply/forward pre-fill)
  useEffect(() => {
    if (!editor) return
    if (initialContent === lastEmittedContentRef.current) return
    if (initialContent === editor.getHTML()) return

    editor.commands.setContent(initialContent, { emitUpdate: false })
    lastEmittedContentRef.current = null
  }, [initialContent, editor])

  if (!editor) {
    return (
      <div className="border border-gray-300 min-h-[200px] p-3 bg-white">
        <div className="text-sm text-gray-400">Loading editor...</div>
      </div>
    )
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl ?? 'https://')

    if (url === null) {
      return
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="border border-gray-300 bg-white">
      <div className="flex items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 cursor-pointer font-bold ${
            editor.isActive('bold') ? 'bg-gray-200' : ''
          }`}
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 cursor-pointer italic ${
            editor.isActive('italic') ? 'bg-gray-200' : ''
          }`}
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 cursor-pointer underline ${
            editor.isActive('underline') ? 'bg-gray-200' : ''
          }`}
          aria-label="Underline"
        >
          U
        </button>
        <button
          type="button"
          onClick={setLink}
          className={`px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 cursor-pointer ${
            editor.isActive('link') ? 'bg-gray-200' : ''
          }`}
          aria-label="Link"
        >
          🔗
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="min-h-[200px] p-3 prose prose-sm max-w-none [&_.ProseMirror]:min-h-[176px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none"
      />
    </div>
  )
}

export default TipTapEditor

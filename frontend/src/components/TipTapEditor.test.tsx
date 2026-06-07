import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import TipTapEditor from './TipTapEditor'

afterEach(() => {
  cleanup()
})

function ControlledEditor({ onReady }: { onReady: (editor: Editor | null) => void }) {
  const [content, setContent] = useState('')

  return (
    <TipTapEditor
      initialContent={content}
      onChange={setContent}
      editorRef={onReady}
    />
  )
}

describe('TipTapEditor', () => {
  it('preserves spaces while parent state mirrors editor HTML', async () => {
    let editor: Editor | null = null
    render(<ControlledEditor onReady={(instance) => { editor = instance }} />)

    await waitFor(() => {
      expect(editor).not.toBeNull()
    })

    await act(async () => {
      editor!.commands.insertContent('This')
      editor!.commands.insertContent(' ')
      editor!.commands.insertContent('The')
      editor!.commands.insertContent(' ')
      editor!.commands.insertContent('Body')
    })

    await waitFor(() => {
      expect(editor!.getText()).toBe('This The Body')
    })
  })
})

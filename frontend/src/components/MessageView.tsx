import { useMailboxStore } from '../stores/mailboxStore'

function MessageView() {
  const currentMessage = useMailboxStore((state) => state.currentMessage)
  const selectedUID = useMailboxStore((state) => state.selectedUID)

  return (
    <section className="flex-1 bg-white flex flex-col min-w-0">
      {!selectedUID || !currentMessage ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          {selectedUID ? 'Message View' : 'Select a message'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="whitespace-pre-wrap font-sans text-black text-sm">
            {currentMessage}
          </pre>
        </div>
      )}
    </section>
  )
}

export default MessageView

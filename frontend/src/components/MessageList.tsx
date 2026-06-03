import { useMailboxStore } from '../stores/mailboxStore'

function MessageList() {
  const currentFolder = useMailboxStore((state) => state.currentFolder)
  const messages = useMailboxStore((state) => state.messages)
  const selectedUID = useMailboxStore((state) => state.selectedUID)
  const setSelectedUID = useMailboxStore((state) => state.setSelectedUID)

  return (
    <section className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <header className="text-lg font-semibold text-black px-4 py-3 border-b border-gray-200">
        {currentFolder}
      </header>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">No messages</div>
        ) : (
          messages.map((msg) => {
            const isUnread = !msg.flags.seen
            const isSelected = selectedUID === msg.uid
            return (
              <div
                key={msg.uid}
                onClick={() => setSelectedUID(msg.uid)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                  isSelected ? 'bg-gray-100' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <span
                      className={`truncate ${isUnread ? 'font-bold' : 'font-normal'} text-black`}
                    >
                      {msg.from}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {msg.date}
                  </span>
                </div>
                <div
                  className={`truncate ${isUnread ? 'font-bold' : 'font-normal'} text-black text-sm mt-1`}
                >
                  {msg.subject}
                </div>
                <div className="truncate text-gray-500 text-sm mt-1">
                  {msg.preview}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default MessageList

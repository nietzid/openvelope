import { useEffect } from 'react'
import { listFolders } from '../services/folders'
import { useMailboxStore } from '../stores/mailboxStore'

interface SidebarProps {
  onCompose: () => void
}

function Sidebar({ onCompose }: SidebarProps) {
  const folders = useMailboxStore((state) => state.folders)
  const currentFolder = useMailboxStore((state) => state.currentFolder)
  const setFolders = useMailboxStore((state) => state.setFolders)
  const setCurrentFolder = useMailboxStore((state) => state.setCurrentFolder)

  useEffect(() => {
    listFolders()
      .then(setFolders)
      .catch(() => {
        // Silently ignore — empty folder list renders fine
      })
  }, [setFolders])

  return (
    <aside className="w-[250px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-4">
        <button
          type="button"
          onClick={onCompose}
          className="w-full bg-black text-white py-2 px-4 font-medium hover:bg-gray-800 cursor-pointer"
        >
          Compose
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {folders.map((folder) => (
          <div
            key={folder.name}
            onClick={() => setCurrentFolder(folder.name)}
            className={`px-4 py-2 cursor-pointer text-black hover:bg-gray-50 ${
              currentFolder === folder.name ? 'bg-gray-100' : ''
            }`}
          >
            <span className="flex-1 truncate">{folder.name}</span>
            {folder.unseen > 0 && (
              <span className="ml-2 text-xs text-gray-500">{folder.unseen}</span>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar

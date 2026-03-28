import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { Settings } from './components/Settings'
import { useStore } from './store'

export default function App() {
  const { chats, activeChatId, setActiveChat, sidebarOpen } = useStore()

  useEffect(() => {
    if (chats.length > 0 && (!activeChatId || !chats.find(c => c.id === activeChatId))) {
      setActiveChat(chats[0].id)
    }
  }, [chats, activeChatId, setActiveChat])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="overflow-hidden shrink-0"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <ChatWindow />
      </main>
      <Settings />
    </div>
  )
}

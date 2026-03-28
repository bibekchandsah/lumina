import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, Trash2, Settings, Zap, Pencil, Check, X } from 'lucide-react'
import { useStore } from '@/store'
import { cn } from '@/utils/cn'

export function Sidebar() {
  const { chats, activeChatId, createChat, deleteChat, setActiveChat, setSettingsOpen, keys, updateChatTitle } = useStore()
  const activeCount = keys.filter(k => k.status === 'active').length
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const startEdit = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setEditValue(title)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  const commitEdit = (id: string) => {
    if (editValue.trim()) updateChatTitle(id, editValue.trim())
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  return (
    <aside className="w-64 flex flex-col h-full glass-dark border-r border-white/10">
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg gradient-text">Lumina</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {activeCount} active key{activeCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* New Chat */}
      <div className="p-3">
        <button
          onClick={() => createChat()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-sm transition-all duration-200 hover:scale-[1.02] cursor-pointer"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        <AnimatePresence>
          {chats.map(chat => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => { setHoveredId(null); setConfirmDeleteId(null) }}
              onClick={() => editingId !== chat.id && setActiveChat(chat.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 text-sm',
                editingId === chat.id
                  ? 'bg-violet-600/20 border border-violet-500/30'
                  : activeChatId === chat.id
                    ? 'bg-violet-600/25 border border-violet-500/30 text-white cursor-pointer'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer'
              )}
            >
              <MessageSquare size={14} className="shrink-0 text-current" />

              {editingId === chat.id ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(chat.id)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 bg-transparent outline-none text-white text-sm min-w-0"
                  autoFocus
                />
              ) : (
                <span className="flex-1 truncate" onDoubleClick={e => startEdit(chat.id, chat.title, e)}>
                  {chat.title}
                </span>
              )}

              <div className="flex items-center gap-0.5 shrink-0">
                {editingId === chat.id ? (
                  <>
                    <button onClick={e => { e.stopPropagation(); commitEdit(chat.id) }}
                      className="p-1 rounded hover:text-emerald-400 text-slate-400 transition-colors">
                      <Check size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); cancelEdit() }}
                      className="p-1 rounded hover:text-red-400 text-slate-400 transition-colors">
                      <X size={13} />
                    </button>
                  </>
                ) : confirmDeleteId === chat.id ? (
                  <>
                    <span className="text-xs text-red-400 mr-1">Delete?</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteChat(chat.id); setConfirmDeleteId(null) }}
                      className="p-1 rounded text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                      className="p-1 rounded text-slate-500 hover:text-white transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={e => startEdit(chat.id, chat.title, e)}
                      className={cn('p-1 rounded hover:text-violet-400 text-slate-500 transition-all duration-150', hoveredId === chat.id ? 'opacity-100' : 'opacity-0')}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(chat.id) }}
                      className={cn('p-1 rounded hover:text-red-400 text-slate-500 transition-all duration-150', hoveredId === chat.id ? 'opacity-100' : 'opacity-0')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {chats.length === 0 && (
          <p className="text-center text-slate-600 text-xs py-8">No chats yet</p>
        )}
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white text-sm transition-all duration-200 cursor-pointer"
        >
          <Settings size={16} />
          Settings & API Keys
          {keys.filter(k => k.status === 'failed').length > 0 && (
            <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>
      </div>
    </aside>
  )
}

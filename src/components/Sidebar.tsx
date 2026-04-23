import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, Settings, Zap, Pencil, Check, MoreHorizontal, Trash2, Pin, PinOff, Archive, ArchiveRestore, LogIn, LogOut, User, Share2, GitCompare, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { cn } from '@/utils/cn'
import type { Chat } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { db, isConfigured } from '@/services/firebase'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'

function ChatMenu({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const { deleteChat, updateChatTitle, updateChatShare, togglePin, toggleArchive, setActiveChat } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(chat.title)
  const [sharing, setSharing] = useState(false)
  const [unsharing, setUnsharing] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const handleShare = async () => {
    if (!isConfigured || !db) {
      alert('Sharing requires Firebase to be configured.')
      return
    }
    setSharing(true)
    try {
      const sharedAt = Date.now()
      const shareId = chat.sharedId || crypto.randomUUID()
      await setDoc(doc(db, 'shared', shareId), { ...chat, sharedId: shareId, sharedAt })
      updateChatShare(chat.id, shareId, sharedAt)
      const url = `${window.location.origin}/share/${shareId}`
      setShareUrl(url)
      await navigator.clipboard.writeText(url)
    } catch { alert('Failed to create share link.') }
    finally { setSharing(false) }
  }

  const handleUnshare = async () => {
    if (!chat.sharedId || !isConfigured || !db) {
      alert('This chat is not currently shared.')
      return
    }
    setUnsharing(true)
    try {
      await deleteDoc(doc(db, 'shared', chat.sharedId))
      updateChatShare(chat.id, null)
      setShareUrl('')
      onClose()
    } catch {
      alert('Failed to unshare chat.')
    } finally {
      setUnsharing(false)
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (editing) return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-52 bg-[#1a1a2e] border border-white/15 rounded-xl p-3 shadow-2xl space-y-2">
      <input
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { updateChatTitle(chat.id, editValue.trim() || chat.title); onClose() }
          if (e.key === 'Escape') onClose()
        }}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50"
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={() => { updateChatTitle(chat.id, editValue.trim() || chat.title); onClose() }}
          className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs transition-colors">Save</button>
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg glass hover:bg-white/10 text-slate-400 text-xs transition-colors">Cancel</button>
      </div>
    </div>
  )

  if (shareUrl) return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-56 bg-[#1a1a2e] border border-white/15 rounded-xl p-3 shadow-2xl space-y-2">
      <p className="text-xs text-emerald-400 font-medium">Link copied!</p>
      <p className="text-xs text-slate-500 break-all">{shareUrl}</p>
      <button onClick={onClose} className="w-full py-1.5 rounded-lg glass hover:bg-white/10 text-slate-400 text-xs transition-colors">Close</button>
    </div>
  )

  if (confirmDelete) return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-48 bg-[#1a1a2e] border border-white/15 rounded-xl p-3 shadow-2xl space-y-2">
      <p className="text-xs text-slate-300">Delete this chat?</p>
      <div className="flex gap-2">
        <button onClick={() => { deleteChat(chat.id); onClose() }}
          className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs transition-colors">Delete</button>
        <button onClick={() => setConfirmDelete(false)}
          className="px-3 py-1.5 rounded-lg glass hover:bg-white/10 text-slate-400 text-xs transition-colors">Cancel</button>
      </div>
    </div>
  )

  const items = [
    { icon: Pencil, label: 'Rename', action: () => setEditing(true) },
    { icon: chat.pinned ? PinOff : Pin, label: chat.pinned ? 'Unpin' : 'Pin', action: () => { togglePin(chat.id); onClose() } },
    { icon: chat.archived ? ArchiveRestore : Archive, label: chat.archived ? 'Unarchive' : 'Archive', action: () => { toggleArchive(chat.id); if (chat.archived) setActiveChat(chat.id); onClose() } },
    { icon: Share2, label: sharing ? 'Sharing…' : 'Share', action: handleShare },
    ...(chat.sharedId ? [{ icon: Share2, label: unsharing ? 'Unsharing…' : 'Unshare', action: handleUnshare }] : []),
    { icon: Trash2, label: 'Delete', action: () => setConfirmDelete(true), danger: true },
  ]

  return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-44 bg-[#1a1a2e] border border-white/15 rounded-xl py-1 shadow-2xl overflow-hidden">
      {items.map(({ icon: Icon, label, action, danger }) => (
        <button key={label} onClick={action}
          className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left',
            danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-white/8'
          )}
          onMouseEnter={e => { if (!danger) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { if (!danger) (e.currentTarget as HTMLElement).style.background = '' }}
        >
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  )
}

function ChatItem({ chat }: { chat: Chat }) {
  const { activeChatId, setActiveChat } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const isActive = activeChatId === chat.id

  return (
    <motion.div
      key={chat.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false) }}
      onClick={() => setActiveChat(chat.id, true)}
      className={cn(
        'relative group flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 text-sm cursor-pointer',
        isActive ? 'bg-violet-600/25 border border-violet-500/30 text-white' : 'hover:bg-white/5 text-slate-400 hover:text-white'
      )}
    >
      <MessageSquare size={14} className="shrink-0" />
      <span className="flex-1 truncate">{chat.title}</span>
      {chat.pinned && <Pin size={10} className="text-violet-400 shrink-0" />}

      {/* Three-dot menu button */}
      <button
        onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
        style={{ opacity: hovered || menuOpen ? 1 : 0 }}
        className="p-0.5 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-all shrink-0"
      >
        <MoreHorizontal size={14} />
      </button>

      {/* Dropdown menu */}
      {menuOpen && <ChatMenu chat={chat} onClose={() => setMenuOpen(false)} />}
    </motion.div>
  )
}

export function Sidebar() {
  const { chats, setActiveChat, clearRememberedActiveChat, setSettingsOpen, keys } = useStore()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const activeCount = keys.filter(k => k.status === 'active').length
  const [searchQuery, setSearchQuery] = useState('')

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return chats
    return chats.filter(chat => {
      if (chat.title.toLowerCase().includes(query)) return true
      return chat.messages.some(msg => msg.content.toLowerCase().includes(query))
    })
  }, [chats, searchQuery])

  const pinned = filteredChats.filter(c => c.pinned && !c.archived && !c.compareMode)
  const regular = filteredChats.filter(c => !c.pinned && !c.archived && !c.compareMode)
  const archived = filteredChats.filter(c => c.archived && !c.compareMode)
  const compareChats = filteredChats.filter(c => c.compareMode)
  const [showArchived, setShowArchived] = useState(false)
  const [showCompare, setShowCompare] = useState(true)

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
          onClick={() => { setActiveChat(null); clearRememberedActiveChat() }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-sm transition-all duration-200 hover:scale-[1.02]"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus-within:border-violet-500/40 transition-colors">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 outline-none"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {/* Pinned */}
        {pinned.length > 0 && (
          <>
            <p className="text-xs text-slate-600 px-2 pt-1 pb-0.5 uppercase tracking-wider">Pinned</p>
            <AnimatePresence>
              {pinned.map(chat => <ChatItem key={chat.id} chat={chat} />)}
            </AnimatePresence>
            {regular.length > 0 && <div className="border-t border-white/5 my-1" />}
          </>
        )}

        {/* Regular */}
        <AnimatePresence>
          {regular.map(chat => <ChatItem key={chat.id} chat={chat} />)}
        </AnimatePresence>

        {filteredChats.filter(c => !c.archived && !c.compareMode).length === 0 && (
          <p className="text-center text-slate-600 text-xs py-8">{searchQuery.trim() ? 'No matching chats' : 'No chats yet'}</p>
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived(s => !s)}
              className="w-full flex items-center gap-2 px-2 py-1 text-xs text-slate-600 hover:text-slate-400 transition-colors mt-2"
            >
              <Archive size={11} />
              Archived ({archived.length})
              <Check size={10} className={cn('ml-auto transition-transform', showArchived ? 'rotate-0' : '-rotate-90')} />
            </button>
            <AnimatePresence>
              {showArchived && archived.map(chat => <ChatItem key={chat.id} chat={chat} />)}
            </AnimatePresence>
          </>
        )}

        {compareChats.length > 0 && (
          <>
            <button
              onClick={() => setShowCompare(s => !s)}
              className="w-full flex items-center gap-2 px-2 py-1 text-xs text-slate-600 hover:text-slate-400 transition-colors mt-2"
            >
              <GitCompare size={11} />
              Compare Sessions ({compareChats.length})
              <Check size={10} className={cn('ml-auto transition-transform', showCompare ? 'rotate-0' : '-rotate-90')} />
            </button>
            <AnimatePresence>
              {showCompare && compareChats.map(chat => <ChatItem key={chat.id} chat={chat} />)}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Auth + Settings */}
      <div className="p-3 border-t border-white/10 space-y-1">
        {/* User info or login button */}
        {user ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-white/10">
            {user.photoURL
              ? <img src={user.photoURL} className="w-6 h-6 rounded-full shrink-0" alt="" />
              : <User size={14} className="text-slate-400 shrink-0" />
            }
            <span className="flex-1 text-xs text-slate-300 truncate">{user.displayName || user.email}</span>
            <button onClick={logout} className="text-slate-600 hover:text-red-400 transition-colors" title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white text-sm transition-all duration-200"
          >
            <LogIn size={16} />
            Sign in / Create account
          </button>
        )}

        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white text-sm transition-all duration-200"
        >
          <Settings size={16} />
          Settings & API Keys
          {keys.filter(k => k.status === 'failed').length > 0 && (
            <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>
        <button
          onClick={() => navigate('/compare')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white text-sm transition-all duration-200"
        >
          <GitCompare size={16} />
          Compare Models
        </button>
      </div>

    </aside>
  )
}


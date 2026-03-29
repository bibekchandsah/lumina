import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db, isConfigured } from '@/services/firebase'
import { motion } from 'framer-motion'
import { Zap, ArrowLeft, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Chat } from '@/types'
import { PROVIDER_INFO } from '@/types'
import { cn } from '@/utils/cn'

export function SharedChatPage() {
  const { shareId } = useParams<{ shareId: string }>()
  const [chat, setChat] = useState<Chat | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shareId || !db || !isConfigured) {
      setError('Sharing requires Firebase to be configured.')
      setLoading(false)
      return
    }
    getDoc(doc(db, 'shared', shareId))
      .then(snap => {
        if (!snap.exists()) { setError('This shared chat does not exist or has been removed.'); return }
        setChat(snap.data() as Chat)
      })
      .catch(() => setError('Failed to load shared chat.'))
      .finally(() => setLoading(false))
  }, [shareId])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 overflow-y-auto" style={{ height: '100vh' }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3 glass-dark sticky top-0 z-10">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-semibold gradient-text">Lumina</span>
        <span className="text-slate-600 text-sm">· Shared Chat</span>
        <Link to="/" className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={13} /> Open Lumina
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 animate-pulse" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 glass border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {chat && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold text-white">{chat.title}</h1>
              <p className="text-xs text-slate-600 mt-1">
                {chat.messages.length} messages · Shared from Lumina
              </p>
            </div>

            <div className="space-y-4">
              {chat.messages.filter(m => m.role !== 'error').map(msg => {
                const isUser = msg.role === 'user'
                return (
                  <div key={msg.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">
                        {msg.provider ? msg.provider[0].toUpperCase() : 'AI'}
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                      isUser ? 'msg-user text-white rounded-br-sm' : 'msg-ai text-slate-200 rounded-bl-sm'
                    )}>
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      )}
                      {!isUser && msg.provider && (
                        <p className="text-xs mt-2" style={{ color: PROVIDER_INFO[msg.provider]?.color + '80' }}>
                          {PROVIDER_INFO[msg.provider]?.name} · {msg.model}
                        </p>
                      )}
                    </div>
                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">U</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="text-center pt-4 border-t border-white/10">
              <p className="text-xs text-slate-600 mb-3">Want to chat with AI like this?</p>
              <Link to="/" className="px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-600/30 transition-all">
                Try Lumina for free
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

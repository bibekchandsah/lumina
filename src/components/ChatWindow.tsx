import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Zap, MessageSquare, PanelLeftOpen, PanelLeftClose, ArrowDown, ArrowUp, Square } from 'lucide-react'
import { useStore } from '@/store'
import { useAI } from '@/hooks/useAI'
import { ChatMessage } from './ChatMessage'
import { Typewriter } from './Typewriter'
import { cn } from '@/utils/cn'

export function ChatWindow() {
  const { activeChatId, chats, createChat, isStreaming, streamingContent, keys, sidebarOpen, setSidebarOpen, stopStreaming } = useStore()
  const { sendMessage } = useAI()
  const editMessage = useStore(s => s.editMessage)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set())

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [showScrollUp, setShowScrollUp] = useState(false)

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const threshold = clientHeight
    const distFromBottom = scrollHeight - scrollTop - clientHeight
    setShowScrollDown(distFromBottom > threshold)
    // Only show "go to top" when user has scrolled up (away from bottom)
    setShowScrollUp(scrollTop > threshold && distFromBottom > 50)
  }, [])

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const chat = chats.find(c => c.id === activeChatId) ?? null
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [activeChatId])

  // Re-focus after streaming ends
  useEffect(() => {
    if (!isStreaming) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [isStreaming])

  // Scroll to bottom on new messages, streaming content, or typewriter progress
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages.length, streamingContent])

  const hasKeys = keys.some(k => k.status === 'active')

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    let chatId = activeChatId
    if (!chatId) chatId = createChat()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const result = sendMessage(chatId, text)
    result.then(() => {
      const latestChat = useStore.getState().chats.find(c => c.id === chatId)
      const lastMsg = latestChat?.messages.findLast(m => m.role === 'assistant')
      if (lastMsg) setAnimatedIds(prev => new Set(prev).add(lastMsg.id))
      textareaRef.current?.focus()
    })
    await result
  }

  const handleEdit = useCallback((messageId: string, newContent: string) => {
    if (!activeChatId || isStreaming) return
    editMessage(activeChatId, messageId, newContent)
    // Re-send with the edited content
    setTimeout(() => sendMessage(activeChatId, newContent).then(() => {
      const latestChat = useStore.getState().chats.find(c => c.id === activeChatId)
      const lastMsg = latestChat?.messages.findLast(m => m.role === 'assistant')
      if (lastMsg) setAnimatedIds(prev => new Set(prev).add(lastMsg.id))
      textareaRef.current?.focus()
    }), 0)
  }, [activeChatId, isStreaming, editMessage, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 glass-dark flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-slate-400 hover:text-white transition-colors shrink-0"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <MessageSquare size={18} className="text-violet-400 shrink-0" />
        <h2 className="font-semibold text-white truncate">{chat?.title ?? 'Lumina'}</h2>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-violet-400">
            <Loader2 size={12} className="animate-spin" /> Generating…
          </span>
        )}
      </div>

      {/* Messages + scroll buttons */}
      <div className="flex-1 relative overflow-hidden">
        <div className="h-full overflow-y-auto py-4" ref={scrollContainerRef} onScroll={handleScroll}>
        {!chat || chat.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center">
              <Zap size={28} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Start a conversation</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {hasKeys
                  ? 'Ask anything — Lumina will use your best available API key automatically.'
                  : 'Add API keys in Settings to get started.'}
              </p>
            </div>
            {!hasKeys && (
              <button
                onClick={() => useStore.getState().setSettingsOpen(true)}
                className="px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-600/30 transition-all"
              >
                Open Settings
              </button>
            )}
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {chat.messages.map((msg) => {
                const shouldAnimate = animatedIds.has(msg.id)
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    animate={shouldAnimate}
                    onScrollNeeded={scrollToBottom}
                    onEdit={handleEdit}
                  />
                )
              })}
            </AnimatePresence>

            {/* Streaming bubble */}
            {isStreaming && streamingContent && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 px-4 py-2"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">
                  AI
                </div>
                <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-bl-sm msg-ai text-slate-200 text-sm leading-relaxed">
                  <Typewriter text={streamingContent} speed={6} />
                </div>
              </motion.div>
            )}

            {isStreaming && !streamingContent && (
              <div className="flex gap-3 px-4 py-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                  <Loader2 size={14} className="text-white animate-spin" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm msg-ai flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
        </div>{/* end scroll container */}

        {/* Scroll buttons */}
        <AnimatePresence>
          {showScrollUp && (
            <motion.button
              key="up"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToTop}
              className={cn(
                'absolute right-4 w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shadow-lg z-10',
                showScrollDown ? 'bottom-14' : 'bottom-4'
              )}
              title="Scroll to top"
            >
              <ArrowUp size={15} />
            </motion.button>
          )}
          {showScrollDown && (
            <motion.button
              key="down"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shadow-lg z-10"
              title="Scroll to bottom"
            >
              <ArrowDown size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>{/* end outer wrapper */}

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className={cn(
          'flex items-center gap-3 glass rounded-2xl px-4 py-3 transition-all duration-200',
          'focus-within:border-violet-500/50 focus-within:shadow-lg focus-within:shadow-violet-500/10'
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message Lumina… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-slate-600 leading-relaxed disabled:opacity-50 py-0 align-middle"
            style={{ maxHeight: '160px', minHeight: '24px' }}
            autoFocus
          />
          <button
            onClick={isStreaming ? stopStreaming : handleSend}
            disabled={!isStreaming && !input.trim()}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:scale-100 shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {isStreaming ? <Square size={14} className="fill-white" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-center text-xs text-slate-700 mt-2">
          API keys stored locally · Never sent to any server
        </p>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, X, Send, Zap, Copy, Check as CheckIcon, GitCompare, Trash2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '@/store'
import { callGemini } from '@/services/gemini'
import { callGroq } from '@/services/groq'
import { callGrok } from '@/services/grok'
import { PROVIDER_INFO, PROVIDER_MODELS, type Provider, type APIKey, type Message } from '@/types'
import { cn } from '@/utils/cn'
import { Select } from '@/components/ui/Select'

interface Panel { id: string; provider: Provider; keyId: string; model: string }

// A compare turn: one user message + N AI responses
interface CompareTurn {
  userMsg: string
  responses: Record<string, { content: string; streaming: string; loading: boolean; error: string; latency: number | null; tokens: number | null; provider: Provider; model: string }>
}

async function runPanel(panel: Panel, key: APIKey, history: Message[], onChunk: (t: string) => void, signal: AbortSignal) {
  const start = Date.now()
  let acc = ''
  const chunk = (t: string) => { acc += t; onChunk(acc) }
  let result: { content: string; tokens: number }
  switch (panel.provider) {
    case 'gemini': result = await callGemini(key.key, panel.model, history, chunk, signal); break
    case 'groq':   result = await callGroq(key.key, panel.model, history, chunk, signal); break
    case 'grok':   result = await callGrok(key.key, panel.model, history, chunk, signal); break
  }
  return { content: result.content || acc, tokens: result.tokens, latency: Date.now() - start }
}

export function ComparePage() {
  const { keys, createChat, addMessage, chats, deleteChat } = useStore()
  const activeChatCompareId = useStore(s => s.activeChatCompareId)
  const setActiveChatCompareId = useStore(s => s.setActiveChatCompareId)
  const activeKeys = keys.filter(k => k.status === 'active')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [panels, setPanels] = useState<Panel[]>(() => {
    const defaults: Panel[] = []
    const providers: Provider[] = ['gemini', 'groq', 'grok']
    for (const p of providers) {
      const k = activeKeys.find(k => k.provider === p)
      if (k) defaults.push({ id: crypto.randomUUID(), provider: p, keyId: k.id, model: k.model || PROVIDER_MODELS[p][0] })
      if (defaults.length === 2) break
    }
    if (defaults.length === 0 && activeKeys.length > 0) {
      const k = activeKeys[0]
      defaults.push({ id: crypto.randomUUID(), provider: k.provider, keyId: k.id, model: k.model || PROVIDER_MODELS[k.provider][0] })
    }
    return defaults
  })

  const [turns, setTurns] = useState<CompareTurn[]>([])
  const [prompt, setPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Rebuild turns from stored messages whenever active session changes or on mount
  useEffect(() => {
    if (!activeChatCompareId) { setTurns([]); return }
    const chat = useStore.getState().chats.find(c => c.id === activeChatCompareId)
    if (!chat) { setTurns([]); return }
    const msgs = chat.messages
    const rebuilt: CompareTurn[] = []
    let i = 0
    while (i < msgs.length) {
      if (msgs[i].role === 'user') {
        const userMsg = msgs[i].content
        const responses: CompareTurn['responses'] = {}
        i++
        while (i < msgs.length && msgs[i].role === 'assistant') {
          const pid = crypto.randomUUID()
          const raw = msgs[i].content.replace(/^\*\*\[.*?\]\*\*\n\n/, '')
          responses[pid] = {
            content: raw, streaming: '', loading: false, error: '',
            latency: msgs[i].latency || null, tokens: msgs[i].tokens || null,
            provider: msgs[i].provider || 'gemini', model: msgs[i].model || ''
          }
          i++
        }
        rebuilt.push({ userMsg, responses })
      } else { i++ }
    }
    setTurns(rebuilt)
  }, [activeChatCompareId]) // only depends on which session is active

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  const updateResponse = useCallback((turnIdx: number, panelId: string, patch: Partial<CompareTurn['responses'][string]>) => {
    setTurns(prev => prev.map((t, i) => i !== turnIdx ? t : {
      ...t,
      responses: { ...t.responses, [panelId]: { ...t.responses[panelId], ...patch } }
    }))
  }, [])

  const handleSend = async () => {
    const text = prompt.trim()
    if (!text || isRunning || panels.length === 0 || activeKeys.length === 0) return

    // Create chat on first message
    let cid = activeChatCompareId
    if (!cid) {
      cid = createChat({
        title: `[Compare] ${text.slice(0, 40)}`,
        compareMode: true,
        comparePanels: panels.map(p => ({ provider: p.provider, model: p.model })),
      })
      setActiveChatCompareId(cid)
    }

    // Save user message to store
    addMessage(cid, { role: 'user', content: text })

    const turnIdx = turns.length
    const initResponses: CompareTurn['responses'] = {}
    panels.forEach(p => {
      initResponses[p.id] = { content: '', streaming: '', loading: true, error: '', latency: null, tokens: null, provider: p.provider, model: p.model }
    })
    setTurns(prev => [...prev, { userMsg: text, responses: initResponses }])
    setPrompt('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    abortRef.current = new AbortController()
    setIsRunning(true)

    // Build history from previous turns for context
    const history: Message[] = turns.flatMap(t => [
      { id: crypto.randomUUID(), role: 'user' as const, content: t.userMsg, timestamp: Date.now() },
      // Use first panel's response as context for subsequent turns
      { id: crypto.randomUUID(), role: 'assistant' as const, content: Object.values(t.responses)[0]?.content || '', timestamp: Date.now() },
    ])
    history.push({ id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() })

    await Promise.allSettled(panels.map(async panel => {
      const key = keys.find(k => k.id === panel.keyId)
      if (!key) { updateResponse(turnIdx, panel.id, { loading: false, error: 'No API key' }); return }
      try {
        const { content, tokens, latency } = await runPanel(
          panel, key, history,
          (streaming) => updateResponse(turnIdx, panel.id, { streaming }),
          abortRef.current!.signal
        )
        updateResponse(turnIdx, panel.id, { content, streaming: '', loading: false, latency, tokens })
        // Save to chat store
        addMessage(cid!, {
          role: 'assistant',
          content: `**[${PROVIDER_INFO[panel.provider].name} · ${panel.model}]**\n\n${content}`,
          provider: panel.provider,
          model: panel.model,
          latency,
          tokens,
        })
      } catch (e: unknown) {
        const aborted = (e as { name?: string })?.name === 'AbortError'
        const partial = aborted ? (turns[turnIdx]?.responses[panel.id]?.streaming || '') : ''
        updateResponse(turnIdx, panel.id, { loading: false, error: aborted ? '' : ((e as { message?: string })?.message || 'Error'), content: partial, streaming: '' })
        if (partial) addMessage(cid!, { role: 'assistant', content: `**[${PROVIDER_INFO[panel.provider].name}]**\n\n${partial}\n\n*(stopped)*`, provider: panel.provider, model: panel.model })      }
    }))

    setIsRunning(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleStop = () => { abortRef.current?.abort(); setIsRunning(false) }
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const addPanel = () => {
    if (panels.length >= 4) return
    const k = activeKeys[0]; if (!k) return
    setPanels(prev => [...prev, { id: crypto.randomUUID(), provider: k.provider, keyId: k.id, model: k.model || PROVIDER_MODELS[k.provider][0] }])
  }
  const removePanel = (id: string) => setPanels(prev => prev.filter(p => p.id !== id))
  const updatePanel = (id: string, patch: Partial<Panel>) => setPanels(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))

  const handleNewSession = () => {
    setActiveChatCompareId(null)
    setTurns([])
    setPrompt('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // Compare chats from history
  const compareChats = chats.filter(c => c.compareMode)

  return (
    <div className="relative h-screen bg-[#0a0a0f] flex overflow-hidden">
      {/* Mini sidebar for compare history */}
      <motion.div
        animate={{ width: sidebarCollapsed ? 0 : 208 }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="shrink-0 border-r border-white/10 flex flex-col glass-dark overflow-hidden relative"
      >
        {!sidebarCollapsed && (
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Zap size={12} className="text-white" />
                </div>
                <span className="text-sm font-semibold gradient-text truncate">Compare</span>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                title="Collapse compare sidebar"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
            <button onClick={handleNewSession}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs transition-all">
              <Plus size={13} /> New Session
            </button>
          </div>
        )}
        {!sidebarCollapsed && (
          <>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {compareChats.length === 0 && <p className="text-xs text-slate-700 text-center py-4">No sessions yet</p>}
              {compareChats.map(c => (
                <div key={c.id}
                  className={cn('group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors',
                    c.id === activeChatCompareId ? 'bg-violet-600/20 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-white'
                  )}
                  onClick={() => setActiveChatCompareId(c.id)}
                >
                  <GitCompare size={11} className="shrink-0" />
                  <span className="truncate flex-1">{c.title.replace('[Compare] ', '')}</span>
                  <button onClick={e => { e.stopPropagation(); deleteChat(c.id); if (c.id === activeChatCompareId) { setActiveChatCompareId(null); setTurns([]) } }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-white/10">
              <Link to="/" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:text-white transition-colors">
                <ArrowLeft size={12} /> Back to chat
              </Link>
            </div>
          </>
        )}
      </motion.div>

      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute top-4 left-2 z-50 rounded-lg p-2 bg-[#0f111a] border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors shadow-lg"
          title="Expand compare sidebar"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Panel config header */}
        <div className="border-b border-white/10 px-4 py-2 flex items-center gap-2 shrink-0 bg-black/20 overflow-x-auto scrollbar-x">
          {panels.map((panel, idx) => (
            <div key={panel.id} className={cn('flex items-center gap-1.5 shrink-0', idx > 0 && 'pl-2 border-l border-white/10')}>
              <div className="w-2 h-2 rounded-full" style={{ background: PROVIDER_INFO[panel.provider].color }} />
              <Select value={panel.provider} onChange={v => {
                const p = v as Provider
                const k = activeKeys.find(k => k.provider === p) || activeKeys[0]
                if (k) updatePanel(panel.id, { provider: p, keyId: k.id, model: k.model || PROVIDER_MODELS[p][0] })
              }} options={(['gemini','groq','grok'] as Provider[]).map(p => ({ value: p, label: PROVIDER_INFO[p].name }))} className="w-24" portal />
              <Select value={panel.model} onChange={v => updatePanel(panel.id, { model: v })}
                options={PROVIDER_MODELS[panel.provider].map(m => ({ value: m }))} className="w-36" portal />
              {panels.length > 1 && (
                <button onClick={() => removePanel(panel.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          {panels.length < 4 && activeKeys.length > 0 && (
            <button onClick={addPanel} className="flex items-center gap-1 px-2 py-1 rounded-lg glass border border-white/10 text-slate-500 hover:text-white text-xs transition-all shrink-0 ml-1">
              <Plus size={12} /> Add
            </button>
          )}
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto">
          {turns.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center">
                <GitCompare size={24} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Compare Models</h3>
                <p className="text-slate-500 text-sm max-w-sm">Send a prompt to see responses from {panels.length} model{panels.length !== 1 ? 's' : ''} side by side</p>
              </div>
            </div>
          )}

          {turns.map((turn, ti) => (
            <div key={ti} className="border-b border-white/5">
              {/* User message */}
              <div className="flex justify-end px-4 py-3">
                <div className="max-w-[60%] px-4 py-3 rounded-2xl rounded-br-sm msg-user text-white text-sm">
                  <p className="whitespace-pre-wrap">{turn.userMsg}</p>
                </div>
                <div className="w-7 h-7 rounded-xl bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 ml-2 mt-1">U</div>
              </div>

              {/* AI responses side by side */}
              <div className="px-4 pb-4 overflow-x-auto scrollbar-x">
                <div
                  className="grid gap-3 min-w-full"
                  style={{ gridTemplateColumns: `repeat(${Object.keys(turn.responses).length}, minmax(320px, 1fr))` }}
                >
                  {Object.entries(turn.responses).map(([pid, res]) => (
                    <motion.div key={pid} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="glass rounded-xl overflow-hidden"
                    >
                      {/* Model label */}
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/20">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PROVIDER_INFO[res.provider]?.color || '#888' }} />
                        <span className="text-xs text-slate-400 truncate">{PROVIDER_INFO[res.provider]?.name} · {res.model}</span>
                      </div>
                      {/* Content */}
                      <div className="p-3 text-sm text-slate-200 leading-relaxed min-h-[60px]">
                        {res.loading && !res.streaming ? (
                          <div className="flex gap-1.5 items-center py-1">
                            {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                          </div>
                        ) : res.error ? (
                          <p className="text-red-400 text-xs">{res.error}</p>
                        ) : (
                          <>
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{res.streaming || res.content}</ReactMarkdown>
                            </div>
                            {res.loading && <span className="inline-block w-[2px] h-[1em] bg-violet-400 animate-pulse ml-0.5 align-middle rounded-full" />}
                          </>
                        )}
                      </div>
                      {/* Stats */}
                      {!res.loading && res.content && (
                        <ResponseMeta res={res} />
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-4 shrink-0">
          <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3 focus-within:border-violet-500/50 transition-all max-w-4xl mx-auto">
            <textarea ref={textareaRef} value={prompt} onChange={handleInput} onKeyDown={handleKeyDown}
              placeholder={`Send to ${panels.length} model${panels.length !== 1 ? 's' : ''}… (Enter to send)`}
              rows={1} disabled={isRunning} autoFocus
              className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-slate-600 leading-relaxed disabled:opacity-50 py-0"
              style={{ maxHeight: '120px', minHeight: '24px' }}
            />
            <button onClick={isRunning ? handleStop : handleSend}
              disabled={!isRunning && (!prompt.trim() || activeKeys.length === 0)}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white transition-all hover:scale-105 disabled:opacity-40 disabled:scale-100 shrink-0"
            >
              {isRunning ? <span className="w-3 h-3 rounded-sm bg-white" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResponseMeta({ res }: { res: CompareTurn['responses'][string] }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 text-xs text-slate-600">
      {res.latency && <span>{(res.latency/1000).toFixed(1)}s</span>}
      {res.tokens && <span>{res.tokens} tok</span>}
      {res.latency && res.tokens && <span>{Math.round(res.tokens/(res.latency/1000))}/s</span>}
      <button onClick={() => { navigator.clipboard.writeText(res.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
        className="ml-auto flex items-center gap-1 hover:text-white transition-colors">
        {copied ? <CheckIcon size={10} className="text-emerald-400" /> : <Copy size={10} />}
      </button>
    </div>
  )
}

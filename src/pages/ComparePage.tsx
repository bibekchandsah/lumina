import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, X, Send, Zap, Copy, Check as CheckIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '@/store'
import { callGemini } from '@/services/gemini'
import { callGroq } from '@/services/groq'
import { callGrok } from '@/services/grok'
import { PROVIDER_INFO, PROVIDER_MODELS, type Provider, type APIKey } from '@/types'
import { cn } from '@/utils/cn'
import { Select } from '@/components/ui/Select'

interface PanelResult {
  content: string
  streaming: string
  loading: boolean
  error: string
  latency: number | null
  tokens: number | null
  provider: Provider
  model: string
}

interface Panel {
  id: string
  provider: Provider
  keyId: string
  model: string
}

async function runPanel(
  panel: Panel,
  key: APIKey,
  prompt: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<{ content: string; tokens: number; latency: number }> {
  const start = Date.now()
  const msgs = [{ id: '', role: 'user' as const, content: prompt, timestamp: Date.now() }]
  let accumulated = ''
  const chunk = (t: string) => { accumulated += t; onChunk(accumulated) }

  let result: { content: string; tokens: number }
  switch (panel.provider) {
    case 'gemini': result = await callGemini(key.key, panel.model, msgs, chunk, signal); break
    case 'groq':   result = await callGroq(key.key, panel.model, msgs, chunk, signal); break
    case 'grok':   result = await callGrok(key.key, panel.model, msgs, chunk, signal); break
  }
  return { content: result.content || accumulated, tokens: result.tokens, latency: Date.now() - start }
}

export function ComparePage() {
  const { keys } = useStore()
  const [panels, setPanels] = useState<Panel[]>(() => {
    const defaults: Panel[] = []
    const providers: Provider[] = ['gemini', 'groq', 'grok']
    for (const p of providers) {
      const k = keys.find(k => k.provider === p && k.status === 'active')
      if (k) defaults.push({ id: crypto.randomUUID(), provider: p, keyId: k.id, model: k.model || PROVIDER_MODELS[p][0] })
      if (defaults.length === 2) break
    }
    if (defaults.length === 0 && keys.length > 0) {
      const k = keys[0]
      defaults.push({ id: crypto.randomUUID(), provider: k.provider, keyId: k.id, model: k.model || PROVIDER_MODELS[k.provider][0] })
    }
    return defaults
  })
  const [results, setResults] = useState<Record<string, PanelResult>>({})
  const [prompt, setPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const updateResult = useCallback((id: string, patch: Partial<PanelResult>) => {
    setResults(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }, [])

  const addPanel = () => {
    if (panels.length >= 4) return
    const usedProviders = panels.map(p => p.provider)
    const nextProvider = (['gemini', 'groq', 'grok'] as Provider[]).find(p => !usedProviders.includes(p)) || 'gemini'
    const k = keys.find(k => k.provider === nextProvider && k.status === 'active') || keys[0]
    if (!k) return
    setPanels(prev => [...prev, { id: crypto.randomUUID(), provider: k.provider, keyId: k.id, model: k.model || PROVIDER_MODELS[k.provider][0] }])
  }

  const removePanel = (id: string) => setPanels(prev => prev.filter(p => p.id !== id))

  const updatePanel = (id: string, patch: Partial<Panel>) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  const handleSend = async () => {
    const text = prompt.trim()
    if (!text || isRunning || panels.length === 0) return

    abortRef.current = new AbortController()
    setIsRunning(true)

    // Init all panels
    const init: Record<string, PanelResult> = {}
    panels.forEach(p => {
      init[p.id] = { content: '', streaming: '', loading: true, error: '', latency: null, tokens: null, provider: p.provider, model: p.model }
    })
    setResults(init)

    await Promise.allSettled(panels.map(async panel => {
      const key = keys.find(k => k.id === panel.keyId)
      if (!key) { updateResult(panel.id, { loading: false, error: 'No API key selected' }); return }
      try {
        const { content, tokens, latency } = await runPanel(
          panel, key, text,
          (streaming) => updateResult(panel.id, { streaming }),
          abortRef.current!.signal
        )
        updateResult(panel.id, { content, streaming: '', loading: false, latency, tokens })
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === 'AbortError') {
          updateResult(panel.id, { loading: false, streaming: '', content: init[panel.id]?.streaming || '' })
        } else {
          updateResult(panel.id, { loading: false, error: (e as { message?: string })?.message || 'Error' })
        }
      }
    }))

    setIsRunning(false)
  }

  const handleStop = () => { abortRef.current?.abort(); setIsRunning(false) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const activeKeys = keys.filter(k => k.status === 'active')

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center gap-3 glass-dark shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-semibold gradient-text">Lumina</span>
        <span className="text-slate-600 text-sm">· Model Compare</span>
        <Link to="/" className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={13} /> Back to chat
        </Link>
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-hidden flex gap-0">
        <AnimatePresence initial={false}>
          {panels.map((panel, idx) => {
            const result = results[panel.id]
            const providerKeys = activeKeys.filter(k => k.provider === panel.provider)
            const allKeys = activeKeys

            return (
              <motion.div
                key={panel.id}
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: `${100 / panels.length}%` }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={cn('flex flex-col h-full overflow-hidden', idx > 0 && 'border-l border-white/10')}
              >
                {/* Panel header */}
                <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 shrink-0 bg-black/20">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PROVIDER_INFO[panel.provider].color }} />
                  <Select
                    value={panel.provider}
                    onChange={v => {
                      const p = v as Provider
                      const k = activeKeys.find(k => k.provider === p) || activeKeys[0]
                      if (k) updatePanel(panel.id, { provider: p, keyId: k.id, model: k.model || PROVIDER_MODELS[p][0] })
                    }}
                    options={(['gemini', 'groq', 'grok'] as Provider[]).map(p => ({ value: p, label: PROVIDER_INFO[p].name }))}
                    className="w-28"
                  />
                  <Select
                    value={panel.model}
                    onChange={v => updatePanel(panel.id, { model: v })}
                    options={PROVIDER_MODELS[panel.provider].map(m => ({ value: m }))}
                    className="flex-1 min-w-0"
                  />
                  {/* Key selector if multiple keys */}
                  {providerKeys.length > 1 && (
                    <Select
                      value={panel.keyId}
                      onChange={v => updatePanel(panel.id, { keyId: v })}
                      options={providerKeys.map(k => ({ value: k.id, label: k.label }))}
                      className="w-28"
                    />
                  )}
                  {allKeys.length === 0 && (
                    <span className="text-xs text-red-400">No keys</span>
                  )}
                  {panels.length > 1 && (
                    <button onClick={() => removePanel(panel.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Response area */}
                <div className="flex-1 overflow-y-auto p-4">
                  {!result && (
                    <div className="h-full flex items-center justify-center text-slate-700 text-sm">
                      Response will appear here
                    </div>
                  )}
                  {result?.error && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      {result.error}
                    </div>
                  )}
                  {result && !result.error && (
                    <div className="space-y-3">
                      <div className="text-sm text-slate-200 leading-relaxed">
                        {result.loading && !result.streaming ? (
                          <div className="flex gap-1.5 items-center py-2">
                            {[0,1,2].map(i => (
                              <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                            ))}
                          </div>
                        ) : (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {result.streaming || result.content}
                            </ReactMarkdown>
                            {result.loading && (
                              <span className="inline-block w-[2px] h-[1em] bg-violet-400 animate-pulse ml-0.5 align-middle rounded-full" />
                            )}
                          </div>
                        )}
                      </div>
                      {!result.loading && result.content && (
                        <ResultMeta result={result} />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Add panel button */}
        {panels.length < 4 && activeKeys.length > 0 && (
          <div className="flex items-center px-2 border-l border-white/10">
            <button onClick={addPanel}
              className="w-8 h-8 rounded-xl glass border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              title="Add panel"
            >
              <Plus size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-4 shrink-0">
        {activeKeys.length === 0 && (
          <p className="text-center text-xs text-amber-500 mb-2">Add API keys in <Link to="/" className="underline">Settings</Link> to compare models</p>
        )}
        <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3 focus-within:border-violet-500/50 transition-all max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt to send to all models…"
            rows={1}
            disabled={isRunning}
            autoFocus
            className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-slate-600 leading-relaxed disabled:opacity-50 py-0"
            style={{ maxHeight: '120px', minHeight: '24px' }}
          />
          <button
            onClick={isRunning ? handleStop : handleSend}
            disabled={!isRunning && (!prompt.trim() || activeKeys.length === 0)}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white transition-all hover:scale-105 disabled:opacity-40 disabled:scale-100 shrink-0"
          >
            {isRunning
              ? <span className="w-3 h-3 rounded-sm bg-white" />
              : <Send size={16} />
            }
          </button>
        </div>
        <p className="text-center text-xs text-slate-700 mt-2">
          Sending to {panels.length} model{panels.length !== 1 ? 's' : ''} simultaneously
        </p>
      </div>
    </div>
  )
}

function ResultMeta({ result }: { result: PanelResult }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-white/10 text-xs text-slate-600">
      {result.latency && <span>{(result.latency / 1000).toFixed(1)}s</span>}
      {result.tokens && <span>{result.tokens} tokens</span>}
      {result.latency && result.tokens && (
        <span>{Math.round(result.tokens / (result.latency / 1000))} tok/s</span>
      )}
      <button onClick={copy} className="ml-auto flex items-center gap-1 hover:text-white transition-colors">
        {copied ? <CheckIcon size={11} className="text-emerald-400" /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

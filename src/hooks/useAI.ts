import { useStore } from '@/store'
import { callGemini } from '@/services/gemini'
import { callGroq } from '@/services/groq'
import { callGrok } from '@/services/grok'
import { estimateTokens } from '@/utils/crypto'
import type { Provider, APIKey, Message } from '@/types'

const PROVIDER_ORDER: Provider[] = ['gemini', 'groq', 'grok']

async function callProvider(
  provider: Provider,
  key: APIKey,
  messages: Message[],
  onChunk?: (t: string) => void,
  signal?: AbortSignal
): Promise<{ content: string; tokens: number }> {
  const model = key.model || ''
  switch (provider) {
    case 'gemini': return callGemini(key.key, model, messages, onChunk, signal)
    case 'groq':   return callGroq(key.key, model, messages, onChunk, signal)
    case 'grok':   return callGrok(key.key, model, messages, onChunk, signal)
  }
}

export function useAI() {
  const store = useStore()

  async function sendMessage(chatId: string, userContent: string) {
    const { addMessage, setIsStreaming, setStreamingContent, setAbortController } = store

    addMessage(chatId, { role: 'user', content: userContent })

    const freshChat = useStore.getState().chats.find(c => c.id === chatId)
    const history: Message[] = freshChat ? freshChat.messages : [{ id: '', role: 'user', content: userContent, timestamp: Date.now() }]

    const { settings, getActiveKeys, updateKeyStatus, updateKeyUsage } = useStore.getState()

    const abort = new AbortController()
    setAbortController(abort)
    setIsStreaming(true)
    setStreamingContent('')

    const providers = settings.defaultProvider === 'auto'
      ? PROVIDER_ORDER
      : [settings.defaultProvider as Provider, ...PROVIDER_ORDER.filter(p => p !== settings.defaultProvider)]

    let lastError = ''

    for (const provider of providers) {
      const keys = getActiveKeys(provider)
      if (!keys.length) continue

      for (const key of keys) {
        const retries = settings.retryCount
        for (let attempt = 0; attempt <= retries; attempt++) {
          const start = Date.now()
          try {
            let accumulated = ''
            const onChunk = settings.streamingEnabled
              ? (text: string) => { accumulated += text; setStreamingContent(accumulated) }
              : undefined

            const result = await callProvider(provider, key, history, onChunk, abort.signal)
            const latency = Date.now() - start
            const tokens = result.tokens || estimateTokens(result.content)

            updateKeyUsage(key.id, tokens, latency, true)
            setIsStreaming(false)
            setStreamingContent('')
            setAbortController(null)

            addMessage(chatId, {
              role: 'assistant',
              content: result.content,
              provider,
              model: key.model,
              keyId: key.id,
              latency,
              tokens,
            })
            return
          } catch (err: unknown) {
            // If aborted by user, save partial content and exit cleanly
            if (abort.signal.aborted) {
              const partial = useStore.getState().streamingContent
              setIsStreaming(false)
              setStreamingContent('')
              setAbortController(null)
              if (partial.trim()) {
                addMessage(chatId, {
                  role: 'assistant',
                  content: partial + '\n\n*(stopped)*',
                  provider,
                  model: key.model,
                  keyId: key.id,
                  latency: Date.now() - start,
                  tokens: estimateTokens(partial),
                })
              }
              return
            }

            const e = err as { status?: number; message?: string }
            const status = e?.status
            lastError = e?.message || 'Unknown error'

            if (status === 401 || status === 403) {
              updateKeyStatus(key.id, 'failed')
              updateKeyUsage(key.id, 0, Date.now() - start, false)
              break
            }
            if (status === 429) {
              updateKeyStatus(key.id, 'rate_limited', settings.cooldownMinutes)
              updateKeyUsage(key.id, 0, Date.now() - start, false)
              break
            }
            if (attempt === retries) {
              updateKeyUsage(key.id, 0, Date.now() - start, false)
            }
          }
        }
      }
    }

    if (!abort.signal.aborted) {
      setIsStreaming(false)
      setStreamingContent('')
      setAbortController(null)
      addMessage(chatId, {
        role: 'error',
        content: `All API keys exhausted. Last error: ${lastError}\n\nPlease add valid API keys in Settings.`,
      })
    }
  }

  async function regenerate(chatId: string, assistantMsgId: string, _userContent: string) {
    const { setIsStreaming, setStreamingContent, setAbortController, replaceMessage } = useStore.getState()
    const { settings, getActiveKeys, updateKeyStatus, updateKeyUsage } = useStore.getState()

    const freshChat = useStore.getState().chats.find(c => c.id === chatId)
    if (!freshChat) return

    // Build history up to (but not including) the assistant message being replaced
    const msgIdx = freshChat.messages.findIndex(m => m.id === assistantMsgId)
    const history = msgIdx > 0 ? freshChat.messages.slice(0, msgIdx) : freshChat.messages

    const abort = new AbortController()
    setAbortController(abort)
    setIsStreaming(true)
    setStreamingContent('')

    const providers = settings.defaultProvider === 'auto'
      ? PROVIDER_ORDER
      : [settings.defaultProvider as Provider, ...PROVIDER_ORDER.filter(p => p !== settings.defaultProvider)]

    let lastError = ''

    for (const provider of providers) {
      const keys = getActiveKeys(provider)
      if (!keys.length) continue
      for (const key of keys) {
        const retries = settings.retryCount
        for (let attempt = 0; attempt <= retries; attempt++) {
          const start = Date.now()
          try {
            let accumulated = ''
            const onChunk = settings.streamingEnabled
              ? (text: string) => { accumulated += text; setStreamingContent(accumulated) }
              : undefined

            const result = await callProvider(provider, key, history, onChunk, abort.signal)
            const latency = Date.now() - start
            const tokens = result.tokens || estimateTokens(result.content)

            updateKeyUsage(key.id, tokens, latency, true)
            setIsStreaming(false)
            setStreamingContent('')
            setAbortController(null)

            // Replace in-place instead of appending
            replaceMessage(chatId, assistantMsgId, result.content)
            return
          } catch (err: unknown) {
            if (abort.signal.aborted) {
              const partial = useStore.getState().streamingContent
              setIsStreaming(false)
              setStreamingContent('')
              setAbortController(null)
              if (partial.trim()) replaceMessage(chatId, assistantMsgId, partial + '\n\n*(stopped)*')
              return
            }
            const e = err as { status?: number; message?: string }
            const status = e?.status
            lastError = e?.message || 'Unknown error'
            if (status === 401 || status === 403) { updateKeyStatus(key.id, 'failed'); updateKeyUsage(key.id, 0, Date.now() - start, false); break }
            if (status === 429) { updateKeyStatus(key.id, 'rate_limited', settings.cooldownMinutes); updateKeyUsage(key.id, 0, Date.now() - start, false); break }
            if (attempt === retries) updateKeyUsage(key.id, 0, Date.now() - start, false)
          }
        }
      }
    }

    if (!abort.signal.aborted) {
      setIsStreaming(false)
      setStreamingContent('')
      setAbortController(null)
      replaceMessage(chatId, assistantMsgId, `Error: ${lastError || 'All API keys exhausted'}`)
    }
  }

  return { sendMessage, regenerate }
}

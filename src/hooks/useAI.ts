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
  onChunk?: (t: string) => void
): Promise<{ content: string; tokens: number }> {
  const model = key.model || ''
  switch (provider) {
    case 'gemini': return callGemini(key.key, model, messages, onChunk)
    case 'groq':   return callGroq(key.key, model, messages, onChunk)
    case 'grok':   return callGrok(key.key, model, messages, onChunk)
  }
}

export function useAI() {
  const store = useStore()

  async function sendMessage(chatId: string, userContent: string) {
    const { addMessage, setIsStreaming, setStreamingContent } = store

    // Add user message first
    addMessage(chatId, { role: 'user', content: userContent })

    // Read fresh state AFTER adding the message to get up-to-date chat history
    const freshChat = useStore.getState().chats.find(c => c.id === chatId)
    const history: Message[] = freshChat ? freshChat.messages : [{ id: '', role: 'user', content: userContent, timestamp: Date.now() }]

    // Always read settings/keys fresh to avoid stale closures
    const { settings, getActiveKeys, updateKeyStatus, updateKeyUsage } = useStore.getState()

    const providers = settings.defaultProvider === 'auto'
      ? PROVIDER_ORDER
      : [settings.defaultProvider as Provider, ...PROVIDER_ORDER.filter(p => p !== settings.defaultProvider)]

    setIsStreaming(true)
    setStreamingContent('')

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

            const result = await callProvider(provider, key, history, onChunk)
            const latency = Date.now() - start
            const tokens = result.tokens || estimateTokens(result.content)

            updateKeyUsage(key.id, tokens, latency, true)
            setIsStreaming(false)
            setStreamingContent('')

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
            const e = err as { status?: number; message?: string }
            const status = e?.status
            lastError = e?.message || 'Unknown error'

            if (status === 401 || status === 403) {
              updateKeyStatus(key.id, 'failed')
              updateKeyUsage(key.id, 0, Date.now() - start, false)
              break // try next key
            }
            if (status === 429) {
              updateKeyStatus(key.id, 'rate_limited', settings.cooldownMinutes)
              updateKeyUsage(key.id, 0, Date.now() - start, false)
              break // try next key
            }
            // other errors: retry
            if (attempt === retries) {
              updateKeyUsage(key.id, 0, Date.now() - start, false)
            }
          }
        }
      }
    }

    setIsStreaming(false)
    setStreamingContent('')
    addMessage(chatId, {
      role: 'error',
      content: `All API keys exhausted. Last error: ${lastError}\n\nPlease add valid API keys in Settings.`,
    })
  }

  return { sendMessage }
}

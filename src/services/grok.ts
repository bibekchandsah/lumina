import type { Message } from '@/types'

export async function callGrok(
  apiKey: string,
  model: string,
  messages: Message[],
  onChunk?: (text: string) => void
): Promise<{ content: string; tokens: number }> {
  const msgs = messages
    .filter(m => m.role !== 'error')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const streaming = !!onChunk
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: msgs, stream: streaming, max_tokens: 2048 }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message || res.statusText
    throw Object.assign(new Error(msg), { status: res.status })
  }

  if (streaming && res.body) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let tokens = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
        try {
          const data = JSON.parse(line.slice(6))
          const text = data?.choices?.[0]?.delta?.content || ''
          if (text) { full += text; onChunk(text) }
          tokens = data?.usage?.total_tokens || tokens
        } catch { /* skip */ }
      }
    }
    return { content: full, tokens }
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  const tokens = data?.usage?.total_tokens || 0
  return { content, tokens }
}

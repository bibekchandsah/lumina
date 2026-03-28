import type { Message } from '@/types'

export async function callGemini(
  apiKey: string,
  model: string,
  messages: Message[],
  onChunk?: (text: string) => void
): Promise<{ content: string; tokens: number }> {
  const contents = messages
    .filter(m => m.role !== 'error')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

  const streaming = !!onChunk
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${streaming ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}${streaming ? '&alt=sse' : ''}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 2048 } }),
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
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (text) { full += text; onChunk(text) }
          tokens = data?.usageMetadata?.totalTokenCount || tokens
        } catch { /* skip */ }
      }
    }
    return { content: full, tokens }
  }

  const data = await res.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const tokens = data?.usageMetadata?.totalTokenCount || 0
  return { content, tokens }
}

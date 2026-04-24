export type Provider = 'gemini' | 'groq' | 'grok'

export type KeyStatus = 'active' | 'failed' | 'rate_limited'
export type SyncStatus = 'idle' | 'offline' | 'syncing' | 'error'

export interface APIKey {
  id: string
  provider: Provider
  key: string
  label: string
  status: KeyStatus
  model?: string
  usage: {
    tokensUsed: number
    requestCount: number
    successCount: number
    failCount: number
    avgLatency: number
  }
  cooldownUntil?: number
  lastUsed?: number
  createdAt: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  provider?: Provider
  model?: string
  keyId?: string
  latency?: number
  tokens?: number
  timestamp: number
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  sharedId?: string
  sharedAt?: number
  pinned?: boolean
  archived?: boolean
  compareMode?: boolean
  comparePanels?: Array<{ provider: Provider; model: string }>
}

export interface AppSettings {
  defaultProvider: Provider | 'auto'
  fallbackEnabled: boolean
  parallelMode: boolean
  streamingEnabled: boolean
  retryCount: number
  cooldownMinutes: number
  theme: 'dark'
}

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  grok: ['grok-3', 'grok-3-fast', 'grok-2-1212'],
}

export const PROVIDER_INFO: Record<Provider, { name: string; color: string; keyUrl: string; docsUrl: string }> = {
  gemini: {
    name: 'Gemini',
    color: '#4285f4',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/docs',
  },
  groq: {
    name: 'Groq',
    color: '#f55036',
    keyUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs',
  },
  grok: {
    name: 'Grok (xAI)',
    color: '#1da1f2',
    keyUrl: 'https://x.ai/api',
    docsUrl: 'https://docs.x.ai',
  },
}

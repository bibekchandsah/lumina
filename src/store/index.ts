import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { APIKey, Chat, Message, AppSettings, Provider } from '@/types'
import { PROVIDER_MODELS } from '@/types'

interface AppStore {
  // Keys
  keys: APIKey[]
  addKey: (provider: Provider, rawKey: string, label: string, model?: string) => void
  removeKey: (id: string) => void
  updateKeyStatus: (id: string, status: APIKey['status'], cooldownMinutes?: number) => void
  updateKeyUsage: (id: string, tokens: number, latency: number, success: boolean) => void
  updateKey: (id: string, patch: Partial<Pick<APIKey, 'label' | 'model'>>) => void
  getActiveKeys: (provider: Provider) => APIKey[]
  getAllActiveKeys: () => APIKey[]

  // Chats
  chats: Chat[]
  activeChatId: string | null
  rememberedActiveChatId: string | null
  createChat: (overrides?: Partial<Chat>) => string
  deleteChat: (id: string) => void
  setActiveChat: (id: string | null, rememberForReload?: boolean) => void
  clearRememberedActiveChat: () => void
  addMessage: (chatId: string, msg: Omit<Message, 'id' | 'timestamp'>) => void
  updateChatTitle: (chatId: string, title: string) => void
  updateChatShare: (chatId: string, sharedId: string | null, sharedAt?: number) => void
  activeChat: () => Chat | null
  editMessage: (chatId: string, messageId: string, newContent: string) => void
  togglePin: (chatId: string) => void
  toggleArchive: (chatId: string) => void
  getMessageContext: (chatId: string, assistantMsgId: string) => string | null
  replaceMessage: (chatId: string, messageId: string, newContent: string) => void
  getNextAssistantMessage: (chatId: string, userMsgId: string) => string | null

  // Settings
  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  streamingContent: string
  setStreamingContent: (v: string) => void
  abortController: AbortController | null
  setAbortController: (c: AbortController | null) => void
  stopStreaming: () => void
  activeChatCompareId: string | null
  setActiveChatCompareId: (id: string | null) => void
}

const defaultSettings: AppSettings = {
  defaultProvider: 'auto',
  fallbackEnabled: true,
  parallelMode: false,
  streamingEnabled: true,
  retryCount: 2,
  cooldownMinutes: 5,
  theme: 'dark',
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      keys: [],
      addKey: (provider, rawKey, label, model) => {
        const defaultModel = PROVIDER_MODELS[provider][0]
        const newKey: APIKey = {
          id: crypto.randomUUID(),
          provider,
          key: rawKey,
          label: label || `${provider} key`,
          status: 'active',
          model: model || defaultModel,
          usage: { tokensUsed: 0, requestCount: 0, successCount: 0, failCount: 0, avgLatency: 0 },
          createdAt: Date.now(),
        }
        set(s => ({ keys: [...s.keys, newKey] }))
      },
      removeKey: (id) => set(s => ({ keys: s.keys.filter(k => k.id !== id) })),
      updateKey: (id, patch) => set(s => ({ keys: s.keys.map(k => k.id === id ? { ...k, ...patch } : k) })),
      updateKeyStatus: (id, status, cooldownMinutes) => set(s => ({
        keys: s.keys.map(k => k.id === id ? {
          ...k, status,
          cooldownUntil: status === 'rate_limited' && cooldownMinutes
            ? Date.now() + cooldownMinutes * 60 * 1000 : k.cooldownUntil
        } : k)
      })),
      updateKeyUsage: (id, tokens, latency, success) => set(s => ({
        keys: s.keys.map(k => {
          if (k.id !== id) return k
          const prev = k.usage
          const count = prev.requestCount + 1
          return {
            ...k,
            lastUsed: Date.now(),
            usage: {
              tokensUsed: prev.tokensUsed + tokens,
              requestCount: count,
              successCount: prev.successCount + (success ? 1 : 0),
              failCount: prev.failCount + (success ? 0 : 1),
              avgLatency: Math.round((prev.avgLatency * (count - 1) + latency) / count),
            }
          }
        })
      })),
      getActiveKeys: (provider) => {
        const now = Date.now()
        return get().keys.filter(k =>
          k.provider === provider &&
          (k.status === 'active' || (k.status === 'rate_limited' && k.cooldownUntil && k.cooldownUntil < now))
        )
      },
      getAllActiveKeys: () => {
        const now = Date.now()
        return get().keys.filter(k =>
          k.status === 'active' || (k.status === 'rate_limited' && k.cooldownUntil && k.cooldownUntil < now)
        )
      },

      chats: [],
      activeChatId: null,
      rememberedActiveChatId: null,
      createChat: (overrides) => {
        const id = crypto.randomUUID()
        const chat: Chat = { id, title: 'New Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now(), ...overrides }
        set(s => ({ chats: [chat, ...s.chats], activeChatId: id, rememberedActiveChatId: null }))
        return id
      },
      deleteChat: (id) => set(s => {
        const chats = s.chats.filter(c => c.id !== id)
        return {
          chats,
          activeChatId: s.activeChatId === id ? (chats[0]?.id ?? null) : s.activeChatId,
          rememberedActiveChatId: s.rememberedActiveChatId === id ? null : s.rememberedActiveChatId,
        }
      }),
      setActiveChat: (id, rememberForReload = false) => set({
        activeChatId: id,
        rememberedActiveChatId: rememberForReload && id ? id : get().rememberedActiveChatId,
      }),
      clearRememberedActiveChat: () => set({ rememberedActiveChatId: null }),
      addMessage: (chatId, msg) => set(s => ({
        chats: s.chats.map(c => {
          if (c.id !== chatId) return c
          const message: Message = { ...msg, id: crypto.randomUUID(), timestamp: Date.now() }
          const title = c.messages.length === 0 && msg.role === 'user'
            ? msg.content.slice(0, 40) + (msg.content.length > 40 ? '…' : '')
            : c.title
          return { ...c, messages: [...c.messages, message], title, updatedAt: Date.now() }
        })
      })),
      updateChatTitle: (chatId, title) => set(s => ({
        chats: s.chats.map(c => c.id === chatId ? { ...c, title } : c)
      })),
      updateChatShare: (chatId, sharedId, sharedAt) => set(s => ({
        chats: s.chats.map(c => {
          if (c.id !== chatId) return c
          if (!sharedId) {
            const { sharedId: _sid, sharedAt: _sat, ...rest } = c
            return rest
          }
          return { ...c, sharedId, sharedAt: sharedAt ?? Date.now() }
        })
      })),
      // Truncate messages from messageId onward (keep messages before it)
      editMessage: (chatId, messageId, _newContent) => set(s => ({
        chats: s.chats.map(c => {
          if (c.id !== chatId) return c
          const idx = c.messages.findIndex(m => m.id === messageId)
          if (idx === -1) return c
          const trimmed = c.messages.slice(0, idx)
          return { ...c, messages: trimmed, updatedAt: Date.now() }
        })
      })),
      togglePin: (chatId) => set(s => ({
        chats: s.chats.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c)
      })),
      toggleArchive: (chatId) => set(s => ({
        chats: s.chats.map(c => c.id === chatId ? { ...c, archived: !c.archived } : c)
      })),
      // Returns the user message content that preceded a given assistant message
      getMessageContext: (chatId, assistantMsgId) => {
        const chat = get().chats.find(c => c.id === chatId)
        if (!chat) return null
        const idx = chat.messages.findIndex(m => m.id === assistantMsgId)
        if (idx <= 0) return null
        for (let i = idx - 1; i >= 0; i--) {
          if (chat.messages[i].role === 'user') return chat.messages[i].content
        }
        return null
      },
      getNextAssistantMessage: (chatId, userMsgId) => {
        const chat = get().chats.find(c => c.id === chatId)
        if (!chat) return null
        const idx = chat.messages.findIndex(m => m.id === userMsgId)
        if (idx === -1) return null
        for (let i = idx + 1; i < chat.messages.length; i++) {
          if (chat.messages[i].role === 'assistant') return chat.messages[i].id
        }
        return null
      },
      // Replace user message content in-place (no truncation)
      replaceMessage: (chatId, messageId, newContent) => set(s => ({
        chats: s.chats.map(c => {
          if (c.id !== chatId) return c
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === messageId ? { ...m, content: newContent, timestamp: Date.now() } : m
            ),
            updatedAt: Date.now(),
          }
        })
      })),
      activeChat: () => {
        const { chats, activeChatId } = get()
        return chats.find(c => c.id === activeChatId) ?? null
      },

      settings: defaultSettings,
      updateSettings: (s) => set(prev => ({ settings: { ...prev.settings, ...s } })),

      settingsOpen: false,
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      sidebarOpen: true,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      isStreaming: false,
      setIsStreaming: (v) => set({ isStreaming: v }),
      streamingContent: '',
      setStreamingContent: (v) => set({ streamingContent: v }),
      abortController: null,
      setAbortController: (c) => set({ abortController: c }),
      stopStreaming: () => {
        const { abortController } = get()
        abortController?.abort()
        set({ isStreaming: false, streamingContent: '', abortController: null })
      },
      activeChatCompareId: null,
      setActiveChatCompareId: (id) => set({ activeChatCompareId: id }),
    }),
    {
      name: 'lumina-store',
      partialize: (s) => ({
        keys: s.keys,
        chats: s.chats,
        settings: s.settings,
        rememberedActiveChatId: s.rememberedActiveChatId,
      }),
    }
  )
)

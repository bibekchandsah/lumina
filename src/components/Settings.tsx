import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, ExternalLink, Eye, EyeOff, RefreshCw, Download, Upload, Pencil, DownloadCloud, Smartphone } from 'lucide-react'
import { useStore } from '@/store'
import { PROVIDER_INFO, PROVIDER_MODELS, type Provider } from '@/types'
import { cn } from '@/utils/cn'
import { Select } from './ui/Select'
import { Toggle } from './ui/Toggle'

const STATUS_STYLES = {
  active: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  failed: 'text-red-400 bg-red-400/10 border-red-400/30',
  rate_limited: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
}
const STATUS_LABEL = { active: '🟢 Active', failed: '🔴 Failed', rate_limited: '⚠️ Limited' }

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

declare global {
  interface Window {
    __luminaInstallPrompt: BeforeInstallPromptEvent | null
  }
}

export function Settings() {
  const { settingsOpen, setSettingsOpen, keys, addKey, removeKey, updateKeyStatus, updateKey, settings, updateSettings } = useStore()
  const [tab, setTab] = useState<'keys' | 'settings'>('keys')
  const [form, setForm] = useState({ provider: 'gemini' as Provider, key: '', label: '', model: '' })
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ label: string; model: string }>({ label: '', model: '' })
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const onInstallPromptReady = () => {
      if (window.__luminaInstallPrompt) {
        setInstallPrompt(window.__luminaInstallPrompt)
      }
    }

    const onAppInstalled = () => {
      setInstallPrompt(null)
      setIsInstalled(true)
    }

    const isStandaloneSafari = 'standalone' in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone)
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches || isStandaloneSafari)
    if (window.__luminaInstallPrompt) {
      setInstallPrompt(window.__luminaInstallPrompt)
    }

    window.addEventListener('lumina:installprompt-ready', onInstallPromptReady)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('lumina:installprompt-ready', onInstallPromptReady)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (settingsOpen && window.__luminaInstallPrompt) {
      setInstallPrompt(window.__luminaInstallPrompt)
    }
  }, [settingsOpen])

  const handleInstallApp = async () => {
    if (!installPrompt) {
      alert('Use the install icon in your browser address bar to install the app.')
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      window.__luminaInstallPrompt = null
    }
  }

  const handleAdd = () => {
    if (!form.key.trim()) return
    addKey(form.provider, form.key.trim(), form.label || `${form.provider} key`, form.model || undefined)
    setForm({ provider: 'gemini', key: '', label: '', model: '' })
    setAdding(false)
  }

  const exportKeys = () => {
    const data = keys.map(k => ({ provider: k.provider, key: k.key, label: k.label, model: k.model }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lumina-keys.json'; a.click()
  }

  const importKeys = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text) as Array<{ provider: Provider; key: string; label: string; model?: string }>
        data.forEach(k => addKey(k.provider, k.key, k.label, k.model))
      } catch { alert('Invalid JSON file') }
    }
    input.click()
  }

  return (
    <AnimatePresence>
      {settingsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setSettingsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-full sm:w-[480px] glass-dark border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="rounded-lg p-2 text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 sm:px-6 py-3 border-b border-white/10 overflow-x-auto">
              {(['keys', 'settings'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('px-4 py-1.5 rounded-lg text-sm capitalize transition-all whitespace-nowrap', tab === t ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30' : 'text-slate-500 hover:text-white')}
                >
                  {t === 'keys' ? 'API Keys' : 'Preferences'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {tab === 'keys' ? (
                <>
                  {/* PWA install */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Install App</p>
                    <div className="glass rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                          <Smartphone size={16} className="text-violet-300" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium">Install Lumina</p>
                          <p className="text-xs text-slate-500">Add Lumina to your home screen or desktop for a more app-like experience.</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={handleInstallApp}
                          disabled={isInstalled}
                          className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <DownloadCloud size={14} />
                          {isInstalled ? 'Installed' : installPrompt ? 'Install App' : 'Use Browser Install'}
                        </button>
                        {isInstalled ? (
                          <div className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-center">
                            Already installed on this device
                          </div>
                        ) : (
                          <div className="px-3 py-2 rounded-lg border border-white/10 bg-black/20 text-slate-500 text-xs flex items-center justify-center text-center">
                            {installPrompt ? 'Install is available now' : 'Install prompt was not captured — use browser address-bar install icon'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Provider links */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Get API Keys</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(Object.entries(PROVIDER_INFO) as [Provider, typeof PROVIDER_INFO[Provider]][]).map(([p, info]) => (
                        <a key={p} href={info.keyUrl} target="_blank" rel="noopener noreferrer"
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl glass hover:bg-white/10 transition-all text-center group justify-center"
                        >
                          <span className="text-xs font-medium text-white">{info.name}</span>
                          <ExternalLink size={12} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Add key */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Your Keys ({keys.length})</p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={importKeys} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                          <Upload size={12} /> Import
                        </button>
                        <button onClick={exportKeys} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                          <Download size={12} /> Export
                        </button>
                        <button onClick={() => setAdding(!adding)}
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                          <Plus size={12} /> Add Key
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {adding && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="glass rounded-xl p-4 space-y-3 overflow-hidden"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Provider</label>
                              <Select
                                value={form.provider}
                                onChange={v => setForm(f => ({ ...f, provider: v as Provider, model: '' }))}
                                options={(Object.keys(PROVIDER_INFO) as Provider[]).map(p => ({ value: p, label: PROVIDER_INFO[p].name }))}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Model</label>
                              <Select
                                value={form.model || PROVIDER_MODELS[form.provider][0]}
                                onChange={v => setForm(f => ({ ...f, model: v }))}
                                options={PROVIDER_MODELS[form.provider].map(m => ({ value: m }))}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Label (optional)</label>
                            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                              placeholder="e.g. My Gemini Key"
                              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 placeholder-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">API Key</label>
                            <input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                              type="password" placeholder="Paste your API key here"
                              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 placeholder-slate-600 font-mono"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleAdd} disabled={!form.key.trim()}
                              className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-40"
                            >
                              Add Key
                            </button>
                            <button onClick={() => setAdding(false)}
                              className="px-4 py-2 rounded-lg glass hover:bg-white/10 text-slate-400 text-sm transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Key list */}
                  <div className="space-y-2">
                    {keys.length === 0 && (
                      <p className="text-center text-slate-600 text-sm py-6">No keys added yet</p>
                    )}
                    {keys.map(key => {
                      const isEditing = editingId === key.id
                      return (
                        <motion.div key={key.id} layout className="glass rounded-xl p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white truncate">{key.label}</span>
                                <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLES[key.status])}>
                                  {STATUS_LABEL[key.status]}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs" style={{ color: PROVIDER_INFO[key.provider].color + '99' }}>
                                  {PROVIDER_INFO[key.provider].name}
                                </span>
                                <span className="text-xs text-slate-600">·</span>
                                <span className="text-xs text-slate-600">{key.model}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 shrink-0 justify-end">
                              {key.status !== 'active' && (
                                <button onClick={() => updateKeyStatus(key.id, 'active')}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-emerald-400 transition-all" title="Reset to active">
                                  <RefreshCw size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (isEditing) { setEditingId(null) }
                                  else { setEditingId(key.id); setEditForm({ label: key.label, model: key.model || '' }) }
                                }}
                                className={cn('p-1.5 rounded-lg transition-all text-slate-500', isEditing ? 'bg-violet-500/20 text-violet-400' : 'hover:bg-white/10 hover:text-white')}
                                title="Edit label & model"
                              >
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => setShowKeys(s => ({ ...s, [key.id]: !s[key.id] }))}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all">
                                {showKeys[key.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button onClick={() => removeKey(key.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Inline edit form */}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden space-y-2 pt-1 border-t border-white/10"
                              >
                                <div>
                                  <label className="text-xs text-slate-500 mb-1 block">Label</label>
                                  <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-500 mb-1 block">Model</label>
                                  <div className="flex gap-2">
                                    <Select
                                      value={editForm.model}
                                      onChange={v => setEditForm(f => ({ ...f, model: v }))}
                                      options={PROVIDER_MODELS[key.provider].map(m => ({ value: m }))}
                                      className="flex-1"
                                    />
                                    <input value={editForm.model} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                                      placeholder="or type custom model"
                                      className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50 placeholder-slate-700"
                                    />
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1">Pick from list or type any model name</p>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => { updateKey(key.id, { label: editForm.label, model: editForm.model }); setEditingId(null) }}
                                    className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all">
                                    Save
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    className="px-3 py-1.5 rounded-lg glass hover:bg-white/10 text-slate-400 text-xs transition-all">
                                    Cancel
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {showKeys[key.id] && (
                            <div className="font-mono text-xs text-slate-500 bg-black/30 rounded-lg px-3 py-2 break-all">
                              {key.key}
                            </div>
                          )}

                          {/* Usage stats */}
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            {[
                              { label: 'Requests', value: key.usage.requestCount },
                              { label: 'Success', value: key.usage.successCount },
                              { label: 'Tokens', value: key.usage.tokensUsed.toLocaleString() },
                              { label: 'Avg ms', value: key.usage.avgLatency || '—' },
                            ].map(stat => (
                              <div key={stat.label} className="text-center">
                                <div className="text-xs font-medium text-white">{stat.value}</div>
                                <div className="text-xs text-slate-600">{stat.label}</div>
                              </div>
                            ))}
                          </div>

                          {key.lastUsed && (
                            <p className="text-xs text-slate-700">Last used: {new Date(key.lastUsed).toLocaleString()}</p>
                          )}
                          {key.cooldownUntil && key.cooldownUntil > Date.now() && (
                            <p className="text-xs text-amber-600">Cooldown until: {new Date(key.cooldownUntil).toLocaleTimeString()}</p>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <SettingRow label="Default Provider" desc="Which provider to try first">
                    <Select
                      value={settings.defaultProvider}
                      onChange={v => updateSettings({ defaultProvider: v as typeof settings.defaultProvider })}
                      options={[
                        { value: 'auto', label: 'Auto (fastest)' },
                        { value: 'gemini', label: 'Gemini' },
                        { value: 'groq', label: 'Groq' },
                        { value: 'grok', label: 'Grok' },
                      ]}
                      className="w-full sm:w-40"
                    />
                  </SettingRow>

                  <SettingToggle label="Fallback Enabled" desc="Auto-switch to next key on failure"
                    value={settings.fallbackEnabled} onChange={v => updateSettings({ fallbackEnabled: v })} />

                  <SettingToggle label="Streaming" desc="Show response as it generates"
                    value={settings.streamingEnabled} onChange={v => updateSettings({ streamingEnabled: v })} />

                  <SettingRow label="Retry Count" desc="Retries per key before switching">
                    <input type="number" min={0} max={5} value={settings.retryCount}
                      onChange={e => updateSettings({ retryCount: Number(e.target.value) })}
                      className="w-full sm:w-20 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50 text-center"
                    />
                  </SettingRow>

                  <SettingRow label="Cooldown (minutes)" desc="Rate-limited key cooldown period">
                    <input type="number" min={1} max={60} value={settings.cooldownMinutes}
                      onChange={e => updateSettings({ cooldownMinutes: Number(e.target.value) })}
                      className="w-full sm:w-20 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50 text-center"
                    />
                  </SettingRow>

                  <div className="glass rounded-xl p-4 text-xs text-slate-500 space-y-1">
                    <p className="text-slate-400 font-medium">⚠️ Security Notice</p>
                    <p>API keys are stored in your browser's localStorage. They never leave your device or get sent to any external server other than the AI providers directly.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function SettingToggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <SettingRow label={label} desc={desc}>
      <Toggle value={value} onChange={onChange} />
    </SettingRow>
  )
}

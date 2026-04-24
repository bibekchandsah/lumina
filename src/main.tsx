import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import { LoginPage } from './pages/LoginPage'
import { SharedChatPage } from './pages/SharedChatPage'
import { ComparePage } from './pages/ComparePage'

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

window.__luminaInstallPrompt = null

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__luminaInstallPrompt = event as BeforeInstallPromptEvent
  window.dispatchEvent(new Event('lumina:installprompt-ready'))
})

window.addEventListener('appinstalled', () => {
  window.__luminaInstallPrompt = null
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/share/:shareId" element={<SharedChatPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Keep app functional even if service worker registration fails.
    });
  });
}

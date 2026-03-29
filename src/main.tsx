import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import { LoginPage } from './pages/LoginPage'
import { SharedChatPage } from './pages/SharedChatPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/share/:shareId" element={<SharedChatPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)

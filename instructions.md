# 🧠 AI Instruction: Build Multi-API Fallback Chatbot (React)

## 🎯 Goal

Create a **modern chatbot web app** where:

* Users can **add multiple API keys** for:

  * Gemini (Google)
  * Groq
  * Grok (xAI)
* System automatically:

  * Uses active key
  * Detects failure / quota exhaustion
  * Switches to next available key
* Show **usage stats (if available)**
* Provide **premium UI/UX**

---

# ⚙️ Tech Stack

* **Frontend:** React + TypeScript + Vite
* **UI:** TailwindCSS + ShadCN UI (or Material UI)
* **State:** Zustand / Redux Toolkit
* **Backend (optional but recommended):**

  * Node.js (Express) OR serverless (Cloudflare Workers / Vercel)
* **Storage:**

  * LocalStorage (basic)
  * IndexedDB (better)
  * Optional: Supabase (cloud sync)

---

# 🔑 API Key Sources (Show in UI)

### 1. Gemini (Google AI)

* URL: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
* Docs: [https://ai.google.dev/docs](https://ai.google.dev/docs)

### 2. Groq

* URL: [https://console.groq.com/keys](https://console.groq.com/keys)
* Docs: [https://console.groq.com/docs](https://console.groq.com/docs)

### 3. Grok (xAI)

* URL: [https://x.ai/api](https://x.ai/api)
* Docs: [https://docs.x.ai](https://docs.x.ai)

👉 Show these as **clickable links in Settings UI**

---

# 🧩 Core Features

## 1. API Key Manager

* Add multiple keys per provider
* Structure:

```ts
type APIKey = {
  id: string
  provider: "gemini" | "groq" | "grok"
  key: string
  status: "active" | "failed" | "rate_limited"
  usage?: {
    used?: number
    limit?: number
    remaining?: number
  }
  lastUsed?: number
}
```

---

## 2. Smart Fallback Logic

### Flow:

```ts
function getNextAvailableKey(providerKeys) {
  return providerKeys.find(k => k.status === "active")
}
```

### On API Call:

1. Pick active key
2. Call API
3. If error:

   * Mark key as:

     * `rate_limited` (429)
     * `failed` (401 / invalid)
4. Switch to next key
5. Retry automatically

---

## 3. Unified AI Request Layer

Create a single function:

```ts
async function sendMessage(prompt: string) {
  const providers = ["gemini", "groq", "grok"]

  for (const provider of providers) {
    const keys = getKeys(provider)

    for (const key of keys) {
      try {
        const response = await callProvider(provider, key, prompt)
        updateUsage(key, response)
        return response
      } catch (err) {
        handleError(key, err)
      }
    }
  }

  throw new Error("All APIs exhausted")
}
```

---

## 4. Provider API Implementations

### Gemini

```ts
POST https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=API_KEY
```

### Groq

```ts
POST https://api.groq.com/openai/v1/chat/completions
Headers: Authorization: Bearer API_KEY
```

### Grok (xAI)

```ts
POST https://api.x.ai/v1/chat/completions
Headers: Authorization: Bearer API_KEY
```

---

## 5. Usage Tracking (Important)

### Gemini

❌ No direct usage API
✔ Estimate via token count

### Groq

❌ No official usage endpoint
✔ Track manually

### Grok

✔ May provide usage (check response metadata)

---

### Add Custom Tracking

```ts
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4)
}
```

---

## 6. Settings Panel

Include:

* API key list
* Add / Remove keys
* Show:

  * Status (🟢 Active / 🔴 Failed / ⚠️ Limited)
  * Last used time
  * Estimated usage

---

## 7. Chat UI (Premium Design)

### Layout:

* Left Sidebar:

  * Chats
  * Settings
* Main:

  * Chat messages
* Bottom:

  * Input box + Send button

---

## 🎨 UI/UX Design (Premium Feel)

### Style Guide:

* Dark mode default 🌙
* Glassmorphism cards
* Smooth animations (Framer Motion)
* Rounded UI (border-radius: 16px+)

---

### Chat Bubble Design

* User: right aligned (gradient)
* AI: left aligned (glass card)

---

### Example Tailwind Styles:

```css
bg-gradient-to-r from-purple-500 to-indigo-500
backdrop-blur-lg bg-white/10 border border-white/20
shadow-xl rounded-2xl
```

---

## ✨ Advanced Features (Add These)

### 1. Auto Provider Selection

* Fastest response wins
* Measure latency per provider

---

### 2. Parallel Request Mode (Optional)

* Send to all providers
* Return fastest response

---

### 3. Retry Logic

```ts
retry: 2 times per key
```

---

### 4. Key Health System

* Score keys based on:

  * success rate
  * response time

---

### 5. Export / Import Keys

* JSON backup

---

### 6. Encryption (Important)

* Encrypt API keys before storing:

```ts
crypto.subtle.encrypt(...)
```

---

### 7. Rate Limit Cooldown

* If key fails:

```ts
cooldown = 5 minutes
```

---

### 8. Streaming Response (Better UX)

* Use streaming APIs where possible

---

### 9. Multi-Model Support

Allow user to choose:

* Gemini Pro / Flash
* Groq LLaMA / Mixtral
* Grok models

---

## 📦 Folder Structure

```
src/
 ├── components/
 ├── pages/
 ├── hooks/
 ├── store/
 ├── services/
 │    ├── gemini.ts
 │    ├── groq.ts
 │    ├── grok.ts
 ├── utils/
 └── App.tsx
```

---

## 🔐 Security Notes

* NEVER expose API keys in frontend (use backend proxy if possible)
* If frontend-only:

  * warn user about risk
  * store locally only

---

## 🚀 Bonus Ideas

* Voice input 🎤
* File upload (PDF, images)
* Chat history sync
* AI typing animation
* Markdown rendering

---

## 🧪 Testing Scenarios

* Invalid key
* Rate limit hit
* All keys exhausted
* Switching provider
* Multiple keys rotation

---

## ✅ Final Result

You should get:

* 🔄 Auto-fallback chatbot
* 🔑 Multi-key management
* 📊 Usage tracking
* 💎 Premium UI
* ⚡ Fast + reliable AI responses


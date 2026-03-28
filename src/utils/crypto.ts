const SALT = 'lumina-v1'

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(SALT + navigator.userAgent.slice(0, 20)),
    { name: 'PBKDF2' }, false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
}

export async function encryptKey(text: string): Promise<string> {
  try {
    const key = await getKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)
    return btoa(String.fromCharCode(...combined))
  } catch {
    return btoa(text) // fallback
  }
}

export async function decryptKey(encoded: string): Promise<string> {
  try {
    const key = await getKey()
    const combined = new Uint8Array(atob(encoded).split('').map(c => c.charCodeAt(0)))
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(dec)
  } catch {
    try { return atob(encoded) } catch { return encoded }
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

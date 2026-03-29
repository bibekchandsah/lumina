import { useEffect, useState } from 'react'
import {
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
  onAuthStateChanged, type User
} from 'firebase/auth'
import { auth, googleProvider, isConfigured } from '@/services/firebase'
import { useStore } from '@/store'
import type { Chat, APIKey } from '@/types'

// Snapshot of local data before login
const LOCAL_BACKUP_KEY = 'lumina-local-backup'

function saveLocalBackup() {
  const { chats, keys } = useStore.getState()
  localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify({ chats, keys }))
}

function restoreLocalBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY)
    if (!raw) return
    const { chats, keys } = JSON.parse(raw) as { chats: Chat[]; keys: APIKey[] }
    useStore.setState({ chats, keys, activeChatId: chats[0]?.id ?? null })
    localStorage.removeItem(LOCAL_BACKUP_KEY)
  } catch { /* ignore */ }
}

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(isConfigured)

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    return onAuthStateChanged(auth, (u: User | null) => {
      setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL } : null)
      setLoading(false)
    })
  }, [])

  const signInWithGoogle = async () => {
    if (!auth) return
    saveLocalBackup()
    await signInWithPopup(auth, googleProvider)
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) return
    saveLocalBackup()
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUpWithEmail = async (email: string, password: string) => {
    if (!auth) return
    saveLocalBackup()
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const logout = async () => {
    if (!auth) return
    await signOut(auth)
    // Restore local chats/keys that existed before login
    restoreLocalBackup()
  }

  return { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, logout, isConfigured }
}

import { useEffect, useRef, useState } from 'react'
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useStore } from '@/store'
import type { AuthUser } from './useAuth'
import type { Chat, APIKey } from '@/types'

function mergeChats(local: Chat[], remote: Chat[]) {
  const byId = new Map<string, Chat>()
  for (const chat of local) byId.set(chat.id, chat)
  for (const chat of remote) byId.set(chat.id, { ...byId.get(chat.id), ...chat })
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function useFirestoreSync(user: AuthUser | null) {
  const { chats, keys, isOnline } = useStore()
  const prevChatsRef = useRef<Chat[]>([])
  const prevKeysRef = useRef<APIKey[]>([])
  const loadedRef = useRef(false)
  const [hydrated, setHydrated] = useState(false)
  const unsubChatsRef = useRef<(() => void) | null>(null)
  const unsubKeysRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateConnectivity = () => {
      const online = navigator.onLine
      useStore.setState({
        isOnline: online,
        syncStatus: online ? 'idle' : 'offline',
      })
    }

    updateConnectivity()
    window.addEventListener('online', updateConnectivity)
    window.addEventListener('offline', updateConnectivity)

    return () => {
      window.removeEventListener('online', updateConnectivity)
      window.removeEventListener('offline', updateConnectivity)
    }
  }, [])

  useEffect(() => {
    unsubChatsRef.current?.()
    unsubKeysRef.current?.()
    loadedRef.current = false
    setHydrated(false)

    if (!user || !db) return

    if (!isOnline) {
      loadedRef.current = true
      setHydrated(true)
      return
    }

    const chatsCol = collection(db, 'users', user.uid, 'chats')
    const keysCol = collection(db, 'users', user.uid, 'keys')

    // Load chats once on login
    getDocs(chatsCol).then(snap => {
      const remote: Chat[] = snap.docs.map(d => d.data() as Chat).sort((a, b) => b.updatedAt - a.updatedAt)
      if (remote.length > 0) {
        useStore.setState(s => ({
          chats: mergeChats(s.chats, remote),
          activeChatId: remote.find(c => c.id === s.activeChatId) ? s.activeChatId : null,
        }))
        prevChatsRef.current = remote
      }
      loadedRef.current = true
      setHydrated(true)
    }).catch(err => { console.warn('Firestore chats load error:', err.message); loadedRef.current = true; setHydrated(true) })

    // Real-time listener (other devices)
    unsubChatsRef.current = onSnapshot(chatsCol, snap => {
      if (!loadedRef.current) return
      const remote: Chat[] = snap.docs.map(d => d.data() as Chat).sort((a, b) => b.updatedAt - a.updatedAt)
      if (remote.length > 0) {
        useStore.setState(s => ({
          chats: mergeChats(s.chats, remote),
          activeChatId: remote.find(c => c.id === s.activeChatId) ? s.activeChatId : null,
        }))
        prevChatsRef.current = remote
      }
    }, err => console.warn('Firestore chats listener error:', err.message))

    // Load keys once on login
    getDocs(keysCol).then(snap => {
      const remote: APIKey[] = snap.docs.map(d => d.data() as APIKey).sort((a, b) => a.createdAt - b.createdAt)
      if (remote.length > 0) { useStore.setState({ keys: remote }); prevKeysRef.current = remote }
    }).catch(err => console.warn('Firestore keys load error:', err.message))

    unsubKeysRef.current = onSnapshot(keysCol, snap => {
      if (!loadedRef.current) return
      const remote: APIKey[] = snap.docs.map(d => d.data() as APIKey).sort((a, b) => a.createdAt - b.createdAt)
      if (remote.length > 0) { useStore.setState({ keys: remote }); prevKeysRef.current = remote }
    }, err => console.warn('Firestore keys listener error:', err.message))

    return () => { unsubChatsRef.current?.(); unsubKeysRef.current?.() }
  }, [user?.uid, isOnline])

  // Push chats — always write, no remoteLoaded guard
  useEffect(() => {
    if (!user || !db || !isOnline || !hydrated) return
    const timer = setTimeout(async () => {
      useStore.setState({ syncStatus: 'syncing' })
      try {
        for (const chat of chats) {
          await setDoc(doc(db!, 'users', user.uid, 'chats', chat.id), chat as object)
        }
        const removed = prevChatsRef.current.filter(p => !chats.find(c => c.id === p.id))
        for (const chat of removed) {
          await deleteDoc(doc(db!, 'users', user.uid, 'chats', chat.id))
        }
        prevChatsRef.current = chats
        useStore.setState({ syncStatus: 'idle', lastSyncedAt: Date.now() })
      } catch (e) {
        useStore.setState({ syncStatus: 'error' })
        console.warn('Firestore chats write error:', e)
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [chats, user?.uid, isOnline, hydrated])

  // Push keys
  useEffect(() => {
    if (!user || !db || !isOnline || !hydrated) return
    const timer = setTimeout(async () => {
      useStore.setState({ syncStatus: 'syncing' })
      try {
        for (const key of keys) {
          await setDoc(doc(db!, 'users', user.uid, 'keys', key.id), key as object)
        }
        const removed = prevKeysRef.current.filter(p => !keys.find(k => k.id === p.id))
        for (const key of removed) {
          await deleteDoc(doc(db!, 'users', user.uid, 'keys', key.id))
        }
        prevKeysRef.current = keys
        useStore.setState({ syncStatus: 'idle', lastSyncedAt: Date.now() })
      } catch (e) {
        useStore.setState({ syncStatus: 'error' })
        console.warn('Firestore keys write error:', e)
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [keys, user?.uid, isOnline, hydrated])
}

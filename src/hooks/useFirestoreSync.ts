import { useEffect, useRef } from 'react'
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
  const { chats, keys } = useStore()
  const prevChatsRef = useRef<Chat[]>([])
  const prevKeysRef = useRef<APIKey[]>([])
  const loadedRef = useRef(false)
  const unsubChatsRef = useRef<(() => void) | null>(null)
  const unsubKeysRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    unsubChatsRef.current?.()
    unsubKeysRef.current?.()
    loadedRef.current = false

    if (!user || !db) return

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
    }).catch(err => { console.warn('Firestore chats load error:', err.message); loadedRef.current = true })

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
  }, [user?.uid])

  // Push chats — always write, no remoteLoaded guard
  useEffect(() => {
    if (!user || !db) return
    const timer = setTimeout(async () => {
      try {
        for (const chat of chats) {
          await setDoc(doc(db!, 'users', user.uid, 'chats', chat.id), chat as object)
        }
        const removed = prevChatsRef.current.filter(p => !chats.find(c => c.id === p.id))
        for (const chat of removed) {
          await deleteDoc(doc(db!, 'users', user.uid, 'chats', chat.id))
        }
        prevChatsRef.current = chats
      } catch (e) { console.warn('Firestore chats write error:', e) }
    }, 1500)
    return () => clearTimeout(timer)
  }, [chats, user?.uid])

  // Push keys
  useEffect(() => {
    if (!user || !db) return
    const timer = setTimeout(async () => {
      try {
        for (const key of keys) {
          await setDoc(doc(db!, 'users', user.uid, 'keys', key.id), key as object)
        }
        const removed = prevKeysRef.current.filter(p => !keys.find(k => k.id === p.id))
        for (const key of removed) {
          await deleteDoc(doc(db!, 'users', user.uid, 'keys', key.id))
        }
        prevKeysRef.current = keys
      } catch (e) { console.warn('Firestore keys write error:', e) }
    }, 1500)
    return () => clearTimeout(timer)
  }, [keys, user?.uid])
}

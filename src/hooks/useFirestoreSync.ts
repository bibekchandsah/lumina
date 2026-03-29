import { useEffect, useRef } from 'react'
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useStore } from '@/store'
import type { AuthUser } from './useAuth'
import type { Chat, APIKey } from '@/types'

export function useFirestoreSync(user: AuthUser | null) {
  const { chats, keys } = useStore()
  const prevChatsRef = useRef<Chat[]>([])
  const prevKeysRef = useRef<APIKey[]>([])
  const remoteLoadedRef = useRef(false) // true after first remote load
  const unsubChatsRef = useRef<(() => void) | null>(null)
  const unsubKeysRef = useRef<(() => void) | null>(null)

  // On login: load from Firestore once, then subscribe
  useEffect(() => {
    unsubChatsRef.current?.()
    unsubKeysRef.current?.()
    remoteLoadedRef.current = false

    if (!user || !db) return

    // --- Chats ---
    const chatsCol = collection(db, 'users', user.uid, 'chats')

    // Initial load via getDocs (no index needed)
    getDocs(chatsCol).then(snap => {
      const firestoreChats: Chat[] = snap.docs.map(d => d.data() as Chat)
        .sort((a, b) => b.updatedAt - a.updatedAt)
      if (firestoreChats.length > 0) {
        useStore.setState(s => ({
          chats: firestoreChats,
          activeChatId: firestoreChats.find(c => c.id === s.activeChatId)
            ? s.activeChatId
            : firestoreChats[0].id,
        }))
        prevChatsRef.current = firestoreChats
      }
      remoteLoadedRef.current = true
    }).catch(err => {
      console.warn('Firestore chats load error:', err.message)
      remoteLoadedRef.current = true
    })

    // Real-time listener for changes from other devices
    unsubChatsRef.current = onSnapshot(chatsCol, snap => {
      if (!remoteLoadedRef.current) return // skip until initial load done
      const firestoreChats: Chat[] = snap.docs.map(d => d.data() as Chat)
        .sort((a, b) => b.updatedAt - a.updatedAt)
      if (firestoreChats.length > 0) {
        useStore.setState(s => ({
          chats: firestoreChats,
          activeChatId: firestoreChats.find(c => c.id === s.activeChatId)
            ? s.activeChatId
            : firestoreChats[0].id,
        }))
        prevChatsRef.current = firestoreChats
      }
    }, err => console.warn('Firestore chats listener error:', err.message))

    // --- Keys ---
    const keysCol = collection(db, 'users', user.uid, 'keys')

    getDocs(keysCol).then(snap => {
      const firestoreKeys: APIKey[] = snap.docs.map(d => d.data() as APIKey)
        .sort((a, b) => a.createdAt - b.createdAt)
      if (firestoreKeys.length > 0) {
        useStore.setState({ keys: firestoreKeys })
        prevKeysRef.current = firestoreKeys
      }
    }).catch(err => console.warn('Firestore keys load error:', err.message))

    unsubKeysRef.current = onSnapshot(keysCol, snap => {
      if (!remoteLoadedRef.current) return
      const firestoreKeys: APIKey[] = snap.docs.map(d => d.data() as APIKey)
        .sort((a, b) => a.createdAt - b.createdAt)
      if (firestoreKeys.length > 0) {
        useStore.setState({ keys: firestoreKeys })
        prevKeysRef.current = firestoreKeys
      }
    }, err => console.warn('Firestore keys listener error:', err.message))

    return () => {
      unsubChatsRef.current?.()
      unsubKeysRef.current?.()
    }
  }, [user?.uid])

  // Push local chat changes to Firestore (debounced, only after remote loaded)
  useEffect(() => {
    if (!user || !db || !remoteLoadedRef.current) return
    const timer = setTimeout(async () => {
      if (!remoteLoadedRef.current) return
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

  // Push local key changes to Firestore (debounced)
  useEffect(() => {
    if (!user || !db || !remoteLoadedRef.current) return
    const timer = setTimeout(async () => {
      if (!remoteLoadedRef.current) return
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

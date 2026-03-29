import { useEffect, useRef } from 'react'
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, query, orderBy
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useStore } from '@/store'
import type { AuthUser } from './useAuth'
import type { Chat } from '@/types'

export function useFirestoreSync(user: AuthUser | null) {
  const { chats } = useStore()
  const isSyncing = useRef(false)
  const unsubRef = useRef<(() => void) | null>(null)

  // Listen to Firestore and update local store when user is logged in
  useEffect(() => {
    if (!user || !db) {
      unsubRef.current?.()
      return
    }

    const q = query(collection(db, 'users', user.uid, 'chats'), orderBy('updatedAt', 'desc'))
    unsubRef.current = onSnapshot(q, (snap) => {
      if (isSyncing.current) return
      const firestoreChats: Chat[] = snap.docs.map(d => d.data() as Chat)
      if (firestoreChats.length > 0) {
        useStore.setState(s => {
          const newActiveChatId = s.activeChatId && firestoreChats.find(c => c.id === s.activeChatId)
            ? s.activeChatId
            : firestoreChats[0].id
          return { chats: firestoreChats, activeChatId: newActiveChatId }
        })
      }
    })

    return () => unsubRef.current?.()
  }, [user])

  // Push local changes to Firestore
  useEffect(() => {
    if (!user || !db) return
    isSyncing.current = true
    const timer = setTimeout(async () => {
      try {
        for (const chat of chats) {
          await setDoc(doc(db!, 'users', user.uid, 'chats', chat.id), chat)
        }
      } finally {
        isSyncing.current = false
      }
    }, 1000) // debounce 1s
    return () => clearTimeout(timer)
  }, [chats, user])

  // Delete removed chats from Firestore
  const prevChatsRef = useRef<Chat[]>([])
  useEffect(() => {
    if (!user || !db) return
    const prev = prevChatsRef.current
    const current = chats
    const removed = prev.filter(p => !current.find(c => c.id === p.id))
    removed.forEach(chat => deleteDoc(doc(db!, 'users', user.uid, 'chats', chat.id)))
    prevChatsRef.current = current
  }, [chats, user])
}

import { useEffect, useRef } from 'react'
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useStore } from '@/store'
import type { AuthUser } from './useAuth'
import type { Chat } from '@/types'

export function useFirestoreSync(user: AuthUser | null) {
  const { chats } = useStore()
  const isRemoteUpdateRef = useRef(false) // prevent echo writes
  const prevChatsRef = useRef<Chat[]>([])
  const unsubRef = useRef<(() => void) | null>(null)

  // Subscribe to Firestore when user logs in, unsubscribe on logout
  useEffect(() => {
    unsubRef.current?.()
    unsubRef.current = null

    if (!user || !db) return

    const q = query(
      collection(db, 'users', user.uid, 'chats'),
      orderBy('updatedAt', 'desc')
    )

    unsubRef.current = onSnapshot(q, (snap) => {
      const firestoreChats: Chat[] = snap.docs.map(d => d.data() as Chat)
      isRemoteUpdateRef.current = true

      useStore.setState(s => {
        const newChats = firestoreChats.length > 0 ? firestoreChats : s.chats
        const newActiveId = firestoreChats.find(c => c.id === s.activeChatId)
          ? s.activeChatId
          : firestoreChats[0]?.id ?? s.activeChatId
        return { chats: newChats, activeChatId: newActiveId }
      })

      // Allow writes again after a short delay
      setTimeout(() => { isRemoteUpdateRef.current = false }, 500)
    }, (err) => {
      console.warn('Firestore sync error:', err.message)
    })

    return () => { unsubRef.current?.(); unsubRef.current = null }
  }, [user?.uid])

  // Push local changes to Firestore (debounced, skip remote-triggered updates)
  useEffect(() => {
    if (!user || !db || isRemoteUpdateRef.current) return

    const timer = setTimeout(async () => {
      if (isRemoteUpdateRef.current) return
      try {
        for (const chat of chats) {
          await setDoc(doc(db!, 'users', user.uid, 'chats', chat.id), chat)
        }
        // Delete chats removed locally
        const prev = prevChatsRef.current
        const removed = prev.filter(p => !chats.find(c => c.id === p.id))
        for (const chat of removed) {
          await deleteDoc(doc(db!, 'users', user.uid, 'chats', chat.id))
        }
      } catch (e) {
        console.warn('Firestore write error:', e)
      }
    }, 1500)

    prevChatsRef.current = chats
    return () => clearTimeout(timer)
  }, [chats, user?.uid])
}

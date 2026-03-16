'use client'

import { useState, useEffect, createContext, useContext } from 'react'

interface SessionUser {
  id: number
  name: string
  role: 'parent' | 'child'
  familyId: number
}

interface SessionContext {
  user: SessionUser | null
  loading: boolean
  refresh: () => void
}

const SessionCtx = createContext<SessionContext>({
  user: null, loading: true, refresh: () => {}
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'session' }),
    })
      .then(r => r.json())
      .then(d => {
        setUser(d.user || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  return (
    <SessionCtx.Provider value={{ user, loading, refresh }}>
      {children}
    </SessionCtx.Provider>
  )
}

export function useSession() {
  return useContext(SessionCtx)
}

// Convenience getters
export function useChildId(): number {
  const { user } = useSession()
  if (!user) return 2
  if (user.role === 'child') return user.id
  return 2 // parent viewing child - will be resolved server-side
}

export function useFamilyId(): number {
  const { user } = useSession()
  return user?.familyId ?? 1
}

export function useUserId(): number {
  const { user } = useSession()
  return user?.id ?? 2
}

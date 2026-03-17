// Simple cookie-based auth helpers
import { cookies } from 'next/headers'
import db from './db'

export interface SessionUser {
  id: number
  name: string
  role: 'parent' | 'child'
  familyId: number
}

const SESSION_COOKIE = 'pokemon_session'

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as SessionUser
    return data
  } catch {
    return null
  }
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

// Simple password hashing (for demo - in production use bcrypt)
export function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function getChildId(session: SessionUser | null): number {
  if (!session) return 2 // default demo child
  if (session.role === 'child') return session.id
  // For parent, find first child in family
  const sqlite = (db as any).session.client
  const child = sqlite.prepare('SELECT id FROM users WHERE family_id = ? AND role = ?').get(session.familyId, 'child') as any
  return child?.id ?? 2
}

export function getFamilyId(session: SessionUser | null): number {
  return session?.familyId ?? 1
}

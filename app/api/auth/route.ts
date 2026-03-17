import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { hashPassword, verifyPassword, setSession, clearSession, getSession } from '@/lib/auth'

// Generate a readable invite code from family_id
function generateInviteCode(familyId: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  const base = familyId * 7919 + 100000 // simple obfuscation
  let code = ''
  let n = base
  for (let i = 0; i < 6; i++) {
    code += chars[n % chars.length]
    n = Math.floor(n / chars.length) + familyId
  }
  return code
}

// Decode invite code back to family_id (brute-force match since it's a small set)
function resolveInviteCode(code: string, sqlite: any): number | null {
  code = code.trim().toUpperCase()

  // First try as raw number (backward compat)
  const asNum = parseInt(code)
  if (!isNaN(asNum)) {
    const found = sqlite.prepare('SELECT family_id FROM users WHERE role = ? AND family_id = ?').get('parent', asNum)
    if (found) return asNum
  }

  // Try matching generated codes against existing families
  const families = sqlite.prepare('SELECT DISTINCT family_id FROM users WHERE role = ?').all('parent') as any[]
  for (const f of families) {
    if (generateInviteCode(f.family_id) === code) {
      return f.family_id
    }
  }
  return null
}

// POST /api/auth - Login or Register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, name, password, role, familyId, inviteCode } = body
    const sqlite = (db as any).session.client

    if (action === 'register') {
      if (!name || !password || !role) {
        return NextResponse.json({ error: '请填写完整信息' }, { status: 400 })
      }

      // Check duplicate name within role
      const existing = sqlite.prepare('SELECT id FROM users WHERE name = ? AND role = ?').get(name, role)
      if (existing) {
        return NextResponse.json({ error: '该名称已被使用' }, { status: 400 })
      }

      let targetFamilyId: number

      if (role === 'parent') {
        // Create new family
        const maxFamily = sqlite.prepare('SELECT MAX(family_id) as maxF FROM users').get() as any
        targetFamilyId = (maxFamily?.maxF || 0) + 1
      } else {
        // Child must provide invite code
        if (!inviteCode) {
          return NextResponse.json({ error: '请输入家庭邀请码，让家长在设置页面查看' }, { status: 400 })
        }
        const resolved = resolveInviteCode(inviteCode, sqlite)
        if (!resolved) {
          return NextResponse.json({ error: '邀请码无效，请确认后重试' }, { status: 400 })
        }
        targetFamilyId = resolved
      }

      const hash = hashPassword(password)
      const result = sqlite.prepare(
        'INSERT INTO users (name, role, family_id, password_hash) VALUES (?, ?, ?, ?)'
      ).run(name, role, targetFamilyId, hash)

      const userId = result.lastInsertRowid as number
      const user = { id: userId, name, role, familyId: targetFamilyId }
      await setSession(user as any)

      // For parent, return invite code
      const responseData: any = { success: true, user, familyId: targetFamilyId }
      if (role === 'parent') {
        responseData.inviteCode = generateInviteCode(targetFamilyId)
      }

      return NextResponse.json(responseData)
    }

    if (action === 'login') {
      if (!name || !password) {
        return NextResponse.json({ error: '请输入名称和密码' }, { status: 400 })
      }

      // Search by name AND role to avoid collision
      let user: any = null
      if (role) {
        user = sqlite.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get(name, role) as any
      }
      // Fallback: search by name only if role didn't match
      if (!user) {
        user = sqlite.prepare('SELECT * FROM users WHERE name = ?').get(name) as any
      }

      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 })
      }

      if (user.password_hash && !verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: '密码错误' }, { status: 401 })
      }

      const session = { id: user.id, name: user.name, role: user.role, familyId: user.family_id }
      await setSession(session as any)

      // Return actual role from DB, not from form
      return NextResponse.json({ success: true, user: session })
    }

    if (action === 'logout') {
      await clearSession()
      return NextResponse.json({ success: true })
    }

    if (action === 'session') {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ user: null })
      }
      return NextResponse.json({ user: session })
    }

    // Quick login for demo (no password)
    if (action === 'demo_login') {
      const demoRole = body.role || 'child'
      const user = sqlite.prepare('SELECT * FROM users WHERE role = ? AND family_id = 1').get(demoRole) as any
      if (user) {
        const session = { id: user.id, name: user.name, role: user.role, familyId: user.family_id }
        await setSession(session as any)
        return NextResponse.json({ success: true, user: session })
      }
      return NextResponse.json({ error: 'Demo user not found' }, { status: 404 })
    }

    // Get invite code for current family
    if (action === 'get_invite_code') {
      const session = await getSession()
      if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })
      const code = generateInviteCode(session.familyId)
      // Also get family members
      const members = sqlite.prepare(
        'SELECT id, name, role FROM users WHERE family_id = ? ORDER BY role DESC, id ASC'
      ).all(session.familyId)
      return NextResponse.json({ inviteCode: code, familyId: session.familyId, members })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/auth error:', error)
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 })
  }
}

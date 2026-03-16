import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { hashPassword, verifyPassword, setSession, clearSession, getSession } from '@/lib/auth'

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

      let targetFamilyId = familyId || 1

      if (role === 'parent') {
        // Create new family
        const maxFamily = sqlite.prepare('SELECT MAX(family_id) as maxF FROM users').get() as any
        targetFamilyId = (maxFamily?.maxF || 0) + 1
      } else if (role === 'child' && inviteCode) {
        // Find parent by invite code (family_id)
        const parent = sqlite.prepare('SELECT family_id FROM users WHERE role = ? AND family_id = ?').get('parent', parseInt(inviteCode))
        if (parent) {
          targetFamilyId = (parent as any).family_id
        }
      }

      const hash = hashPassword(password)
      const result = sqlite.prepare(
        'INSERT INTO users (name, role, family_id, password_hash) VALUES (?, ?, ?, ?)'
      ).run(name, role, targetFamilyId, hash)

      const user = { id: result.lastInsertRowid as number, name, role, familyId: targetFamilyId }
      await setSession(user as any)

      return NextResponse.json({ success: true, user, familyId: targetFamilyId })
    }

    if (action === 'login') {
      if (!name || !password) {
        return NextResponse.json({ error: '请输入名称和密码' }, { status: 400 })
      }

      const user = sqlite.prepare('SELECT * FROM users WHERE name = ?').get(name) as any
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 })
      }

      if (user.password_hash && !verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: '密码错误' }, { status: 401 })
      }

      const session = { id: user.id, name: user.name, role: user.role, familyId: user.family_id }
      await setSession(session as any)

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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/auth error:', error)
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/onboarding
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const userId = parseInt(searchParams.get('userId') || String(session?.id || 0))

  try {
    const sqlite = (db as any).session.client
    let record = sqlite.prepare('SELECT * FROM onboarding WHERE user_id = ?').get(userId)

    if (!record) {
      sqlite.prepare('INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)').run(userId)
      record = sqlite.prepare('SELECT * FROM onboarding WHERE user_id = ?').get(userId)
    }

    return NextResponse.json({ onboarding: record })
  } catch (error) {
    console.error('GET /api/onboarding error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/onboarding - Update progress
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const userId = body.userId || session?.id || 0
    const { step, completed, data } = body
    const sqlite = (db as any).session.client

    // Ensure record exists
    sqlite.prepare('INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)').run(userId)

    if (completed !== undefined) {
      sqlite.prepare(
        `UPDATE onboarding SET completed = ?, updated_at = datetime('now') WHERE user_id = ?`
      ).run(completed ? 1 : 0, userId)
    }

    if (step !== undefined) {
      sqlite.prepare(
        `UPDATE onboarding SET current_step = ?, updated_at = datetime('now') WHERE user_id = ?`
      ).run(step, userId)
    }

    if (data !== undefined) {
      sqlite.prepare(
        `UPDATE onboarding SET data = ?, updated_at = datetime('now') WHERE user_id = ?`
      ).run(JSON.stringify(data), userId)
    }

    const record = sqlite.prepare('SELECT * FROM onboarding WHERE user_id = ?').get(userId)
    return NextResponse.json({ onboarding: record })
  } catch (error) {
    console.error('POST /api/onboarding error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/notifications
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const userId = parseInt(searchParams.get('userId') || String(session?.id || 2))

  try {
    const sqlite = (db as any).session.client
    const notifications = sqlite.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(userId)

    const unreadCount = (sqlite.prepare(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0'
    ).get(userId) as any).c

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('GET /api/notifications error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/notifications - Create or mark read
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const userId = body.userId || session?.id || 2
    const { action, notificationId, type, title, message, data } = body
    const sqlite = (db as any).session.client

    if (action === 'create') {
      sqlite.prepare(
        'INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, type, title, message, data ? JSON.stringify(data) : null)
      return NextResponse.json({ success: true })
    }

    if (action === 'read') {
      sqlite.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId)
      return NextResponse.json({ success: true })
    }

    if (action === 'read_all') {
      sqlite.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/notifications error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

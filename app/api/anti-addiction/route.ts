import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

// GET /api/anti-addiction
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const childId = parseInt(searchParams.get('childId') || String(getChildId(session)))

  try {
    const sqlite = (db as any).session.client

    const today = new Date().toISOString().split('T')[0]

    // Get today's sessions
    const todaySessions = sqlite.prepare(
      `SELECT * FROM session_logs WHERE child_id = ? AND started_at >= ? ORDER BY started_at DESC`
    ).all(childId, today + ' 00:00:00') as any[]

    const totalSeconds = todaySessions.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0)
    const totalMinutes = Math.round(totalSeconds / 60)

    // Check curfew (21:00 - 07:00)
    const hour = new Date().getHours()
    const isCurfew = hour >= 21 || hour < 7

    // Three-tier limits
    let tier: 'normal' | 'warning' | 'limit' = 'normal'
    let message = ''
    if (totalMinutes >= 30) {
      tier = 'limit'
      message = '今天使用时间已到，宝可梦需要休息了！明天再来吧～'
    } else if (totalMinutes >= 20) {
      tier = 'warning'
      message = `今天已使用${totalMinutes}分钟，还剩${30 - totalMinutes}分钟哦`
    }

    if (isCurfew) {
      tier = 'limit'
      message = '现在是休息时间，宝可梦已经睡觉啦 🌙 明天早上7点再来吧！'
    }

    return NextResponse.json({
      totalMinutes,
      tier,
      message,
      isCurfew,
      maxMinutes: 30,
      sessions: todaySessions.length,
    })
  } catch (error) {
    console.error('GET /api/anti-addiction error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/anti-addiction - Log session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)
    const { action, sessionId } = body
    const sqlite = (db as any).session.client

    if (action === 'start') {
      const result = sqlite.prepare(
        `INSERT INTO session_logs (child_id) VALUES (?)`
      ).run(childId)
      return NextResponse.json({ sessionId: result.lastInsertRowid })
    }

    if (action === 'heartbeat' && sessionId) {
      sqlite.prepare(
        `UPDATE session_logs SET duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER), ended_at = datetime('now') WHERE id = ?`
      ).run(sessionId)
      return NextResponse.json({ success: true })
    }

    if (action === 'end' && sessionId) {
      sqlite.prepare(
        `UPDATE session_logs SET duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER), ended_at = datetime('now') WHERE id = ?`
      ).run(sessionId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/anti-addiction error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

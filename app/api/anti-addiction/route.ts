import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId, getFamilyId } from '@/lib/auth'

function getSettings(sqlite: any, familyId: number) {
  let settings = sqlite.prepare('SELECT * FROM family_settings WHERE family_id = ?').get(familyId) as any
  if (!settings) {
    sqlite.prepare('INSERT OR IGNORE INTO family_settings (family_id) VALUES (?)').run(familyId)
    settings = sqlite.prepare('SELECT * FROM family_settings WHERE family_id = ?').get(familyId)
  }
  return settings
}

// GET /api/anti-addiction
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const childId = parseInt(searchParams.get('childId') || String(getChildId(session)))
  const familyId = getFamilyId(session)

  try {
    const sqlite = (db as any).session.client
    const settings = getSettings(sqlite, familyId)

    const today = new Date().toISOString().split('T')[0]

    // Get today's sessions
    const todaySessions = sqlite.prepare(
      `SELECT * FROM session_logs WHERE child_id = ? AND started_at >= ? ORDER BY started_at DESC`
    ).all(childId, today + ' 00:00:00') as any[]

    const totalSeconds = todaySessions.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0)
    const totalMinutes = Math.round(totalSeconds / 60)

    // Check curfew using family settings
    const hour = new Date().getHours()
    const curfewStart = settings.curfew_start
    const curfewEnd = settings.curfew_end
    const isCurfew = curfewStart > curfewEnd
      ? (hour >= curfewStart || hour < curfewEnd)   // e.g. 21:00 ~ 07:00
      : (hour >= curfewStart && hour < curfewEnd)    // e.g. 22:00 ~ 06:00 (same-day won't happen but handle anyway)

    // Three-tier limits from settings
    const warningMinutes = settings.warning_minutes
    const limitMinutes = settings.limit_minutes

    let tier: 'normal' | 'warning' | 'limit' = 'normal'
    let message = ''
    if (totalMinutes >= limitMinutes) {
      tier = 'limit'
      message = '今天使用时间已到，宝可梦需要休息了！明天再来吧～'
    } else if (totalMinutes >= warningMinutes) {
      tier = 'warning'
      message = `今天已使用${totalMinutes}分钟，还剩${limitMinutes - totalMinutes}分钟哦`
    }

    if (isCurfew) {
      tier = 'limit'
      message = `现在是休息时间，宝可梦已经睡觉啦 🌙 明天早上${curfewEnd}点再来吧！`
    }

    return NextResponse.json({
      totalMinutes,
      tier,
      message,
      isCurfew,
      maxMinutes: limitMinutes,
      warningMinutes,
      limitMinutes,
      curfewStart,
      curfewEnd,
      sessions: todaySessions.length,
    })
  } catch (error) {
    console.error('GET /api/anti-addiction error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/anti-addiction - Log session or update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)
    const familyId = getFamilyId(session)
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

    // Update settings (parent only)
    if (action === 'update_settings') {
      if (session?.role !== 'parent') {
        return NextResponse.json({ error: '只有家长可以修改设置' }, { status: 403 })
      }
      const { curfewStart, curfewEnd, warningMinutes, limitMinutes } = body

      // Ensure record exists
      sqlite.prepare('INSERT OR IGNORE INTO family_settings (family_id) VALUES (?)').run(familyId)

      const updates: string[] = []
      const values: any[] = []

      if (curfewStart !== undefined) { updates.push('curfew_start = ?'); values.push(curfewStart) }
      if (curfewEnd !== undefined) { updates.push('curfew_end = ?'); values.push(curfewEnd) }
      if (warningMinutes !== undefined) { updates.push('warning_minutes = ?'); values.push(warningMinutes) }
      if (limitMinutes !== undefined) { updates.push('limit_minutes = ?'); values.push(limitMinutes) }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')")
        values.push(familyId)
        sqlite.prepare(`UPDATE family_settings SET ${updates.join(', ')} WHERE family_id = ?`).run(...values)
      }

      const settings = getSettings(sqlite, familyId)
      return NextResponse.json({ success: true, settings })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/anti-addiction error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

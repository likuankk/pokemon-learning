import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId, getFamilyId } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const familyId = parseInt(searchParams.get('familyId') || String(getFamilyId(session)))
  const childId = parseInt(searchParams.get('childId') || String(getChildId(session)))

  try {
    const sqlite = (db as any).session.client

    // Overall task stats
    const taskStats = sqlite.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' OR status = 'partial' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM tasks WHERE family_id = ?
    `).get(familyId) as { total: number; completed: number; pending: number; submitted: number; rejected: number }

    // Per-subject stats
    const subjectStats = sqlite.prepare(`
      SELECT
        subject,
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('approved','partial') THEN 1 ELSE 0 END) as completed
      FROM tasks WHERE family_id = ?
      GROUP BY subject
      ORDER BY total DESC
    `).all(familyId) as { subject: string; total: number; completed: number }[]

    // Last 7 days daily completions
    const weeklyStats = sqlite.prepare(`
      SELECT
        date(last_updated) as day,
        COUNT(*) as count
      FROM tasks
      WHERE family_id = ?
        AND status IN ('approved','partial')
        AND last_updated >= datetime('now', '-7 days')
      GROUP BY date(last_updated)
      ORDER BY day ASC
    `).all(familyId) as { day: string; count: number }[]

    // Fill in missing days with 0
    const today = new Date()
    const weekDays: { day: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dayStr = d.toISOString().split('T')[0]
      const found = weeklyStats.find(w => w.day === dayStr)
      weekDays.push({ day: dayStr, count: found ? found.count : 0 })
    }

    // Pokemon progress
    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)

    // Recent approvals (last 10)
    const recentApprovals = sqlite.prepare(`
      SELECT t.title, t.subject, t.difficulty, t.last_updated,
             s.quality_score, s.review_comment
      FROM tasks t
      LEFT JOIN submissions s ON s.task_id = t.id AND s.review_status IN ('approved','partial')
      WHERE t.family_id = ? AND t.status IN ('approved','partial')
      ORDER BY t.last_updated DESC
      LIMIT 10
    `).all(familyId)

    return NextResponse.json({
      taskStats,
      subjectStats,
      weeklyStats: weekDays,
      pokemon,
      recentApprovals,
    })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

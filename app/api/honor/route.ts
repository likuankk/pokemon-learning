import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId, getFamilyId } from '@/lib/auth'

// GET /api/honor
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const childId = parseInt(searchParams.get('childId') || String(getChildId(session)))
  const familyId = parseInt(searchParams.get('familyId') || String(getFamilyId(session)))

  try {
    const sqlite = (db as any).session.client

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any

    const totalApproved = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM tasks WHERE family_id = ? AND status IN ('approved','partial')`
    ).get(familyId) as any).c

    const achievementCount = (sqlite.prepare(
      'SELECT COUNT(*) as c FROM child_achievements WHERE child_id = ?'
    ).get(childId) as any).c

    const decorCount = (sqlite.prepare(
      'SELECT COUNT(*) as c FROM house_items WHERE child_id = ?'
    ).get(childId) as any).c

    // Weekly stats
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek + 1)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const weekTasks = sqlite.prepare(
      `SELECT * FROM tasks WHERE family_id = ? AND due_date >= ?`
    ).all(familyId, weekStartStr) as any[]

    const weekCompleted = weekTasks.filter((t: any) => ['approved', 'partial'].includes(t.status)).length
    const weekTotal = weekTasks.length

    // Subject breakdown
    const subjectStats = sqlite.prepare(
      `SELECT subject, COUNT(*) as c FROM tasks WHERE family_id = ? AND status IN ('approved','partial') GROUP BY subject ORDER BY c DESC`
    ).all(familyId) as any[]

    // Best quality scores
    const avgScore = sqlite.prepare(
      `SELECT AVG(quality_score) as avg FROM submissions WHERE child_id = ? AND quality_score IS NOT NULL`
    ).get(childId) as any

    const honors = [
      { metric: '连续坚持', value: pokemon?.streak_days ?? 0, unit: '天', icon: '🔥', description: '连续打卡天数' },
      { metric: '最长连续', value: pokemon?.max_streak ?? 0, unit: '天', icon: '🏆', description: '历史最长连续' },
      { metric: '累计完成', value: totalApproved, unit: '个', icon: '✅', description: '总完成任务数' },
      { metric: '本周完成', value: weekCompleted, unit: `/${weekTotal}`, icon: '📋', description: '本周任务完成' },
      { metric: '宝可梦等级', value: pokemon?.level ?? 1, unit: '级', icon: '⬆️', description: '伙伴等级' },
      { metric: '成就解锁', value: achievementCount, unit: '个', icon: '🏅', description: '已获得成就' },
      { metric: '装饰收集', value: decorCount, unit: '个', icon: '🏠', description: '小屋装饰品' },
      { metric: '平均评分', value: Math.round((avgScore?.avg ?? 0) * 10) / 10, unit: '分', icon: '⭐', description: '任务平均评分' },
      { metric: '最擅长', value: subjectStats[0]?.subject ?? '无', unit: '', icon: '📚', description: '完成最多的科目' },
      { metric: '宝可梦状态', value: Math.round(((pokemon?.vitality ?? 0) + (pokemon?.wisdom ?? 0) + (pokemon?.affection ?? 0)) / 3), unit: '分', icon: '💪', description: '三维平均值' },
    ]

    return NextResponse.json({ honors })
  } catch (error) {
    console.error('GET /api/honor error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

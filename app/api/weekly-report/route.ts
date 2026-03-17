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

    // Calculate week range (Mon–Sun of current week)
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // 1=Mon, 7=Sun
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek + 1)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // Total tasks this week (by due_date)
    const weekTasks = sqlite.prepare(
      `SELECT * FROM tasks WHERE family_id = ? AND due_date >= ? AND due_date <= ?`
    ).all(familyId, weekStartStr, weekEndStr) as any[]

    const totalTasks = weekTasks.length
    const completedTasks = weekTasks.filter((t: any) => ['approved', 'partial'].includes(t.status)).length
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Subject breakdown this week
    const subjectMap: Record<string, { total: number; completed: number }> = {}
    for (const task of weekTasks) {
      if (!subjectMap[task.subject]) subjectMap[task.subject] = { total: 0, completed: 0 }
      subjectMap[task.subject].total++
      if (['approved', 'partial'].includes(task.status)) subjectMap[task.subject].completed++
    }

    // Daily completions this week (fill missing days)
    const dailyStats: { day: string; count: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      const dayStr = d.toISOString().split('T')[0]
      const count = weekTasks.filter((t: any) =>
        ['approved', 'partial'].includes(t.status) &&
        t.last_updated?.slice(0, 10) === dayStr
      ).length
      dailyStats.push({ day: dayStr, count })
    }

    // Pokemon data
    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any

    // Streak info
    const streakDays = pokemon?.streak_days ?? 0
    const maxStreak = streakDays // simplified — would need history for true max

    // All-time stats
    const allTimeCompleted = sqlite.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE family_id = ? AND status IN ('approved', 'partial')`
    ).get(familyId) as { count: number }

    // Best quality score this week
    const bestScore = sqlite.prepare(
      `SELECT MAX(quality_score) as best FROM submissions
       WHERE reviewed_at >= ? AND reviewed_at <= ?`
    ).get(weekStartStr + ' 00:00:00', weekEndStr + ' 23:59:59') as { best: number | null }

    return NextResponse.json({
      weekRange: { start: weekStartStr, end: weekEndStr },
      completionRate,
      totalTasks,
      completedTasks,
      subjectBreakdown: subjectMap,
      dailyStats,
      streakDays,
      maxStreak,
      allTimeCompleted: allTimeCompleted.count,
      bestQualityScore: bestScore.best ?? 0,
      pokemon: pokemon ? {
        name: pokemon.name,
        species_id: pokemon.species_id,
        level: pokemon.level,
        evolution_stage: pokemon.evolution_stage ?? 1,
        vitality: pokemon.vitality,
        wisdom: pokemon.wisdom,
        affection: pokemon.affection,
      } : null,
    })
  } catch (error) {
    console.error('GET /api/weekly-report error:', error)
    return NextResponse.json({ error: 'Failed to get weekly report' }, { status: 500 })
  }
}

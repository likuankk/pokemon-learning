import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// GET /api/achievements?childId=2 - Get all achievements and child's progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const childId = parseInt(searchParams.get('childId') || '2')
  const familyId = parseInt(searchParams.get('familyId') || '1')

  try {
    const sqlite = (db as any).session.client

    // All achievements
    const achievements = sqlite.prepare('SELECT * FROM achievements ORDER BY tier, category').all()

    // Child's unlocked achievements
    const unlocked = sqlite.prepare(
      'SELECT achievement_id, unlocked_at FROM child_achievements WHERE child_id = ?'
    ).all(childId) as { achievement_id: string; unlocked_at: string }[]

    const unlockedMap = new Map(unlocked.map(u => [u.achievement_id, u.unlocked_at]))

    // Check and grant new achievements
    const newlyUnlocked: string[] = []

    // Gather stats for checking
    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any
    const totalApproved = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM tasks WHERE family_id = ? AND status IN ('approved','partial')`
    ).get(familyId) as any).c

    const subjectCounts = sqlite.prepare(
      `SELECT subject, COUNT(*) as c FROM tasks WHERE family_id = ? AND status IN ('approved','partial') GROUP BY subject`
    ).all(familyId) as { subject: string; c: number }[]
    const subjectMap = new Map(subjectCounts.map(s => [s.subject, s.c]))

    const feedCount = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM session_logs WHERE child_id = ?`
    ).get(childId) as any)?.c ?? 0

    const decorCount = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM house_items WHERE child_id = ?`
    ).get(childId) as any)?.c ?? 0

    const weekendDone = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM tasks WHERE family_id = ? AND is_weekend_challenge = 1 AND status IN ('approved','partial')`
    ).get(familyId) as any)?.c ?? 0

    for (const ach of achievements as any[]) {
      if (unlockedMap.has(ach.id)) continue

      let met = false
      switch (ach.condition_type) {
        case 'streak':
          met = (pokemon?.streak_days ?? 0) >= ach.condition_value ||
                (pokemon?.max_streak ?? 0) >= ach.condition_value
          break
        case 'total_tasks':
          met = totalApproved >= ach.condition_value
          break
        case 'level':
          met = (pokemon?.level ?? 0) >= ach.condition_value
          break
        case 'evolution':
          met = (pokemon?.evolution_stage ?? 1) > ach.condition_value
          break
        case 'max_vitality':
          met = (pokemon?.vitality ?? 0) >= ach.condition_value
          break
        case 'max_wisdom':
          met = (pokemon?.wisdom ?? 0) >= ach.condition_value
          break
        case 'max_affection':
          met = (pokemon?.affection ?? 0) >= ach.condition_value
          break
        case 'all_max':
          met = (pokemon?.vitality ?? 0) >= 100 && (pokemon?.wisdom ?? 0) >= 100 && (pokemon?.affection ?? 0) >= 100
          break
        case 'subject_chinese':
          met = (subjectMap.get('语文') ?? 0) >= ach.condition_value
          break
        case 'subject_math':
          met = (subjectMap.get('数学') ?? 0) >= ach.condition_value
          break
        case 'subject_english':
          met = (subjectMap.get('英语') ?? 0) >= ach.condition_value
          break
        case 'subject_science':
          met = (subjectMap.get('科学') ?? 0) >= ach.condition_value
          break
        case 'all_subjects_3':
          met = ['语文', '数学', '英语', '科学'].every(s => (subjectMap.get(s) ?? 0) >= 3)
          break
        case 'decorate_count':
          met = decorCount >= ach.condition_value
          break
        case 'weekend_challenge':
          met = weekendDone >= ach.condition_value
          break
        default:
          break
      }

      if (met) {
        try {
          sqlite.prepare('INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?, ?)').run(childId, ach.id)
          newlyUnlocked.push(ach.id)
          unlockedMap.set(ach.id, new Date().toISOString())
        } catch { /* ignore duplicate */ }
      }
    }

    const result = (achievements as any[]).map(a => ({
      ...a,
      unlocked: unlockedMap.has(a.id),
      unlocked_at: unlockedMap.get(a.id) || null,
    }))

    return NextResponse.json({
      achievements: result,
      totalUnlocked: unlockedMap.size,
      totalAchievements: (achievements as any[]).length,
      newlyUnlocked,
    })
  } catch (error) {
    console.error('GET /api/achievements error:', error)
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
  }
}

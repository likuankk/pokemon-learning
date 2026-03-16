import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId, getFamilyId } from '@/lib/auth'

// GET /api/achievements - Get all achievements and child's progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const childId = parseInt(searchParams.get('childId') || String(getChildId(session)))
  const familyId = parseInt(searchParams.get('familyId') || String(getFamilyId(session)))

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

    // ── Gather stats for checking ─────────────────────────────────────────────

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any

    const totalApproved = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM tasks WHERE family_id = ? AND status IN ('approved','partial')`
    ).get(familyId) as any).c

    const subjectCounts = sqlite.prepare(
      `SELECT subject, COUNT(*) as c FROM tasks WHERE family_id = ? AND status IN ('approved','partial') GROUP BY subject`
    ).all(familyId) as { subject: string; c: number }[]
    const subjectMap = new Map(subjectCounts.map(s => [s.subject, s.c]))

    const decorCount = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM house_items WHERE child_id = ?`
    ).get(childId) as any)?.c ?? 0

    const weekendDone = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM tasks WHERE family_id = ? AND is_weekend_challenge = 1 AND status IN ('approved','partial')`
    ).get(familyId) as any)?.c ?? 0

    // Total checkin days (unique dates with approved tasks)
    const totalCheckinDays = (pokemon?.max_streak ?? 0) > 0
      ? Math.max(pokemon?.max_streak ?? 0, pokemon?.streak_days ?? 0)
      : (pokemon?.streak_days ?? 0)

    // Count discovered species
    const discoveredCount = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM discovered_species WHERE child_id = ?`
    ).get(childId) as any)?.c ?? 0

    // Count evolution history entries
    const evolutionCount = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM evolution_history WHERE child_id = ?`
    ).get(childId) as any)?.c ?? 0

    // Count total inventory items
    const totalItems = (sqlite.prepare(
      `SELECT COALESCE(SUM(quantity), 0) as c FROM inventory WHERE child_id = ?`
    ).get(childId) as any)?.c ?? 0

    // Count distinct item types in inventory
    const itemVariety = (sqlite.prepare(
      `SELECT COUNT(DISTINCT item_type) as c FROM inventory WHERE child_id = ? AND quantity > 0`
    ).get(childId) as any)?.c ?? 0

    // Count parent review comments
    const parentComments = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM submissions s
       JOIN tasks t ON s.task_id = t.id
       WHERE t.family_id = ? AND s.child_id = ? AND s.review_comment IS NOT NULL AND s.review_comment != ''`
    ).get(familyId, childId) as any)?.c ?? 0

    // Count manual rewards (from notifications or reward API usage)
    const manualRewards = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'reward'`
    ).get(childId) as any)?.c ?? 0

    // Count planner usage days
    const planDays = (sqlite.prepare(
      `SELECT COUNT(DISTINCT plan_date) as c FROM daily_plans WHERE child_id = ?`
    ).get(childId) as any)?.c ?? 0

    // Count perfect score (quality_score = 5) streaks
    const perfectScores = sqlite.prepare(
      `SELECT quality_score FROM submissions WHERE child_id = ? AND review_status = 'approved' ORDER BY reviewed_at DESC`
    ).all(childId) as { quality_score: number }[]

    let perfectStreak = 0
    for (const s of perfectScores) {
      if (s.quality_score >= 5) perfectStreak++
      else break
    }

    // Check Eevee evolution
    const eeveeEvolution = (sqlite.prepare(
      `SELECT COUNT(*) as c FROM evolution_history WHERE child_id = ? AND from_species_id IN (7, 8, 9, 10, 11)`
    ).get(childId) as any)?.c ?? 0

    // Check if all base species have reached final evolution
    const allEvolvedCount = (sqlite.prepare(
      `SELECT COUNT(DISTINCT from_species_id) as c FROM evolution_history
       WHERE child_id = ? AND to_stage >= 3`
    ).get(childId) as any)?.c ?? 0

    // ── Check each achievement ────────────────────────────────────────────────

    for (const ach of achievements as any[]) {
      if (unlockedMap.has(ach.id)) continue

      let met = false
      switch (ach.condition_type) {
        // ── Habit achievements ──────────────────────────────────────────────
        case 'streak':
          met = (pokemon?.streak_days ?? 0) >= ach.condition_value ||
                (pokemon?.max_streak ?? 0) >= ach.condition_value
          break

        case 'total_tasks':
          met = totalApproved >= ach.condition_value
          break

        case 'perfect_day': {
          // Check if today has >= condition_value approved tasks
          const today = new Date().toISOString().split('T')[0]
          const todayApproved = (sqlite.prepare(
            `SELECT COUNT(*) as c FROM tasks
             WHERE family_id = ? AND status IN ('approved','partial')
             AND date(last_updated) = ?`
          ).get(familyId, today) as any)?.c ?? 0
          met = todayApproved >= ach.condition_value
          break
        }

        case 'quality_streak':
          // Check consecutive days with >=90% completion (approximate with perfect scores)
          met = perfectStreak >= ach.condition_value
          break

        case 'total_checkin_days':
          // Approximate: use max of max_streak and current streak as lower bound for total days
          // A more accurate approach would track unique checkin dates
          met = totalCheckinDays >= ach.condition_value
          break

        case 'monthly_perfect':
          // Check if current month has all days with completed tasks (simplified)
          met = (pokemon?.streak_days ?? 0) >= 28 // approximate month
          break

        case 'early_bird_streak':
          // Complex: would need task start times. For now, not auto-triggerable
          // Will be unlocked via manual check or future tracking
          break

        // ── Subject achievements ────────────────────────────────────────────
        case 'weekly_subjects': {
          // Count distinct subjects completed this week
          const weekStart = new Date()
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          const weekStartStr = weekStart.toISOString().split('T')[0]
          const weekSubjects = (sqlite.prepare(
            `SELECT COUNT(DISTINCT subject) as c FROM tasks
             WHERE family_id = ? AND status IN ('approved','partial')
             AND date(last_updated) >= ?`
          ).get(familyId, weekStartStr) as any)?.c ?? 0
          met = weekSubjects >= ach.condition_value
          break
        }

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

        case 'all_subjects_10':
          met = ['语文', '数学', '英语', '科学'].every(s => (subjectMap.get(s) ?? 0) >= 10)
          break

        case 'perfect_streak':
          met = perfectStreak >= ach.condition_value
          break

        case 'perfect_week':
          // Approximate: 7-day streak with multiple subjects
          met = (pokemon?.streak_days ?? 0) >= ach.condition_value && subjectMap.size >= 2
          break

        case 'retry_success': {
          // Count tasks that were rejected then later approved
          const retryCount = (sqlite.prepare(
            `SELECT COUNT(*) as c FROM tasks
             WHERE family_id = ? AND status IN ('approved','partial')
             AND id IN (
               SELECT DISTINCT task_id FROM submissions
               WHERE child_id = ? AND review_status = 'rejected'
             )`
          ).get(familyId, childId) as any)?.c ?? 0
          met = retryCount >= ach.condition_value
          break
        }

        // ── Pokemon achievements ────────────────────────────────────────────
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
        case 'all_stats_90':
          met = (pokemon?.vitality ?? 0) >= 90 && (pokemon?.wisdom ?? 0) >= 90 && (pokemon?.affection ?? 0) >= 90
          break

        case 'status_streak':
          // Check if pokemon has been in good status for N days (approximate with streak)
          met = (pokemon?.streak_days ?? 0) >= ach.condition_value &&
                (pokemon?.vitality ?? 0) >= 60 && (pokemon?.wisdom ?? 0) >= 60 && (pokemon?.affection ?? 0) >= 60
          break

        case 'item_variety':
          met = itemVariety >= ach.condition_value
          break

        case 'total_items':
          met = totalItems >= ach.condition_value
          break

        case 'eevee_evolution':
          met = eeveeEvolution >= ach.condition_value
          break

        case 'stones_used':
          met = evolutionCount >= ach.condition_value
          break

        case 'pokedex_complete':
          met = discoveredCount >= ach.condition_value
          break

        case 'all_evolved':
          met = allEvolvedCount >= ach.condition_value
          break

        // ── Time achievements ───────────────────────────────────────────────
        case 'plan_count':
          met = planDays >= ach.condition_value
          break

        case 'on_time_streak':
        case 'plan_streak':
          // Approximate: days using planner
          met = planDays >= ach.condition_value
          break

        case 'early_complete':
        case 'early_complete_streak':
          // Would need actual completion time tracking. Approximate with plan usage
          met = planDays >= ach.condition_value
          break

        case 'time_accuracy':
          // Complex: needs actual vs estimated tracking. For now approximate
          met = planDays >= ach.condition_value
          break

        case 'perfect_plan_days':
          met = planDays >= ach.condition_value
          break

        // ── Family achievements ─────────────────────────────────────────────
        case 'parent_comments':
          met = parentComments >= ach.condition_value
          break

        case 'manual_rewards':
          met = manualRewards >= ach.condition_value
          break

        case 'comment_response': {
          // Check if child completed a task after receiving a comment
          // Simplified: has at least 1 comment AND 1 subsequent approved task
          met = parentComments >= 1 && totalApproved >= 2
          break
        }

        case 'warm_week': {
          // 1 week with >=5 comments and >=3 approved tasks
          met = parentComments >= 5 && totalApproved >= 3
          break
        }

        case 'family_streak':
          // Approximate: N weeks of continuous interaction
          met = parentComments >= ach.condition_value * 2 && (pokemon?.streak_days ?? 0) >= ach.condition_value * 7
          break

        case 'love_milestone':
          met = parentComments >= ach.condition_value && totalApproved >= 100
          break

        case 'forever_together':
          met = totalCheckinDays >= 300 && parentComments >= 100
          break

        // ── Decoration achievements ─────────────────────────────────────────
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

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  calculateRewards, calculateStatUpdates, calculateLevel,
  checkEvolution, getStreakMilestoneReward, getBaseSpeciesId
} from '@/lib/game-logic'
import { getSession, getChildId } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const session = await getSession()
    const { qualityScore, reviewComment, reviewStatus = 'approved' } = body
    const childId = body.childId || getChildId(session)

    if (!qualityScore || qualityScore < 1 || qualityScore > 5) {
      return NextResponse.json({ error: 'Invalid quality score (1-5 required)' }, { status: 400 })
    }

    const sqlite = (db as any).session.client

    const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(parseInt(id))
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const submission = sqlite.prepare(
      'SELECT * FROM submissions WHERE task_id = ? AND child_id = ? ORDER BY submitted_at DESC LIMIT 1'
    ).get(parseInt(id), childId)

    if (!submission) {
      return NextResponse.json({ error: 'No submission found for this task' }, { status: 404 })
    }

    // Update submission
    sqlite.prepare(
      `UPDATE submissions SET review_status = ?, review_comment = ?, quality_score = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).run(reviewStatus, reviewComment || '', qualityScore, submission.id)

    // Update task status and timestamp
    const taskStatus = reviewStatus === 'approved' ? 'approved' :
                       reviewStatus === 'partial' ? 'partial' : 'rejected'
    sqlite.prepare(`UPDATE tasks SET status = ?, last_updated = datetime('now') WHERE id = ?`).run(taskStatus, parseInt(id))

    let rewards = null
    let statUpdates = null
    let levelUp = null
    let streakUpdate: { days: number; milestone?: string } | null = null
    let evolution: { from: number; to: number; fromStage: number; toStage: number } | null = null

    if (reviewStatus === 'approved' || reviewStatus === 'partial') {
      const effectiveScore = reviewStatus === 'partial' ? Math.max(1, qualityScore - 1) : qualityScore
      rewards = calculateRewards(effectiveScore)

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any

      if (pokemon) {
        // ── Streak calculation ─────────────────────────────────────────────────
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

        let newStreakDays = pokemon.streak_days ?? 0
        const lastCheckin = pokemon.last_checkin_date

        if (lastCheckin === today) {
          // Already checked in today — don't change streak
        } else if (lastCheckin === yesterday) {
          // Consecutive day
          newStreakDays += 1
        } else {
          // Broken streak or first time
          newStreakDays = 1
        }

        // Streak milestone bonus
        const milestoneReward = getStreakMilestoneReward(newStreakDays)
        if (milestoneReward) {
          rewards = {
            food: rewards.food + milestoneReward.food,
            crystal: rewards.crystal + milestoneReward.crystal,
            candy: rewards.candy + milestoneReward.candy,
            fragment: rewards.fragment + milestoneReward.fragment,
          }
          const milestoneLabel = newStreakDays === 3 ? '🎉 3天里程碑！' :
                                  newStreakDays === 7 ? '🔥 7天里程碑！' : '🌟 30天里程碑！'
          streakUpdate = { days: newStreakDays, milestone: milestoneLabel }
        } else {
          streakUpdate = { days: newStreakDays }
        }

        // ── Stat updates ───────────────────────────────────────────────────────
        statUpdates = calculateStatUpdates(
          rewards,
          task.difficulty,
          pokemon.vitality,
          pokemon.wisdom,
          pokemon.affection,
          newStreakDays
        )

        // ── Level up check ─────────────────────────────────────────────────────
        const totalApproved = sqlite.prepare(
          `SELECT COUNT(*) as count FROM tasks
           WHERE family_id = ? AND status IN ('approved', 'partial')`
        ).get(task.family_id) as { count: number }

        const newLevel = calculateLevel(totalApproved.count)
        const oldLevel = pokemon.level

        if (newLevel > oldLevel) {
          levelUp = { from: oldLevel, to: newLevel }
        }

        // ── Update pokemon base stats ──────────────────────────────────────────
        sqlite.prepare(
          `UPDATE pokemons SET vitality = ?, wisdom = ?, affection = ?, level = ?,
           streak_days = ?, last_checkin_date = ?, last_updated = datetime('now')
           WHERE child_id = ?`
        ).run(
          statUpdates.vitality, statUpdates.wisdom, statUpdates.affection, newLevel,
          newStreakDays, today,
          childId
        )

        // ── Inventory update ───────────────────────────────────────────────────
        const itemTypes = ['food', 'crystal', 'candy', 'fragment'] as const
        for (const itemType of itemTypes) {
          const rewardQty = rewards[itemType]
          if (rewardQty > 0) {
            const existing = sqlite.prepare(
              'SELECT * FROM inventory WHERE child_id = ? AND item_type = ?'
            ).get(childId, itemType)

            if (existing) {
              sqlite.prepare(
                `UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now')
                 WHERE child_id = ? AND item_type = ?`
              ).run(rewardQty, childId, itemType)
            } else {
              sqlite.prepare(
                'INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)'
              ).run(childId, itemType, rewardQty)
            }
          }
        }

        // ── Evolution check ────────────────────────────────────────────────────
        const updatedPokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any
        const fragmentInv = sqlite.prepare(
          'SELECT quantity FROM inventory WHERE child_id = ? AND item_type = ?'
        ).get(childId, 'fragment') as { quantity: number } | undefined

        const fragmentQty = fragmentInv?.quantity ?? 0
        const currentStage = updatedPokemon.evolution_stage ?? 1
        const { canEvolve, nextSpeciesId } = checkEvolution(
          updatedPokemon.species_id, currentStage, newLevel, fragmentQty
        )

        if (canEvolve && nextSpeciesId) {
          const newStage = currentStage + 1
          // Consume fragments
          const requiredFragments = currentStage === 1 ? 3 : 5
          sqlite.prepare(
            `UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now')
             WHERE child_id = ? AND item_type = 'fragment'`
          ).run(requiredFragments, childId)

          // Update pokemon species and stage
          sqlite.prepare(
            `UPDATE pokemons SET species_id = ?, evolution_stage = ? WHERE child_id = ?`
          ).run(nextSpeciesId, newStage, childId)

          evolution = {
            from: updatedPokemon.species_id,
            to: nextSpeciesId,
            fromStage: currentStage,
            toStage: newStage,
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: reviewStatus === 'approved' ? '审核通过！宝可梦获得奖励 🎉' :
                reviewStatus === 'partial' ? '部分完成，继续加油！' : '请重新完成任务',
      rewards,
      statUpdates,
      levelUp,
      streakUpdate,
      evolution,
    })
  } catch (error) {
    console.error('POST /api/tasks/[id]/review error:', error)
    return NextResponse.json({ error: 'Failed to review task' }, { status: 500 })
  }
}

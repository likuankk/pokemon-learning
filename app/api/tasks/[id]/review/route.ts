import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  calculateRewards, calculateStatUpdates, calculateLevel,
  checkEvolution, getStreakMilestoneReward, getBaseSpeciesId,
  getEvolutionRequirements, POKEMON_NAMES
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

        // ── Update max_streak ─────────────────────────────────────────────────
        const newMaxStreak = Math.max(pokemon.max_streak ?? 0, newStreakDays)

        // ── Update pokemon base stats ──────────────────────────────────────────
        sqlite.prepare(
          `UPDATE pokemons SET vitality = ?, wisdom = ?, affection = ?, level = ?,
           streak_days = ?, max_streak = ?, last_checkin_date = ?, last_updated = datetime('now')
           WHERE child_id = ?`
        ).run(
          statUpdates.vitality, statUpdates.wisdom, statUpdates.affection, newLevel,
          newStreakDays, newMaxStreak, today,
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

        // ── Battle energy refill (+1 per approved task) ──────────────────────
        try {
          sqlite.prepare('INSERT OR IGNORE INTO battle_energy (child_id) VALUES (?)').run(childId)
          const battleEnergy = sqlite.prepare('SELECT current_energy FROM battle_energy WHERE child_id = ?').get(childId) as any
          if (battleEnergy && battleEnergy.current_energy < 10) {
            sqlite.prepare('UPDATE battle_energy SET current_energy = MIN(10, current_energy + 1) WHERE child_id = ?').run(childId)
          }
          // Also give battle exp to active pokemon (+5 per task)
          const activePoke = sqlite.prepare('SELECT id, battle_exp FROM pokemons WHERE child_id = ? AND is_active = 1').get(childId) as any
          if (activePoke) {
            sqlite.prepare('UPDATE pokemons SET battle_exp = battle_exp + 5 WHERE id = ?').run(activePoke.id)
          }
        } catch (e) { /* battle tables may not exist yet */ }

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
          const requiredFragments = getEvolutionRequirements(currentStage).fragments
          const newName = POKEMON_NAMES[nextSpeciesId] || updatedPokemon.name

          // Consume fragments
          sqlite.prepare(
            `UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now')
             WHERE child_id = ? AND item_type = 'fragment'`
          ).run(requiredFragments, childId)

          // Update pokemon species, name and stage
          sqlite.prepare(
            `UPDATE pokemons SET species_id = ?, name = ?, evolution_stage = ? WHERE child_id = ?`
          ).run(nextSpeciesId, newName, newStage, childId)

          // Record evolution history
          try {
            sqlite.prepare(
              `INSERT INTO evolution_history (child_id, from_species_id, to_species_id, from_stage, to_stage)
               VALUES (?, ?, ?, ?, ?)`
            ).run(childId, updatedPokemon.species_id, nextSpeciesId, currentStage, newStage)

            // Record discovered species
            sqlite.prepare(
              'INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)'
            ).run(childId, nextSpeciesId)
            sqlite.prepare(
              'INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)'
            ).run(childId, updatedPokemon.species_id)

            // Unlock evolution achievements
            if (newStage === 2) {
              sqlite.prepare(
                'INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?, ?)'
              ).run(childId, 'first_evolution')
            }
            if (newStage >= 3) {
              sqlite.prepare(
                'INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?, ?)'
              ).run(childId, 'second_evolution')
            }
          } catch (e) { /* tables may not exist yet */ }

          evolution = {
            from: updatedPokemon.species_id,
            to: nextSpeciesId,
            fromStage: currentStage,
            toStage: newStage,
          }
        }
      }
    }

    // ── Auto-create notifications ──────────────────────────────────────────
    try {
      // Notify child about review result
      const notifTitle = reviewStatus === 'approved' ? '✅ 任务通过！' :
                         reviewStatus === 'partial' ? '📝 部分通过' : '🔄 需要重做'
      const notifMsg = reviewStatus === 'approved'
        ? `「${task.title}」已通过审核，宝可梦获得了奖励！`
        : reviewStatus === 'partial'
        ? `「${task.title}」部分通过，继续加油！`
        : `「${task.title}」需要重做，${reviewComment || '请再试一次'}。`

      sqlite.prepare(
        'INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)'
      ).run(childId, 'review', notifTitle, notifMsg, JSON.stringify({ taskId: parseInt(id), reviewStatus }))

      // Notify about level up
      if (levelUp) {
        sqlite.prepare(
          'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
        ).run(childId, 'level_up', '🎉 升级了！', `宝可梦升到了 ${levelUp.to} 级！`)
      }

      // Notify about evolution
      if (evolution) {
        const evolvedName = POKEMON_NAMES[evolution.to] || '新形态'
        sqlite.prepare(
          'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
        ).run(childId, 'evolution', '✨ 进化成功！', `宝可梦进化成了 ${evolvedName}！`)
      }

      // Notify about streak milestones
      if (streakUpdate?.milestone) {
        sqlite.prepare(
          'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
        ).run(childId, 'streak', '🔥 打卡里程碑！', `连续打卡 ${streakUpdate.days} 天！${streakUpdate.milestone}`)
      }

      // Notify parent about child completion (find parent user)
      const parent = sqlite.prepare(
        `SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = ?) AND role = 'parent' LIMIT 1`
      ).get(childId) as { id: number } | undefined

      if (parent && (reviewStatus === 'approved' || evolution)) {
        const childUser = sqlite.prepare('SELECT name FROM users WHERE id = ?').get(childId) as { name: string } | undefined
        const childName = childUser?.name || '孩子'
        if (evolution) {
          const evolvedName = POKEMON_NAMES[evolution.to] || '新形态'
          sqlite.prepare(
            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
          ).run(parent.id, 'evolution', '🎉 宝可梦进化了！', `${childName}的宝可梦进化成了 ${evolvedName}！`)
        }
      }
    } catch (notifError) {
      // Don't fail the whole request if notifications fail
      console.error('Notification creation error:', notifError)
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

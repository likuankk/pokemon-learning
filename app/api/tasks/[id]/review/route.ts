import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { calculateRewards, calculateStatUpdates, calculateLevel } from '@/lib/game-logic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const { qualityScore, reviewComment, reviewStatus = 'approved', childId = 2 } = body

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

    if (reviewStatus === 'approved' || reviewStatus === 'partial') {
      const effectiveScore = reviewStatus === 'partial' ? Math.max(1, qualityScore - 1) : qualityScore
      rewards = calculateRewards(effectiveScore)

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)

      if (pokemon) {
        // Streak: count distinct approved tasks today (by task status, not submissions)
        const today = new Date().toISOString().split('T')[0]
        const todayApproved = sqlite.prepare(
          `SELECT COUNT(*) as count FROM tasks
           WHERE family_id = ? AND status IN ('approved', 'partial')
           AND date(last_updated) = ?`
        ).get(task.family_id, today) as { count: number }

        const streakDays = todayApproved.count >= 1 ? 1 : 0

        statUpdates = calculateStatUpdates(
          rewards,
          task.difficulty,
          pokemon.vitality,
          pokemon.wisdom,
          pokemon.affection,
          streakDays
        )

        // Level up check: count all approved/partial tasks for this child's family
        const totalApproved = sqlite.prepare(
          `SELECT COUNT(*) as count FROM tasks
           WHERE family_id = ? AND status IN ('approved', 'partial')`
        ).get(task.family_id) as { count: number }

        const newLevel = calculateLevel(totalApproved.count)
        const oldLevel = pokemon.level

        if (newLevel > oldLevel) {
          levelUp = { from: oldLevel, to: newLevel }
        }

        // Update pokemon stats and level
        sqlite.prepare(
          `UPDATE pokemons SET vitality = ?, wisdom = ?, affection = ?, level = ?, last_updated = datetime('now')
           WHERE child_id = ?`
        ).run(statUpdates.vitality, statUpdates.wisdom, statUpdates.affection, newLevel, childId)

        // Update inventory
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
      }
    }

    return NextResponse.json({
      success: true,
      message: reviewStatus === 'approved' ? '审核通过！宝可梦获得奖励 🎉' :
                reviewStatus === 'partial' ? '部分完成，继续加油！' : '请重新完成任务',
      rewards,
      statUpdates,
      levelUp,
    })
  } catch (error) {
    console.error('POST /api/tasks/[id]/review error:', error)
    return NextResponse.json({ error: 'Failed to review task' }, { status: 500 })
  }
}

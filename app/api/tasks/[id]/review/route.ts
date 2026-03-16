import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { calculateRewards, calculateStatUpdates } from '@/lib/game-logic'

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

    // Get task
    const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(parseInt(id))
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get submission
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

    // Update task status
    const taskStatus = reviewStatus === 'approved' ? 'approved' :
                       reviewStatus === 'partial' ? 'partial' : 'rejected'
    sqlite.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).run(taskStatus, parseInt(id))

    let rewards = null
    let statUpdates = null

    // Calculate and apply rewards only if approved or partial
    if (reviewStatus === 'approved' || reviewStatus === 'partial') {
      const effectiveScore = reviewStatus === 'partial' ? Math.max(1, qualityScore - 1) : qualityScore
      rewards = calculateRewards(effectiveScore)

      // Get current pokemon stats
      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)

      if (pokemon) {
        // Check streak (how many tasks completed today)
        const today = new Date().toISOString().split('T')[0]
        const todayApproved = sqlite.prepare(
          `SELECT COUNT(*) as count FROM submissions
           WHERE child_id = ? AND date(reviewed_at) = ? AND review_status IN ('approved', 'partial')`
        ).get(childId, today) as { count: number }

        const streakDays = todayApproved.count >= 1 ? 1 : 0

        statUpdates = calculateStatUpdates(
          rewards,
          task.difficulty,
          pokemon.vitality,
          pokemon.wisdom,
          pokemon.affection,
          streakDays
        )

        // Update pokemon stats
        sqlite.prepare(
          `UPDATE pokemons SET vitality = ?, wisdom = ?, affection = ?, last_updated = datetime('now')
           WHERE child_id = ?`
        ).run(statUpdates.vitality, statUpdates.wisdom, statUpdates.affection, childId)

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
    })
  } catch (error) {
    console.error('POST /api/tasks/[id]/review error:', error)
    return NextResponse.json({ error: 'Failed to review task' }, { status: 500 })
  }
}

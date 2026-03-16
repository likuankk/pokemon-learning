import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// GET /api/weekend-challenge?familyId=1
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const familyId = parseInt(searchParams.get('familyId') || '1')

  try {
    const sqlite = (db as any).session.client

    const challenges = sqlite.prepare(
      `SELECT wc.*, t.title, t.subject, t.difficulty, t.status, t.estimated_minutes
       FROM weekend_challenges wc
       LEFT JOIN tasks t ON wc.task_id = t.id
       WHERE wc.family_id = ?
       ORDER BY wc.weekend_date DESC LIMIT 20`
    ).all(familyId)

    return NextResponse.json({ challenges })
  } catch (error) {
    console.error('GET /api/weekend-challenge error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

const CHALLENGE_TYPES = [
  { type: 'comprehensive', label: '综合学科', icon: '📚', description: '跨学科综合挑战' },
  { type: 'creative', label: '创意表达', icon: '🎨', description: '发挥创造力的挑战' },
  { type: 'practical', label: '实践探索', icon: '🔬', description: '动手实践的挑战' },
  { type: 'sports', label: '体育运动', icon: '⚽', description: '锻炼身体的挑战' },
  { type: 'reading', label: '亲子共读', icon: '📖', description: '和家人一起阅读' },
  { type: 'life', label: '生活实践', icon: '🏠', description: '生活技能挑战' },
]

// POST /api/weekend-challenge - Create weekend challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { familyId = 1, createdBy = 1, title, subject, description, difficulty, estimatedMinutes, challengeType, bonusMultiplier = 1.5 } = body

    const sqlite = (db as any).session.client

    // Get this weekend date
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysToSaturday = (6 - dayOfWeek + 7) % 7 || 7
    const weekendDate = new Date(now)
    weekendDate.setDate(now.getDate() + (dayOfWeek === 0 || dayOfWeek === 6 ? 0 : daysToSaturday))
    const weekendStr = weekendDate.toISOString().split('T')[0]

    // Create task
    const taskResult = sqlite.prepare(
      `INSERT INTO tasks (family_id, created_by, title, subject, description, difficulty, estimated_minutes, due_date, is_weekend_challenge, task_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'weekend')`
    ).run(familyId, createdBy, title || '周末挑战', subject || '其他', description || '', difficulty || 4, estimatedMinutes || 60, weekendStr)

    // Create challenge record
    sqlite.prepare(
      'INSERT INTO weekend_challenges (family_id, task_id, challenge_type, bonus_multiplier, weekend_date) VALUES (?, ?, ?, ?, ?)'
    ).run(familyId, taskResult.lastInsertRowid, challengeType || 'comprehensive', bonusMultiplier, weekendStr)

    return NextResponse.json({
      success: true,
      challengeTypes: CHALLENGE_TYPES,
      message: '周末挑战已创建！'
    })
  } catch (error) {
    console.error('POST /api/weekend-challenge error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

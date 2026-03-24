import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'
import { getQuizDifficultyForRegion } from '@/lib/battle-logic'

// How many recent questions to exclude from selection (prevents repeats)
const RECENT_DEDUP_COUNT = 30

// GET /api/quiz?region=1 — Get a random quiz question for battle (with dedup)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const { searchParams } = new URL(request.url)
    const regionId = parseInt(searchParams.get('region') || '1')
    const sqlite = (db as any).session.client

    const { gradeMin, gradeMax, difficulty } = getQuizDifficultyForRegion(regionId)

    // Get recently answered question IDs for this child (to avoid repeats)
    const recentRows = sqlite.prepare(`
      SELECT DISTINCT question_id FROM quiz_answer_history
      WHERE child_id = ?
      ORDER BY answered_at DESC
      LIMIT ?
    `).all(childId, RECENT_DEDUP_COUNT) as { question_id: number }[]
    const recentIds = recentRows.map(r => r.question_id)

    // Build exclusion clause
    let excludeClause = ''
    const params: any[] = [Math.max(1, difficulty - 1), difficulty, gradeMax, gradeMin]
    if (recentIds.length > 0) {
      const placeholders = recentIds.map(() => '?').join(',')
      excludeClause = `AND id NOT IN (${placeholders})`
      params.push(...recentIds)
    }

    // Get a random question matching difficulty, excluding recently answered ones
    let question = sqlite.prepare(`
      SELECT * FROM quiz_questions
      WHERE difficulty BETWEEN ? AND ?
        AND grade_min <= ? AND grade_max >= ?
        ${excludeClause}
      ORDER BY RANDOM()
      LIMIT 1
    `).get(...params) as any

    if (!question) {
      // Fallback 1: try without difficulty filter but still dedup
      const fallbackParams1: any[] = [gradeMax, gradeMin]
      let fallbackExclude1 = ''
      if (recentIds.length > 0) {
        const placeholders = recentIds.map(() => '?').join(',')
        fallbackExclude1 = `AND id NOT IN (${placeholders})`
        fallbackParams1.push(...recentIds)
      }
      question = sqlite.prepare(`
        SELECT * FROM quiz_questions
        WHERE grade_min <= ? AND grade_max >= ?
        ${fallbackExclude1}
        ORDER BY RANDOM()
        LIMIT 1
      `).get(...fallbackParams1) as any
    }

    if (!question) {
      // Fallback 2: any question (ignore dedup — better repeat than no question)
      question = sqlite.prepare('SELECT * FROM quiz_questions ORDER BY RANDOM() LIMIT 1').get() as any
      if (!question) {
        return NextResponse.json({ error: 'No questions available' }, { status: 404 })
      }
    }

    return NextResponse.json({
      id: question.id,
      subject: question.subject,
      question: question.question,
      options: [question.option_a, question.option_b, question.option_c, question.option_d],
      correctIndex: question.correct_index,
      timeLimit: question.time_limit,
      category: question.category,
      difficulty: question.difficulty,
    })
  } catch (error) {
    console.error('GET /api/quiz error:', error)
    return NextResponse.json({ error: 'Failed to get question' }, { status: 500 })
  }
}

// POST /api/quiz — Submit answer and record result
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const { questionId, answerIndex, timeSpent } = await request.json()
    const sqlite = (db as any).session.client

    const question = sqlite.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(questionId) as any
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const correct = answerIndex === question.correct_index

    // Record answer in history (for dedup + wrong answer tracking)
    sqlite.prepare(`
      INSERT INTO quiz_answer_history (child_id, question_id, answer_index, correct, time_spent_sec)
      VALUES (?, ?, ?, ?, ?)
    `).run(childId, questionId, answerIndex, correct ? 1 : 0, timeSpent || 0)

    // Update aggregate stats
    sqlite.prepare(`
      INSERT INTO battle_quiz_stats (child_id, total_answered, total_correct)
      VALUES (?, 1, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        total_answered = total_answered + 1,
        total_correct = total_correct + CASE WHEN ? THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    `).run(childId, correct ? 1 : 0, correct ? 1 : 0)

    return NextResponse.json({
      correct,
      correctIndex: question.correct_index,
    })
  } catch (error) {
    console.error('POST /api/quiz error:', error)
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 })
  }
}

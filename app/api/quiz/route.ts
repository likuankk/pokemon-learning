import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'
import { getQuizDifficultyForRegion } from '@/lib/battle-logic'

// GET /api/quiz?region=1 — Get a random quiz question for battle
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const regionId = parseInt(searchParams.get('region') || '1')
    const sqlite = (db as any).session.client

    const { gradeMin, gradeMax, difficulty } = getQuizDifficultyForRegion(regionId)

    // Get a random question matching difficulty, allowing ±1 difficulty range
    const question = sqlite.prepare(`
      SELECT * FROM quiz_questions
      WHERE difficulty BETWEEN ? AND ?
        AND grade_min <= ? AND grade_max >= ?
      ORDER BY RANDOM()
      LIMIT 1
    `).get(
      Math.max(1, difficulty - 1), difficulty,
      gradeMax, gradeMin
    ) as any

    if (!question) {
      // Fallback: any question
      const fallback = sqlite.prepare('SELECT * FROM quiz_questions ORDER BY RANDOM() LIMIT 1').get() as any
      if (!fallback) {
        return NextResponse.json({ error: 'No questions available' }, { status: 404 })
      }
      return NextResponse.json({
        id: fallback.id,
        subject: fallback.subject,
        question: fallback.question,
        options: [fallback.option_a, fallback.option_b, fallback.option_c, fallback.option_d],
        timeLimit: fallback.time_limit,
        category: fallback.category,
        difficulty: fallback.difficulty,
      })
    }

    return NextResponse.json({
      id: question.id,
      subject: question.subject,
      question: question.question,
      options: [question.option_a, question.option_b, question.option_c, question.option_d],
      timeLimit: question.time_limit,
      category: question.category,
      difficulty: question.difficulty,
    })
  } catch (error) {
    console.error('GET /api/quiz error:', error)
    return NextResponse.json({ error: 'Failed to get question' }, { status: 500 })
  }
}

// POST /api/quiz — Submit answer and get result
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const { questionId, answerIndex } = await request.json()
    const sqlite = (db as any).session.client

    const question = sqlite.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(questionId) as any
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const correct = answerIndex === question.correct_index

    // Update stats
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

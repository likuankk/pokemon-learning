import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

// GET /api/quiz/wrong — Get wrong answer history for a child
// Query params: page, pageSize, subject
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // Parents can view any child's wrong answers; children see their own
    const { searchParams } = new URL(request.url)
    const sqlite = (db as any).session.client

    let childId: number
    if (session.role === 'parent') {
      const targetChildId = searchParams.get('childId')
      if (targetChildId) {
        // Verify this child belongs to the parent's family
        const child = sqlite.prepare(
          'SELECT id FROM users WHERE id = ? AND family_id = ? AND role = ?'
        ).get(parseInt(targetChildId), session.familyId, 'child') as any
        if (!child) {
          return NextResponse.json({ error: '未找到该孩子' }, { status: 404 })
        }
        childId = child.id
      } else {
        // Get first child in family
        const firstChild = sqlite.prepare(
          "SELECT id FROM users WHERE family_id = ? AND role = 'child' ORDER BY id LIMIT 1"
        ).get(session.familyId) as any
        if (!firstChild) {
          return NextResponse.json({ error: '家庭中没有孩子' }, { status: 404 })
        }
        childId = firstChild.id
      }
    } else {
      childId = getChildId(session)
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const subject = searchParams.get('subject') || ''

    // Build query for wrong answers with question details
    const conditions: string[] = ['h.child_id = ?', 'h.correct = 0']
    const params: any[] = [childId]

    if (subject) {
      conditions.push('q.subject = ?')
      params.push(subject)
    }

    const whereClause = conditions.join(' AND ')

    // Count total wrong answers (unique questions)
    const countRow = sqlite.prepare(`
      SELECT COUNT(DISTINCT h.question_id) as total
      FROM quiz_answer_history h
      JOIN quiz_questions q ON q.id = h.question_id
      WHERE ${whereClause}
    `).get(...params) as any
    const total = countRow.total

    // Get wrong answers grouped by question, showing latest attempt
    const offset = (page - 1) * pageSize
    const wrongAnswers = sqlite.prepare(`
      SELECT
        q.id as questionId,
        q.subject,
        q.question,
        q.option_a as optionA,
        q.option_b as optionB,
        q.option_c as optionC,
        q.option_d as optionD,
        q.correct_index as correctIndex,
        q.difficulty,
        q.category,
        q.time_limit as timeLimit,
        COUNT(*) as wrongCount,
        MAX(h.answered_at) as lastWrongAt,
        (SELECT answer_index FROM quiz_answer_history
         WHERE child_id = ? AND question_id = q.id AND correct = 0
         ORDER BY answered_at DESC LIMIT 1) as lastWrongAnswer,
        (SELECT COUNT(*) FROM quiz_answer_history
         WHERE child_id = ? AND question_id = q.id AND correct = 1) as correctCount
      FROM quiz_answer_history h
      JOIN quiz_questions q ON q.id = h.question_id
      WHERE ${whereClause}
      GROUP BY h.question_id
      ORDER BY MAX(h.answered_at) DESC
      LIMIT ? OFFSET ?
    `).all(...params, childId, childId, pageSize, offset) as any[]

    // Get available subjects for filtering
    const subjects = sqlite.prepare(`
      SELECT DISTINCT q.subject
      FROM quiz_answer_history h
      JOIN quiz_questions q ON q.id = h.question_id
      WHERE h.child_id = ? AND h.correct = 0
      ORDER BY q.subject
    `).all(childId) as any[]

    // Get summary stats
    const stats = sqlite.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN correct = 0 THEN question_id END) as totalWrongQuestions,
        COUNT(CASE WHEN correct = 0 THEN 1 END) as totalWrongAnswers,
        COUNT(CASE WHEN correct = 1 THEN 1 END) as totalCorrectAnswers
      FROM quiz_answer_history
      WHERE child_id = ?
    `).get(childId) as any

    return NextResponse.json({
      wrongAnswers: wrongAnswers.map((w: any) => ({
        questionId: w.questionId,
        subject: w.subject,
        question: w.question,
        optionA: w.optionA,
        optionB: w.optionB,
        optionC: w.optionC,
        optionD: w.optionD,
        correctIndex: w.correctIndex,
        difficulty: w.difficulty,
        category: w.category,
        timeLimit: w.timeLimit,
        wrongCount: w.wrongCount,
        lastWrongAt: w.lastWrongAt,
        lastWrongAnswer: w.lastWrongAnswer,
        correctCount: w.correctCount,
        mastered: w.correctCount >= 2, // Considered mastered if answered correctly 2+ times after getting it wrong
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      filters: {
        subjects: subjects.map((s: any) => s.subject),
      },
      stats: {
        totalWrongQuestions: stats.totalWrongQuestions,
        totalWrongAnswers: stats.totalWrongAnswers,
        totalCorrectAnswers: stats.totalCorrectAnswers,
      },
    })
  } catch (error) {
    console.error('GET /api/quiz/wrong error:', error)
    return NextResponse.json({ error: 'Failed to load wrong answers' }, { status: 500 })
  }
}

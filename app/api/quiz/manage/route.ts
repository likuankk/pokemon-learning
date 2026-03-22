import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/quiz/manage — List quiz questions with pagination & filters
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '仅家长可管理题库' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const subject = searchParams.get('subject') || ''
    const difficulty = searchParams.get('difficulty') || ''
    const category = searchParams.get('category') || ''
    const search = searchParams.get('search') || ''

    const sqlite = (db as any).session.client

    // Build dynamic WHERE clause
    const conditions: string[] = []
    const params: any[] = []

    if (subject) {
      conditions.push('subject = ?')
      params.push(subject)
    }
    if (difficulty) {
      conditions.push('difficulty = ?')
      params.push(parseInt(difficulty))
    }
    if (category) {
      conditions.push('category = ?')
      params.push(category)
    }
    if (search) {
      conditions.push('question LIKE ?')
      params.push(`%${search}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countRow = sqlite.prepare(`SELECT COUNT(*) as total FROM quiz_questions ${whereClause}`).get(...params) as any
    const total = countRow.total

    // Get paginated results
    const offset = (page - 1) * pageSize
    const questions = sqlite.prepare(
      `SELECT * FROM quiz_questions ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as any[]

    // Get available subjects and categories for filter dropdowns
    const subjects = sqlite.prepare('SELECT DISTINCT subject FROM quiz_questions ORDER BY subject').all() as any[]
    const categories = sqlite.prepare('SELECT DISTINCT category FROM quiz_questions WHERE category IS NOT NULL AND category != \'\' ORDER BY category').all() as any[]

    return NextResponse.json({
      questions: questions.map((q: any) => ({
        id: q.id,
        subject: q.subject,
        gradeMin: q.grade_min,
        gradeMax: q.grade_max,
        difficulty: q.difficulty,
        question: q.question,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        correctIndex: q.correct_index,
        timeLimit: q.time_limit,
        category: q.category || '',
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      filters: {
        subjects: subjects.map((s: any) => s.subject),
        categories: categories.map((c: any) => c.category),
      },
    })
  } catch (error) {
    console.error('GET /api/quiz/manage error:', error)
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
  }
}

// POST /api/quiz/manage — Create a new quiz question
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '仅家长可管理题库' }, { status: 403 })
    }

    const body = await request.json()
    const { subject, gradeMin, gradeMax, difficulty, question, optionA, optionB, optionC, optionD, correctIndex, timeLimit, category } = body

    // Validate
    if (!subject?.trim()) return NextResponse.json({ error: '请选择学科' }, { status: 400 })
    if (!question?.trim()) return NextResponse.json({ error: '请填写题目' }, { status: 400 })
    if (!optionA?.trim() || !optionB?.trim() || !optionC?.trim() || !optionD?.trim()) {
      return NextResponse.json({ error: '请填写所有选项' }, { status: 400 })
    }
    if (correctIndex === undefined || correctIndex < 0 || correctIndex > 3) {
      return NextResponse.json({ error: '请选择正确答案' }, { status: 400 })
    }

    const sqlite = (db as any).session.client
    const result = sqlite.prepare(`
      INSERT INTO quiz_questions (subject, grade_min, grade_max, difficulty, question, option_a, option_b, option_c, option_d, correct_index, time_limit, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subject.trim(),
      gradeMin || 3,
      gradeMax || 6,
      difficulty || 1,
      question.trim(),
      optionA.trim(),
      optionB.trim(),
      optionC.trim(),
      optionD.trim(),
      correctIndex,
      timeLimit || 10,
      category?.trim() || null
    )

    return NextResponse.json({
      success: true,
      question: {
        id: result.lastInsertRowid,
        subject: subject.trim(),
        gradeMin: gradeMin || 3,
        gradeMax: gradeMax || 6,
        difficulty: difficulty || 1,
        question: question.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        optionC: optionC.trim(),
        optionD: optionD.trim(),
        correctIndex,
        timeLimit: timeLimit || 10,
        category: category?.trim() || '',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/quiz/manage error:', error)
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }
}

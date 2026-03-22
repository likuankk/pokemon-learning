import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// PUT /api/quiz/manage/[id] — Update a quiz question
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '仅家长可管理题库' }, { status: 403 })
    }

    const { id } = await params
    const questionId = parseInt(id)
    if (isNaN(questionId)) {
      return NextResponse.json({ error: '无效的题目 ID' }, { status: 400 })
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

    // Check question exists
    const existing = sqlite.prepare('SELECT id FROM quiz_questions WHERE id = ?').get(questionId) as any
    if (!existing) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    sqlite.prepare(`
      UPDATE quiz_questions SET
        subject = ?, grade_min = ?, grade_max = ?, difficulty = ?,
        question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?,
        correct_index = ?, time_limit = ?, category = ?
      WHERE id = ?
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
      category?.trim() || null,
      questionId
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/quiz/manage/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
  }
}

// DELETE /api/quiz/manage/[id] — Delete a quiz question
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '仅家长可管理题库' }, { status: 403 })
    }

    const { id } = await params
    const questionId = parseInt(id)
    if (isNaN(questionId)) {
      return NextResponse.json({ error: '无效的题目 ID' }, { status: 400 })
    }

    const sqlite = (db as any).session.client

    const existing = sqlite.prepare('SELECT id FROM quiz_questions WHERE id = ?').get(questionId) as any
    if (!existing) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    sqlite.prepare('DELETE FROM quiz_questions WHERE id = ?').run(questionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/quiz/manage/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
  }
}

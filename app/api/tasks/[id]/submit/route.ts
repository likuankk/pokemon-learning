import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)

    const sqlite = (db as any).session.client

    // Check task exists
    const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(parseInt(id))
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'pending' && task.status !== 'rejected') {
      return NextResponse.json({ error: 'Task cannot be submitted in current status' }, { status: 400 })
    }

    // Create submission
    const result = sqlite.prepare(
      `INSERT INTO submissions (task_id, child_id, submitted_at)
       VALUES (?, ?, datetime('now'))`
    ).run(parseInt(id), childId)

    // Update task status
    sqlite.prepare(`UPDATE tasks SET status = 'submitted' WHERE id = ?`).run(parseInt(id))

    const submission = sqlite.prepare('SELECT * FROM submissions WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json({ submission, message: '任务提交成功！等待家长审核' }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks/[id]/submit error:', error)
    return NextResponse.json({ error: 'Failed to submit task' }, { status: 500 })
  }
}

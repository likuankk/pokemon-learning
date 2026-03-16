import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const sqlite = (db as any).session.client
    const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(parseInt(id))

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const submissions = sqlite.prepare('SELECT * FROM submissions WHERE task_id = ?').all(parseInt(id))
    return NextResponse.json({ task, submissions })
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const sqlite = (db as any).session.client

    const fields = Object.keys(body)
      .map(k => {
        const dbKey = k.replace(/([A-Z])/g, '_$1').toLowerCase()
        return `${dbKey} = ?`
      })
      .join(', ')
    const values = Object.values(body)

    sqlite.prepare(`UPDATE tasks SET ${fields} WHERE id = ?`).run(...values, parseInt(id))

    const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(parseInt(id))
    return NextResponse.json({ task })
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const sqlite = (db as any).session.client
    sqlite.prepare('DELETE FROM tasks WHERE id = ?').run(parseInt(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}

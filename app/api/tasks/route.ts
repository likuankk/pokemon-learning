import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const familyId = searchParams.get('familyId') || '1'
  const status = searchParams.get('status')

  try {
    let query = `SELECT t.*, u.name as creator_name FROM tasks t
                 JOIN users u ON t.created_by = u.id
                 WHERE t.family_id = ?`
    const params: (string | number)[] = [parseInt(familyId)]

    if (status) {
      query += ' AND t.status = ?'
      params.push(status)
    }

    query += ' ORDER BY t.created_at DESC'

    const sqlite = (db as any).session.client
    const tasks = sqlite.prepare(query).all(...params)

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('GET /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, subject, description, difficulty, estimatedMinutes, dueDate, familyId = 1, createdBy = 1 } = body

    if (!title || !subject || !dueDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sqlite = (db as any).session.client
    const result = sqlite.prepare(
      `INSERT INTO tasks (family_id, created_by, title, subject, description, difficulty, estimated_minutes, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(familyId, createdBy, title, subject, description || '', difficulty || 3, estimatedMinutes || 30, dueDate)

    const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

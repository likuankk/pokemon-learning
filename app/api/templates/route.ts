import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getFamilyId } from '@/lib/auth'

// GET: list all templates (builtin + family custom)
export async function GET() {
  try {
    const session = await getSession()
    const familyId = getFamilyId(session)
    const sqlite = (db as any).session.client

    const templates = sqlite.prepare(`
      SELECT * FROM task_templates
      WHERE family_id = 0 OR family_id = ?
      ORDER BY (CASE WHEN family_id = 0 THEN 1 ELSE 0 END), sort_order, id
    `).all(familyId) as any[]

    return NextResponse.json({
      templates: templates.map((t: any) => ({
        id: t.id,
        familyId: t.family_id,
        title: t.title,
        subject: t.subject,
        description: t.description,
        difficulty: t.difficulty,
        estimatedMinutes: t.estimated_minutes,
        isBuiltin: t.is_builtin === 1,
        sortOrder: t.sort_order,
      })),
    })
  } catch (error) {
    console.error('GET /api/templates error:', error)
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 })
  }
}

// POST: create a custom template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const familyId = getFamilyId(session)
    const body = await request.json()
    const { title, subject, description, difficulty, estimatedMinutes } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: '请填写模板标题' }, { status: 400 })
    }
    if (!subject) {
      return NextResponse.json({ error: '请选择科目' }, { status: 400 })
    }

    const sqlite = (db as any).session.client
    const result = sqlite.prepare(`
      INSERT INTO task_templates (family_id, title, subject, description, difficulty, estimated_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(familyId, title.trim(), subject, description || '', difficulty || 3, estimatedMinutes || 30)

    return NextResponse.json({
      success: true,
      template: {
        id: result.lastInsertRowid,
        familyId,
        title: title.trim(),
        subject,
        description: description || '',
        difficulty: difficulty || 3,
        estimatedMinutes: estimatedMinutes || 30,
        isBuiltin: false,
        sortOrder: 0,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/templates error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

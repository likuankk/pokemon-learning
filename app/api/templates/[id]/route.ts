import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getFamilyId } from '@/lib/auth'

// PATCH: update a custom template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const familyId = getFamilyId(session)
    const { id } = await params
    const templateId = parseInt(id)
    const body = await request.json()
    const sqlite = (db as any).session.client

    // Only allow editing own family's non-builtin templates
    const existing = sqlite.prepare(
      'SELECT * FROM task_templates WHERE id = ? AND family_id = ? AND is_builtin = 0'
    ).get(templateId, familyId) as any

    if (!existing) {
      return NextResponse.json({ error: '模板不存在或无权编辑' }, { status: 404 })
    }

    const updates: string[] = []
    const values: any[] = []
    const fields: Record<string, string> = {
      title: 'title',
      subject: 'subject',
      description: 'description',
      difficulty: 'difficulty',
      estimatedMinutes: 'estimated_minutes',
    }

    for (const [key, col] of Object.entries(fields)) {
      if (body[key] !== undefined) {
        updates.push(`${col} = ?`)
        values.push(body[key])
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 })
    }

    values.push(templateId)
    sqlite.prepare(`UPDATE task_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/templates/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE: delete a custom template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const familyId = getFamilyId(session)
    const { id } = await params
    const templateId = parseInt(id)
    const sqlite = (db as any).session.client

    // Only allow deleting own family's non-builtin templates
    const result = sqlite.prepare(
      'DELETE FROM task_templates WHERE id = ? AND family_id = ? AND is_builtin = 0'
    ).run(templateId, familyId)

    if (result.changes === 0) {
      return NextResponse.json({ error: '模板不存在或无权删除' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/templates/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}

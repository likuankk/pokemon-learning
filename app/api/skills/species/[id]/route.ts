import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// PUT /api/skills/species/[id] - Update species skill config
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const { id } = await params
    const sqlite = (db as any).session.client
    const body = await request.json()
    const { skill1, skill2, skill3, skill4 } = body

    // Check species exists
    const species = sqlite.prepare('SELECT id FROM species_catalog WHERE id = ?').get(Number(id))
    if (!species) {
      return NextResponse.json({ error: '物种不存在' }, { status: 404 })
    }

    // Validate skill IDs exist
    const skillIds = [skill1, skill2, skill3, skill4].filter(Boolean)
    for (const sid of skillIds) {
      const skill = sqlite.prepare('SELECT id FROM skills WHERE id = ?').get(sid)
      if (!skill) {
        return NextResponse.json({ error: `技能 ${sid} 不存在` }, { status: 400 })
      }
    }

    if (!skill1) {
      return NextResponse.json({ error: '技能槽1不能为空' }, { status: 400 })
    }

    sqlite.prepare(`
      UPDATE species_catalog SET skill1=?, skill2=?, skill3=?, skill4=? WHERE id=?
    `).run(skill1, skill2 || null, skill3 || null, skill4 || null, Number(id))

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

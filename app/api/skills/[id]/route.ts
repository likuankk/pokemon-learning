import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// PUT /api/skills/[id] - Update a skill
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const { id } = await params
    const sqlite = (db as any).session.client
    const body = await request.json()
    const { name, type, power, accuracy, pp, effect, unlock_level } = body

    // Check exists
    const existing = sqlite.prepare('SELECT id FROM skills WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json({ error: '技能不存在' }, { status: 404 })
    }

    const validTypes = ['normal','fire','water','grass','electric','ground','ice','flying','bug','fairy']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ error: '无效的属性类型' }, { status: 400 })
    }

    sqlite.prepare(`
      UPDATE skills SET name=?, type=?, power=?, accuracy=?, pp=?, effect=?, unlock_level=?
      WHERE id=?
    `).run(name, type, power ?? 0, accuracy ?? 100, pp ?? 20, effect || null, unlock_level ?? 1, id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/skills/[id] - Delete a skill
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const { id } = await params
    const sqlite = (db as any).session.client

    // Check references
    const speciesCount = (sqlite.prepare(
      'SELECT COUNT(*) as c FROM species_catalog WHERE skill1=? OR skill2=? OR skill3=? OR skill4=?'
    ).get(id, id, id, id) as { c: number }).c

    const pokemonCount = (sqlite.prepare(
      'SELECT COUNT(*) as c FROM pokemon_skills WHERE skill_id=?'
    ).get(id) as { c: number }).c

    if (speciesCount > 0 || pokemonCount > 0) {
      return NextResponse.json({
        error: '该技能正在被使用，无法删除',
        usedBySpecies: speciesCount,
        usedByPokemon: pokemonCount
      }, { status: 400 })
    }

    sqlite.prepare('DELETE FROM skills WHERE id = ?').run(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

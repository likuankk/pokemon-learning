import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/skills - Get all skills with usage counts
export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const sqlite = (db as any).session.client

    const skills = sqlite.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM species_catalog
         WHERE skill1=s.id OR skill2=s.id OR skill3=s.id OR skill4=s.id) as usedBySpecies,
        (SELECT COUNT(*) FROM pokemon_skills WHERE skill_id=s.id) as usedByPokemon
      FROM skills s
      ORDER BY s.unlock_level, s.type, s.power
    `).all()

    return NextResponse.json({ skills })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/skills - Create a new skill
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const sqlite = (db as any).session.client
    const body = await request.json()
    const { id, name, type, power, accuracy, pp, effect, unlock_level } = body

    // Validate
    if (!id || !name || !type) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }
    if (!/^S\d{2,3}$/.test(id)) {
      return NextResponse.json({ error: 'ID格式错误，应为S01-S999' }, { status: 400 })
    }
    const validTypes = ['normal','fire','water','grass','electric','ground','ice','flying','bug','fairy']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: '无效的属性类型' }, { status: 400 })
    }
    if (![1, 3, 8, 15].includes(unlock_level)) {
      return NextResponse.json({ error: '解锁等级必须为1/3/8/15' }, { status: 400 })
    }

    // Check duplicate
    const existing = sqlite.prepare('SELECT id FROM skills WHERE id = ?').get(id)
    if (existing) {
      return NextResponse.json({ error: '该技能ID已存在' }, { status: 400 })
    }

    sqlite.prepare(
      'INSERT INTO skills (id, name, type, power, accuracy, pp, effect, unlock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, type, power ?? 0, accuracy ?? 100, pp ?? 20, effect || null, unlock_level)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

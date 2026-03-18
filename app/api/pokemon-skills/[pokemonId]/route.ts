import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'
import { SKILL_UNLOCK_LEVELS } from '@/lib/battle-logic'

// PUT /api/pokemon-skills/[pokemonId] - Update pokemon's equipped skills
export async function PUT(request: NextRequest, { params }: { params: Promise<{ pokemonId: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const { pokemonId } = await params
    const pid = Number(pokemonId)
    const sqlite = (db as any).session.client
    const body = await request.json()
    const { skills } = body as { skills: { slot: number; skillId: string }[] }

    // Check pokemon exists and belongs to family
    const pokemon = sqlite.prepare(`
      SELECT p.id, COALESCE(be.battle_level, 1) as battle_level
      FROM pokemons p
      JOIN users u ON u.id = p.child_id
      LEFT JOIN battle_energy be ON be.pokemon_id = p.id
      WHERE p.id = ? AND u.family_id = ?
    `).get(pid, session.familyId) as any

    if (!pokemon) {
      return NextResponse.json({ error: '宝可梦不存在' }, { status: 404 })
    }

    // Validate each skill
    for (const { slot, skillId } of skills) {
      if (slot < 1 || slot > 4) {
        return NextResponse.json({ error: `无效的技能槽 ${slot}` }, { status: 400 })
      }
      // Check skill unlock level
      const requiredLevel = SKILL_UNLOCK_LEVELS[slot] || 1
      if (pokemon.battle_level < requiredLevel) {
        return NextResponse.json({ error: `技能槽${slot}需要战斗等级${requiredLevel}` }, { status: 400 })
      }
      // Check skill exists
      const skill = sqlite.prepare('SELECT id, pp FROM skills WHERE id = ?').get(skillId) as any
      if (!skill) {
        return NextResponse.json({ error: `技能 ${skillId} 不存在` }, { status: 400 })
      }
    }

    // Transaction: replace all skills
    const transaction = sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM pokemon_skills WHERE pokemon_id = ?').run(pid)
      const insertStmt = sqlite.prepare(
        'INSERT INTO pokemon_skills (pokemon_id, skill_id, slot, current_pp) VALUES (?, ?, ?, ?)'
      )
      for (const { slot, skillId } of skills) {
        const skill = sqlite.prepare('SELECT pp FROM skills WHERE id = ?').get(skillId) as any
        insertStmt.run(pid, skillId, slot, skill.pp)
      }
    })
    transaction()

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

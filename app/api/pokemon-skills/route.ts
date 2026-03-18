import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/pokemon-skills - Get all captured pokemon with equipped skills
export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const sqlite = (db as any).session.client

    // Get all pokemon in this family
    const pokemons = sqlite.prepare(`
      SELECT p.id, p.name, p.species_id, p.child_id,
             sc.emoji, sc.type1, sc.type2, sc.name as species_name,
             u.name as child_name,
             COALESCE(be.battle_level, 1) as battle_level
      FROM pokemons p
      JOIN species_catalog sc ON sc.id = p.species_id
      JOIN users u ON u.id = p.child_id
      LEFT JOIN battle_energy be ON be.pokemon_id = p.id
      WHERE u.family_id = ?
      ORDER BY u.id, p.id
    `).all(session.familyId)

    // Get skills for each pokemon
    for (const poke of pokemons as any[]) {
      poke.skills = sqlite.prepare(`
        SELECT ps.slot, ps.skill_id, ps.current_pp, s.name, s.type, s.power, s.accuracy, s.pp
        FROM pokemon_skills ps
        JOIN skills s ON s.id = ps.skill_id
        WHERE ps.pokemon_id = ?
        ORDER BY ps.slot
      `).all(poke.id)
    }

    return NextResponse.json({ pokemons })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

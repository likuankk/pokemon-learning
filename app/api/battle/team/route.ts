import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

// GET /api/battle/team - Get team details
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const sqlite = (db as any).session.client

    const team = sqlite.prepare(`
      SELECT p.*, sc.type1, sc.type2, sc.base_power, sc.base_speed, sc.rarity,
             sc.emoji as species_emoji, sc.name as species_name, sc.region,
             sc.evolves_to, sc.evolution_level
      FROM pokemons p
      LEFT JOIN species_catalog sc ON p.species_id = sc.id
      WHERE p.child_id = ?
      ORDER BY p.is_active DESC, p.battle_level DESC, p.id
    `).all(childId) as any[]

    const result = team.map((p: any) => {
      // Get skills
      const skills = sqlite.prepare(`
        SELECT ps.slot, ps.current_pp, s.*
        FROM pokemon_skills ps JOIN skills s ON ps.skill_id = s.id
        WHERE ps.pokemon_id = ?
        ORDER BY ps.slot
      `).all(p.id) as any[]

      return {
        id: p.id,
        name: p.name,
        speciesId: p.species_id,
        speciesName: p.species_name,
        type1: p.type1,
        type2: p.type2,
        emoji: p.species_emoji,
        battleLevel: p.battle_level,
        battleExp: p.battle_exp,
        battlePower: p.battle_power,
        defense: p.defense,
        hp: p.hp,
        speed: p.speed || p.base_speed,
        vitality: p.vitality,
        wisdom: p.wisdom,
        affection: p.affection,
        isActive: p.is_active === 1,
        source: p.source,
        rarity: p.rarity,
        evolvesTo: p.evolves_to ? JSON.parse(p.evolves_to) : null,
        evolutionLevel: p.evolution_level,
        skills: skills.map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          power: s.power,
          accuracy: s.accuracy,
          pp: s.pp,
          currentPP: s.current_pp,
          slot: s.slot,
          effect: s.effect,
        })),
      }
    })

    return NextResponse.json({ team: result })
  } catch (error) {
    console.error('GET /api/battle/team error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/battle/team - Switch active pokemon or release
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = getChildId(session)
    const { action, pokemonId } = body
    const sqlite = (db as any).session.client

    if (action === 'setActive') {
      // Verify ownership
      const poke = sqlite.prepare('SELECT id, source FROM pokemons WHERE id = ? AND child_id = ?').get(pokemonId, childId) as any
      if (!poke) return NextResponse.json({ error: '宝可梦不存在' }, { status: 404 })

      // Unset all active, set this one
      sqlite.prepare('UPDATE pokemons SET is_active = 0 WHERE child_id = ?').run(childId)
      sqlite.prepare('UPDATE pokemons SET is_active = 1 WHERE id = ?').run(pokemonId)
      return NextResponse.json({ success: true, message: '已切换出战宝可梦！' })
    }

    if (action === 'release') {
      const poke = sqlite.prepare('SELECT id, source, battle_level FROM pokemons WHERE id = ? AND child_id = ?').get(pokemonId, childId) as any
      if (!poke) return NextResponse.json({ error: '宝可梦不存在' }, { status: 404 })
      if (poke.source === 'starter') return NextResponse.json({ error: '初始宝可梦不可释放' }, { status: 400 })

      // Count team size
      const teamSize = (sqlite.prepare('SELECT COUNT(*) as c FROM pokemons WHERE child_id = ?').get(childId) as any).c
      if (teamSize <= 1) return NextResponse.json({ error: '至少需要保留1只宝可梦' }, { status: 400 })

      // Return some candy
      const candyReturn = (poke.battle_level || 1) * 2
      const candyInv = sqlite.prepare("SELECT id FROM inventory WHERE child_id = ? AND item_type = 'candy'").get(childId)
      if (candyInv) {
        sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'candy'").run(candyReturn, childId)
      } else {
        sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'candy', ?)").run(childId, candyReturn)
      }

      // If releasing active pokemon, set another as active
      const wasActive = sqlite.prepare('SELECT is_active FROM pokemons WHERE id = ?').get(pokemonId) as any
      sqlite.prepare('DELETE FROM pokemon_skills WHERE pokemon_id = ?').run(pokemonId)
      sqlite.prepare('DELETE FROM pokemons WHERE id = ?').run(pokemonId)

      if (wasActive?.is_active === 1) {
        const next = sqlite.prepare('SELECT id FROM pokemons WHERE child_id = ? ORDER BY id LIMIT 1').get(childId) as any
        if (next) sqlite.prepare('UPDATE pokemons SET is_active = 1 WHERE id = ?').run(next.id)
      }

      return NextResponse.json({ success: true, message: `已释放宝可梦，获得 ${candyReturn} 星星糖` })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/battle/team error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

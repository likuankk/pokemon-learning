import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'
import { REGIONS } from '@/lib/battle-logic'

// GET /api/battle - Get battle status (energy, regions, team, stats)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const sqlite = (db as any).session.client

    // Ensure battle_energy row exists
    sqlite.prepare('INSERT OR IGNORE INTO battle_energy (child_id) VALUES (?)').run(childId)

    // Auto-refill energy if new day
    const energy = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(childId) as any
    const today = new Date().toISOString().slice(0, 10)
    if (energy.last_refill_date !== today) {
      sqlite.prepare(
        `UPDATE battle_energy SET current_energy = max_energy, last_refill_date = ? WHERE child_id = ?`
      ).run(today, childId)
      energy.current_energy = energy.max_energy
      energy.last_refill_date = today
    }

    // Region unlocks
    const unlocks = sqlite.prepare('SELECT * FROM region_unlocks WHERE child_id = ?').all(childId) as any[]
    const unlockedRegions = unlocks.map((u: any) => u.region)

    // Auto-unlock regions based on total wins
    for (const region of REGIONS) {
      if (!unlockedRegions.includes(region.id) && energy.total_wins >= region.unlockWins) {
        sqlite.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?, ?)').run(childId, region.id)
        unlockedRegions.push(region.id)
      }
    }

    const regionData = REGIONS.map(r => {
      const unlock = unlocks.find((u: any) => u.region === r.id)
      return {
        ...r,
        unlocked: unlockedRegions.includes(r.id),
        bossDefeated: unlock?.boss_defeated === 1,
        eliteDefeated: unlock?.elite_defeated === 1,
      }
    })

    // Active pokemon
    const activePokemon = sqlite.prepare(`
      SELECT p.*, sc.type1, sc.type2, sc.base_power, sc.base_speed, sc.rarity, sc.emoji as species_emoji,
             sc.skill1 as sp_skill1, sc.skill2 as sp_skill2, sc.skill3 as sp_skill3, sc.skill4 as sp_skill4
      FROM pokemons p
      LEFT JOIN species_catalog sc ON p.species_id = sc.id
      WHERE p.child_id = ? AND p.is_active = 1
      LIMIT 1
    `).get(childId) as any

    // Get active pokemon's skills
    let pokemonSkills: any[] = []
    if (activePokemon) {
      pokemonSkills = sqlite.prepare(`
        SELECT ps.*, s.name, s.type, s.power, s.accuracy, s.pp, s.effect, s.unlock_level
        FROM pokemon_skills ps
        JOIN skills s ON ps.skill_id = s.id
        WHERE ps.pokemon_id = ?
        ORDER BY ps.slot
      `).all(activePokemon.id) as any[]
    }

    // Team
    const team = sqlite.prepare(`
      SELECT p.*, sc.type1, sc.type2, sc.base_power, sc.emoji as species_emoji, sc.name as species_name
      FROM pokemons p
      LEFT JOIN species_catalog sc ON p.species_id = sc.id
      WHERE p.child_id = ?
      ORDER BY p.is_active DESC, p.id
    `).all(childId) as any[]

    // Ball inventory
    const ballTypes = ['pokeball', 'greatball', 'ultraball', 'masterball']
    const balls: Record<string, number> = {}
    for (const bt of ballTypes) {
      const inv = sqlite.prepare('SELECT quantity FROM inventory WHERE child_id = ? AND item_type = ?').get(childId, bt) as any
      balls[bt] = Math.floor(inv?.quantity ?? 0)
    }

    // Total species discovered
    const discoveredCount = (sqlite.prepare('SELECT COUNT(*) as c FROM discovered_species WHERE child_id = ?').get(childId) as any).c
    const totalSpecies = (sqlite.prepare('SELECT COUNT(*) as c FROM species_catalog').get() as any).c

    return NextResponse.json({
      energy: {
        current: energy.current_energy,
        max: energy.max_energy,
        totalWins: energy.total_wins,
        totalBattles: energy.total_battles,
      },
      regions: regionData,
      activePokemon: activePokemon ? {
        id: activePokemon.id,
        name: activePokemon.name,
        speciesId: activePokemon.species_id,
        type1: activePokemon.type1,
        type2: activePokemon.type2,
        battleLevel: activePokemon.battle_level,
        battleExp: activePokemon.battle_exp,
        battlePower: activePokemon.battle_power,
        defense: activePokemon.defense,
        hp: activePokemon.hp,
        speed: activePokemon.speed,
        emoji: activePokemon.species_emoji,
        skills: pokemonSkills.map(s => ({
          id: s.skill_id,
          name: s.name,
          type: s.type,
          power: s.power,
          accuracy: s.accuracy,
          pp: s.pp,
          currentPP: s.current_pp,
          slot: s.slot,
        })),
      } : null,
      team: team.map(t => ({
        id: t.id,
        name: t.name,
        speciesId: t.species_id,
        type1: t.type1,
        type2: t.type2,
        battleLevel: t.battle_level,
        battlePower: t.battle_power,
        hp: t.hp,
        isActive: t.is_active === 1,
        emoji: t.species_emoji,
        source: t.source,
      })),
      balls,
      pokedex: { discovered: discoveredCount, total: totalSpecies },
    })
  } catch (error) {
    console.error('GET /api/battle error:', error)
    return NextResponse.json({ error: 'Failed to fetch battle status' }, { status: 500 })
  }
}

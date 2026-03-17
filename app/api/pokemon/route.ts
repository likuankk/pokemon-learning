import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getPokemonStatus, getEvolutionTargets, getEvolutionRequirements, POKEMON_NAMES } from '@/lib/game-logic'
import { getSession, getChildId, getFamilyId } from '@/lib/auth'

// Natural decay: vitality -2/day, wisdom -2/day, affection -1/day, floor 20
function applyNaturalDecay(pokemon: any, sqlite: any) {
  if (!pokemon.last_updated) return pokemon

  const lastUpdated = new Date(pokemon.last_updated.replace(' ', 'T') + (pokemon.last_updated.includes('T') ? '' : 'Z'))
  const now = new Date()
  const hoursPassed = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60)
  const daysPassed = hoursPassed / 24

  if (daysPassed < 1) return pokemon // Less than 24h, no decay

  const decayDays = Math.floor(daysPassed)
  const vitalityDecay = decayDays * 2
  const wisdomDecay = decayDays * 2
  const affectionDecay = decayDays * 1

  const newVitality = Math.max(20, pokemon.vitality - vitalityDecay)
  const newWisdom = Math.max(20, pokemon.wisdom - wisdomDecay)
  const newAffection = Math.max(20, pokemon.affection - affectionDecay)

  // Apply decay to DB
  sqlite.prepare(
    `UPDATE pokemons SET vitality = ?, wisdom = ?, affection = ?, last_updated = datetime('now')
     WHERE id = ?`
  ).run(newVitality, newWisdom, newAffection, pokemon.id)

  return { ...pokemon, vitality: newVitality, wisdom: newWisdom, affection: newAffection }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const childId = parseInt(searchParams.get('childId') || String(getChildId(session)))

  try {
    const sqlite = (db as any).session.client

    let pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any
    if (!pokemon) {
      return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 })
    }

    // Apply natural decay
    pokemon = applyNaturalDecay(pokemon, sqlite)

    // Get all pokemons for this child (for team/collection display)
    const allPokemons = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').all(childId) as any[]

    const inventory = sqlite.prepare(
      'SELECT * FROM inventory WHERE child_id = ?'
    ).all(childId)

    const status = getPokemonStatus(pokemon.vitality, pokemon.wisdom, pokemon.affection)

    // Unify level display: use max of task-level and battle-level
    const displayLevel = Math.max(pokemon.level || 1, pokemon.battle_level || 1)

    const totalTasks = sqlite.prepare(
      `SELECT COUNT(*) as total FROM tasks WHERE family_id = ?`
    ).get(getFamilyId(session)) as { total: number }

    const completedTasks = sqlite.prepare(
      `SELECT COUNT(*) as count FROM tasks
       WHERE family_id = ? AND status IN ('approved', 'partial')`
    ).get(getFamilyId(session)) as { count: number }

    return NextResponse.json({
      pokemon: { ...pokemon, level: displayLevel, status },
      allPokemons,
      inventory,
      todayProgress: {
        completed: completedTasks.count,
        total: totalTasks.total,
      }
    })
  } catch (error) {
    console.error('GET /api/pokemon error:', error)
    return NextResponse.json({ error: 'Failed to fetch pokemon' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)
    const { speciesId = 25, name = '皮卡丘' } = body

    const sqlite = (db as any).session.client

    // Check if pokemon already exists
    const existing = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)
    if (existing) {
      // Update species, reset stage
      sqlite.prepare(
        'UPDATE pokemons SET species_id = ?, name = ?, evolution_stage = 1 WHERE child_id = ?'
      ).run(speciesId, name, childId)
    } else {
      sqlite.prepare(
        'INSERT INTO pokemons (child_id, species_id, name) VALUES (?, ?, ?)'
      ).run(childId, speciesId, name)
    }

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)

    // Record initial species as discovered
    try {
      sqlite.prepare(
        'INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)'
      ).run(childId, speciesId)
    } catch (e) { /* table may not exist yet */ }

    return NextResponse.json({ pokemon }, { status: 201 })
  } catch (error) {
    console.error('POST /api/pokemon error:', error)
    return NextResponse.json({ error: 'Failed to create/update pokemon' }, { status: 500 })
  }
}

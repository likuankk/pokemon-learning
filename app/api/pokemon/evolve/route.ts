import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  checkEvolution, getEvolutionRequirements, getEvolutionTargets,
  getEvolutionChainDisplay, POKEMON_NAMES, getBaseSpeciesId
} from '@/lib/game-logic'
import { getSession, getChildId } from '@/lib/auth'

// GET: get evolution status and progress
export async function GET(request: NextRequest) {
  const session = await getSession()
  const childId = getChildId(session)

  try {
    const sqlite = (db as any).session.client

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any
    if (!pokemon) {
      return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 })
    }

    const fragmentInv = sqlite.prepare(
      'SELECT quantity FROM inventory WHERE child_id = ? AND item_type = ?'
    ).get(childId, 'fragment') as { quantity: number } | undefined

    const fragmentQty = Math.floor(fragmentInv?.quantity ?? 0)
    const currentStage = pokemon.evolution_stage ?? 1
    const level = pokemon.level

    const { canEvolve, targets } = checkEvolution(
      pokemon.species_id, currentStage, level, fragmentQty
    )

    const requirements = getEvolutionRequirements(currentStage)
    const chainDisplay = getEvolutionChainDisplay(pokemon.species_id)

    // Get evolution targets with names
    const allTargets = getEvolutionTargets(pokemon.species_id, currentStage)
    const targetOptions = allTargets.map(id => ({
      speciesId: id,
      name: POKEMON_NAMES[id] || `#${id}`,
    }))

    // Get evolution history
    const history = sqlite.prepare(
      'SELECT * FROM evolution_history WHERE child_id = ? ORDER BY evolved_at DESC LIMIT 10'
    ).all(childId) as any[]

    const historyFormatted = history.map((h: any) => ({
      fromSpeciesId: h.from_species_id,
      fromName: POKEMON_NAMES[h.from_species_id] || `#${h.from_species_id}`,
      toSpeciesId: h.to_species_id,
      toName: POKEMON_NAMES[h.to_species_id] || `#${h.to_species_id}`,
      fromStage: h.from_stage,
      toStage: h.to_stage,
      evolvedAt: h.evolved_at,
    }))

    return NextResponse.json({
      pokemon: {
        speciesId: pokemon.species_id,
        name: pokemon.name,
        level: pokemon.level,
        evolutionStage: currentStage,
      },
      canEvolve,
      requirements: {
        level: requirements.level,
        fragments: requirements.fragments,
        currentLevel: level,
        currentFragments: fragmentQty,
        levelMet: level >= requirements.level,
        fragmentsMet: fragmentQty >= requirements.fragments,
      },
      targets: targetOptions,
      chain: chainDisplay,
      history: historyFormatted,
    })
  } catch (error) {
    console.error('GET /api/pokemon/evolve error:', error)
    return NextResponse.json({ error: 'Failed to get evolution status' }, { status: 500 })
  }
}

// POST: trigger evolution
export async function POST(request: NextRequest) {
  const session = await getSession()
  const childId = getChildId(session)

  try {
    const body = await request.json()
    const { targetSpeciesId } = body

    const sqlite = (db as any).session.client

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any
    if (!pokemon) {
      return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 })
    }

    const fragmentInv = sqlite.prepare(
      'SELECT quantity FROM inventory WHERE child_id = ? AND item_type = ?'
    ).get(childId, 'fragment') as { quantity: number } | undefined

    const fragmentQty = Math.floor(fragmentInv?.quantity ?? 0)
    const currentStage = pokemon.evolution_stage ?? 1
    const level = pokemon.level

    const { canEvolve, nextSpeciesId } = checkEvolution(
      pokemon.species_id, currentStage, level, fragmentQty, targetSpeciesId
    )

    if (!canEvolve || !nextSpeciesId) {
      const requirements = getEvolutionRequirements(currentStage)
      return NextResponse.json({
        error: '进化条件不足',
        requirements: {
          level: requirements.level,
          fragments: requirements.fragments,
          currentLevel: level,
          currentFragments: fragmentQty,
        }
      }, { status: 400 })
    }

    const newStage = currentStage + 1
    const requiredFragments = getEvolutionRequirements(currentStage).fragments
    const newName = POKEMON_NAMES[nextSpeciesId] || pokemon.name

    // Consume fragments
    sqlite.prepare(
      `UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now')
       WHERE child_id = ? AND item_type = 'fragment'`
    ).run(requiredFragments, childId)

    // Update pokemon species, name, and stage
    sqlite.prepare(
      `UPDATE pokemons SET species_id = ?, name = ?, evolution_stage = ?, last_updated = datetime('now')
       WHERE child_id = ?`
    ).run(nextSpeciesId, newName, newStage, childId)

    // Record evolution history
    sqlite.prepare(
      `INSERT INTO evolution_history (child_id, from_species_id, to_species_id, from_stage, to_stage)
       VALUES (?, ?, ?, ?, ?)`
    ).run(childId, pokemon.species_id, nextSpeciesId, currentStage, newStage)

    // Record discovered species
    sqlite.prepare(
      'INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)'
    ).run(childId, nextSpeciesId)

    // Also record original species if not already there
    sqlite.prepare(
      'INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)'
    ).run(childId, pokemon.species_id)

    // Check & unlock evolution achievements
    if (newStage === 2) {
      sqlite.prepare(
        'INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?, ?)'
      ).run(childId, 'first_evolution')
    }
    if (newStage >= 3) {
      sqlite.prepare(
        'INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?, ?)'
      ).run(childId, 'second_evolution')
    }

    // Create notification
    sqlite.prepare(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`
    ).run(childId, 'evolution', '🌟 宝可梦进化了！',
      `${pokemon.name} 进化成了 ${newName}！`)

    return NextResponse.json({
      success: true,
      evolution: {
        from: pokemon.species_id,
        to: nextSpeciesId,
        fromName: pokemon.name,
        toName: newName,
        fromStage: currentStage,
        toStage: newStage,
      },
    })
  } catch (error) {
    console.error('POST /api/pokemon/evolve error:', error)
    return NextResponse.json({ error: 'Failed to evolve pokemon' }, { status: 500 })
  }
}

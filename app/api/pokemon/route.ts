import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getPokemonStatus } from '@/lib/game-logic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const childId = parseInt(searchParams.get('childId') || '2')

  try {
    const sqlite = (db as any).session.client

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)
    if (!pokemon) {
      return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 })
    }

    const inventory = sqlite.prepare(
      'SELECT * FROM inventory WHERE child_id = ?'
    ).all(childId)

    const status = getPokemonStatus(pokemon.vitality, pokemon.wisdom, pokemon.affection)

    // Get today's task progress
    // total = all tasks for this family (each task counted once)
    // completed = tasks whose final status is approved or partial (each task counted once, regardless of how many times resubmitted)
    const totalTasks = sqlite.prepare(
      `SELECT COUNT(*) as total FROM tasks WHERE family_id = 1`
    ).get() as { total: number }

    const completedTasks = sqlite.prepare(
      `SELECT COUNT(*) as count FROM tasks
       WHERE family_id = 1 AND status IN ('approved', 'partial')`
    ).get() as { count: number }

    return NextResponse.json({
      pokemon: { ...pokemon, status },
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
    const { childId = 2, speciesId = 25, name = '皮卡丘' } = body

    const sqlite = (db as any).session.client

    // Check if pokemon already exists
    const existing = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)
    if (existing) {
      // Update species
      sqlite.prepare(
        'UPDATE pokemons SET species_id = ?, name = ? WHERE child_id = ?'
      ).run(speciesId, name, childId)
    } else {
      sqlite.prepare(
        'INSERT INTO pokemons (child_id, species_id, name) VALUES (?, ?, ?)'
      ).run(childId, speciesId, name)
    }

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)
    return NextResponse.json({ pokemon }, { status: 201 })
  } catch (error) {
    console.error('POST /api/pokemon error:', error)
    return NextResponse.json({ error: 'Failed to create/update pokemon' }, { status: 500 })
  }
}

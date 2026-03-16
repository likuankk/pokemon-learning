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

    // Get today's task completion count
    const today = new Date().toISOString().split('T')[0]
    const todayTasks = sqlite.prepare(
      `SELECT COUNT(*) as total FROM tasks WHERE family_id = 1 AND status != 'pending'`
    ).get() as { total: number }

    const completedToday = sqlite.prepare(
      `SELECT COUNT(*) as count FROM submissions
       WHERE child_id = ? AND date(submitted_at) = ?`
    ).get(childId, today) as { count: number }

    return NextResponse.json({
      pokemon: { ...pokemon, status },
      inventory,
      todayProgress: {
        completed: completedToday.count,
        total: todayTasks.total,
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

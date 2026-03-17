import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

const FEED_EFFECTS: Record<string, { vitality: number; wisdom: number; affection: number }> = {
  food:     { vitality: 10, wisdom: 0,  affection: 1 },
  crystal:  { vitality: 0,  wisdom: 8,  affection: 1 },
  candy:    { vitality: 5,  wisdom: 5,  affection: 3 },
  fragment: { vitality: 3,  wisdom: 3,  affection: 5 },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)
    const { itemType } = body

    if (!itemType || !FEED_EFFECTS[itemType]) {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
    }

    const sqlite = (db as any).session.client

    // Check inventory
    const inv = sqlite.prepare(
      'SELECT * FROM inventory WHERE child_id = ? AND item_type = ?'
    ).get(childId, itemType)

    if (!inv || inv.quantity < 1) {
      return NextResponse.json({ error: '道具数量不足' }, { status: 400 })
    }

    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)
    if (!pokemon) {
      return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 })
    }

    const effect = FEED_EFFECTS[itemType]
    const newVitality = Math.min(100, pokemon.vitality + effect.vitality)
    const newWisdom = Math.min(100, pokemon.wisdom + effect.wisdom)
    const newAffection = Math.min(100, pokemon.affection + effect.affection)

    // Deduct item
    sqlite.prepare(
      `UPDATE inventory SET quantity = quantity - 1, updated_at = datetime('now')
       WHERE child_id = ? AND item_type = ?`
    ).run(childId, itemType)

    // Update pokemon
    sqlite.prepare(
      `UPDATE pokemons SET vitality = ?, wisdom = ?, affection = ?, last_updated = datetime('now')
       WHERE child_id = ?`
    ).run(newVitality, newWisdom, newAffection, childId)

    const updatedPokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId)
    const updatedInv = sqlite.prepare('SELECT * FROM inventory WHERE child_id = ?').all(childId)

    return NextResponse.json({
      success: true,
      pokemon: updatedPokemon,
      inventory: updatedInv,
      gains: {
        vitality: effect.vitality,
        wisdom: effect.wisdom,
        affection: effect.affection,
      }
    })
  } catch (error) {
    console.error('POST /api/pokemon/feed error:', error)
    return NextResponse.json({ error: 'Failed to feed pokemon' }, { status: 500 })
  }
}

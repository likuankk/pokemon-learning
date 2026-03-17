import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

// GET /api/battle/species - Get pokedex (all species + discovery status)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const sqlite = (db as any).session.client

    // All species
    const allSpecies = sqlite.prepare('SELECT * FROM species_catalog ORDER BY region, id').all() as any[]

    // Discovered by this child
    const discovered = sqlite.prepare('SELECT species_id FROM discovered_species WHERE child_id = ?').all(childId) as any[]
    const discoveredSet = new Set(discovered.map((d: any) => d.species_id))

    // Owned species
    const owned = sqlite.prepare('SELECT DISTINCT species_id FROM pokemons WHERE child_id = ?').all(childId) as any[]
    const ownedSet = new Set(owned.map((o: any) => o.species_id))

    const result = allSpecies.map((sp: any) => ({
      id: sp.id,
      name: discoveredSet.has(sp.id) ? sp.name : '???',
      type1: discoveredSet.has(sp.id) ? sp.type1 : null,
      type2: discoveredSet.has(sp.id) ? sp.type2 : null,
      emoji: discoveredSet.has(sp.id) ? sp.emoji : '❓',
      rarity: sp.rarity,
      region: sp.region,
      basePower: discoveredSet.has(sp.id) ? sp.base_power : null,
      discovered: discoveredSet.has(sp.id),
      owned: ownedSet.has(sp.id),
    }))

    return NextResponse.json({
      species: result,
      stats: {
        total: allSpecies.length,
        discovered: discoveredSet.size,
        owned: ownedSet.size,
      },
    })
  } catch (error) {
    console.error('GET /api/battle/species error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

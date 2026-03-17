import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

// POST /api/battle/energy - Refill energy (called from task system)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)
    const { amount = 1 } = body
    const sqlite = (db as any).session.client

    // Ensure row exists
    sqlite.prepare('INSERT OR IGNORE INTO battle_energy (child_id) VALUES (?)').run(childId)

    // Check current
    const energy = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(childId) as any
    const maxEnergy = 10 // absolute max with task bonuses
    const newEnergy = Math.min(maxEnergy, energy.current_energy + amount)

    sqlite.prepare('UPDATE battle_energy SET current_energy = ? WHERE child_id = ?').run(newEnergy, childId)

    // Also give battle exp to active pokemon (+5 per task)
    const activePoke = sqlite.prepare('SELECT id, battle_level, battle_exp, species_id FROM pokemons WHERE child_id = ? AND is_active = 1').get(childId) as any
    if (activePoke) {
      const newExp = (activePoke.battle_exp || 0) + 5
      sqlite.prepare('UPDATE pokemons SET battle_exp = ? WHERE id = ?').run(newExp, activePoke.id)
    }

    return NextResponse.json({
      success: true,
      energy: newEnergy,
      message: `战斗能量 +${amount}！`,
    })
  } catch (error) {
    console.error('POST /api/battle/energy error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

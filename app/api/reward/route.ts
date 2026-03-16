import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)
    const { itemType, quantity = 1, message = '' } = body

    if (!itemType || !['food', 'crystal', 'candy', 'fragment'].includes(itemType)) {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
    }

    if (quantity <= 0 || quantity > 20) {
      return NextResponse.json({ error: 'Quantity must be between 1 and 20' }, { status: 400 })
    }

    const sqlite = (db as any).session.client

    const existing = sqlite.prepare(
      'SELECT * FROM inventory WHERE child_id = ? AND item_type = ?'
    ).get(childId, itemType)

    if (existing) {
      sqlite.prepare(
        `UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now')
         WHERE child_id = ? AND item_type = ?`
      ).run(quantity, childId, itemType)
    } else {
      sqlite.prepare(
        'INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)'
      ).run(childId, itemType, quantity)
    }

    const updatedInventory = sqlite.prepare(
      'SELECT * FROM inventory WHERE child_id = ?'
    ).all(childId)

    return NextResponse.json({
      success: true,
      message: message || `已奖励 ${quantity} 个道具！`,
      inventory: updatedInventory,
    })
  } catch (error) {
    console.error('POST /api/reward error:', error)
    return NextResponse.json({ error: 'Failed to grant reward' }, { status: 500 })
  }
}

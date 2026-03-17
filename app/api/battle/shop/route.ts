import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'
import { BALL_INFO, type BallType } from '@/lib/battle-logic'

// POST /api/battle/shop - Buy pokeballs with candy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = getChildId(session)
    const { ballType, quantity = 1 } = body
    const sqlite = (db as any).session.client

    const bt = ballType as BallType
    const info = BALL_INFO[bt]
    if (!info || info.price === 0) {
      return NextResponse.json({ error: '无法购买此物品' }, { status: 400 })
    }

    const totalCost = info.price * quantity

    // Check candy
    const candyInv = sqlite.prepare("SELECT quantity FROM inventory WHERE child_id = ? AND item_type = 'candy'").get(childId) as any
    if (!candyInv || candyInv.quantity < totalCost) {
      return NextResponse.json({ error: `星星糖不足！需要 ${totalCost}，当前 ${Math.floor(candyInv?.quantity ?? 0)}` }, { status: 400 })
    }

    // Deduct candy
    sqlite.prepare("UPDATE inventory SET quantity = quantity - ? WHERE child_id = ? AND item_type = 'candy'").run(totalCost, childId)

    // Add balls
    const existing = sqlite.prepare('SELECT id FROM inventory WHERE child_id = ? AND item_type = ?').get(childId, bt)
    if (existing) {
      sqlite.prepare('UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = ?').run(quantity, childId, bt)
    } else {
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(childId, bt, quantity)
    }

    return NextResponse.json({
      success: true,
      message: `成功购买 ${info.name} x${quantity}！`,
      cost: totalCost,
    })
  } catch (error) {
    console.error('POST /api/battle/shop error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

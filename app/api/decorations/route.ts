import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'

// GET /api/decorations - Get catalog and owned items
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const session = await getSession()
  const childId = parseInt(searchParams.get('childId') || String(getChildId(session)))

  try {
    const sqlite = (db as any).session.client

    const catalog = sqlite.prepare('SELECT * FROM decorations ORDER BY category, price').all()
    const owned = sqlite.prepare('SELECT * FROM house_items WHERE child_id = ?').all(childId) as any[]

    // Get candy balance for purchase
    const candyInv = sqlite.prepare(
      'SELECT quantity FROM inventory WHERE child_id = ? AND item_type = ?'
    ).get(childId, 'candy') as any

    return NextResponse.json({
      catalog,
      owned,
      candyBalance: Math.floor(candyInv?.quantity ?? 0),
    })
  } catch (error) {
    console.error('GET /api/decorations error:', error)
    return NextResponse.json({ error: 'Failed to fetch decorations' }, { status: 500 })
  }
}

// POST /api/decorations - Buy or place decoration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = body.childId || getChildId(session)
    const { action, decorationId, houseItemId, slot } = body
    const sqlite = (db as any).session.client

    if (action === 'buy') {
      const decoration = sqlite.prepare('SELECT * FROM decorations WHERE id = ?').get(decorationId) as any
      if (!decoration) return NextResponse.json({ error: '装饰品不存在' }, { status: 404 })

      const candyInv = sqlite.prepare(
        'SELECT * FROM inventory WHERE child_id = ? AND item_type = ?'
      ).get(childId, 'candy') as any

      if (!candyInv || candyInv.quantity < decoration.price) {
        return NextResponse.json({ error: '星星糖不足！' }, { status: 400 })
      }

      // Deduct candy
      sqlite.prepare(
        `UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE child_id = ? AND item_type = 'candy'`
      ).run(decoration.price, childId)

      // Add to owned
      sqlite.prepare(
        'INSERT INTO house_items (child_id, decoration_id) VALUES (?, ?)'
      ).run(childId, decorationId)

      return NextResponse.json({ success: true, message: `成功购买 ${decoration.name}！` })
    }

    if (action === 'place') {
      sqlite.prepare('UPDATE house_items SET placed = 1, slot = ? WHERE id = ? AND child_id = ?').run(slot || 'default', houseItemId, childId)
      return NextResponse.json({ success: true })
    }

    if (action === 'remove') {
      sqlite.prepare('UPDATE house_items SET placed = 0, slot = NULL WHERE id = ? AND child_id = ?').run(houseItemId, childId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/decorations error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

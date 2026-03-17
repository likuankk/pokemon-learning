import { NextRequest, NextResponse } from 'next/server'
import { getSession, getChildId } from '@/lib/auth'
import db from '@/lib/db'

// GET /api/planner?date=2026-03-17
// Returns saved plan for the given date
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const sqlite = (db as any).session.client
    const rows = sqlite.prepare(
      'SELECT slot, task_id, sort_order FROM daily_plans WHERE child_id = ? AND plan_date = ? ORDER BY slot, sort_order'
    ).all(childId, date) as { slot: string; task_id: number; sort_order: number }[]

    // Group by slot
    const plan: Record<string, number[]> = { morning: [], afternoon: [], evening: [] }
    for (const row of rows) {
      if (plan[row.slot]) {
        plan[row.slot].push(row.task_id)
      }
    }

    return NextResponse.json({ plan, date })
  } catch (error) {
    console.error('GET /api/planner error:', error)
    return NextResponse.json({ error: '获取计划失败' }, { status: 500 })
  }
}

// POST /api/planner
// Save plan for a given date
// Body: { date: string, plan: { morning: number[], afternoon: number[], evening: number[] } }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const childId = getChildId(session)
    const body = await request.json()
    const { date, plan } = body

    if (!date || !plan) {
      return NextResponse.json({ error: '缺少日期或计划数据' }, { status: 400 })
    }

    const sqlite = (db as any).session.client

    // Delete existing plan for this date
    sqlite.prepare('DELETE FROM daily_plans WHERE child_id = ? AND plan_date = ?').run(childId, date)

    // Insert new plan
    const insert = sqlite.prepare(
      'INSERT INTO daily_plans (child_id, plan_date, slot, task_id, sort_order) VALUES (?, ?, ?, ?, ?)'
    )

    const slots = ['morning', 'afternoon', 'evening'] as const
    for (const slot of slots) {
      const taskIds = plan[slot] || []
      for (let i = 0; i < taskIds.length; i++) {
        insert.run(childId, date, slot, taskIds[i], i)
      }
    }

    return NextResponse.json({ success: true, date })
  } catch (error) {
    console.error('POST /api/planner error:', error)
    return NextResponse.json({ error: '保存计划失败' }, { status: 500 })
  }
}

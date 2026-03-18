import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/skills/species - Get all species with skill config
export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const sqlite = (db as any).session.client

    const species = sqlite.prepare(`
      SELECT sc.id, sc.name, sc.emoji, sc.type1, sc.type2, sc.rarity, sc.region,
             sc.skill1, sc.skill2, sc.skill3, sc.skill4,
             s1.name as skill1_name, s1.type as skill1_type, s1.power as skill1_power,
             s2.name as skill2_name, s2.type as skill2_type, s2.power as skill2_power,
             s3.name as skill3_name, s3.type as skill3_type, s3.power as skill3_power,
             s4.name as skill4_name, s4.type as skill4_type, s4.power as skill4_power
      FROM species_catalog sc
      LEFT JOIN skills s1 ON s1.id = sc.skill1
      LEFT JOIN skills s2 ON s2.id = sc.skill2
      LEFT JOIN skills s3 ON s3.id = sc.skill3
      LEFT JOIN skills s4 ON s4.id = sc.skill4
      ORDER BY sc.region, sc.rarity, sc.id
    `).all()

    // Also get regions for filtering
    const regions = sqlite.prepare('SELECT id, name, emoji FROM battle_regions ORDER BY id').all()

    return NextResponse.json({ species, regions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

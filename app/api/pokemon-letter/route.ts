import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

const POKEMON_PERSONALITIES: Record<number, { name: string; style: string; greeting: string }> = {
  1:   { name: '妙蛙种子', style: '温柔鼓励', greeting: '嘿嘿，小主人' },
  4:   { name: '小火龙', style: '热血激励', greeting: '嘿！小主人' },
  7:   { name: '杰尼龟', style: '沉稳分析', greeting: '亲爱的小主人' },
  25:  { name: '皮卡丘', style: '活泼开朗', greeting: '皮卡！小主人' },
  133: { name: '伊布', style: '温暖感性', greeting: '小主人～' },
  39:  { name: '胖丁', style: '可爱温馨', greeting: '小主人呀' },
}

function generateLetter(childName: string, pokemonSpeciesId: number, weekData: any): string {
  const baseId = getBaseSpecies(pokemonSpeciesId)
  const personality = POKEMON_PERSONALITIES[baseId] || POKEMON_PERSONALITIES[25]

  const completionRate = weekData.totalTasks > 0
    ? Math.round((weekData.completedTasks / weekData.totalTasks) * 100)
    : 0

  const streakDays = weekData.streakDays || 0
  const level = weekData.level || 1

  let opening = `${personality.greeting}${childName}！\n\n`

  // Content based on performance
  if (completionRate >= 80) {
    opening += `这一周你真的太棒了！完成了${completionRate}%的任务，我感到非常骄傲！`
  } else if (completionRate >= 50) {
    opening += `这一周你表现得不错哦，完成了${completionRate}%的任务。我相信下周你可以做得更好！`
  } else if (completionRate > 0) {
    opening += `这一周有点辛苦呢，不过没关系，每个人都有累的时候。下周我们一起加油好吗？`
  } else {
    opening += `这一周我好想你呀！有空来看看我好吗？我一直在等你呢～`
  }

  let middle = '\n\n'
  if (streakDays >= 7) {
    middle += `🔥 你已经连续${streakDays}天打卡了，这份坚持真的很了不起！\n`
  }
  if (weekData.bestSubject) {
    middle += `📚 这周你在「${weekData.bestSubject}」方面进步最大，继续保持！\n`
  }
  middle += `现在我已经是Lv.${level}了，都是因为你的努力我才能这么强！\n`

  let closing = '\n'
  if (completionRate >= 80) {
    closing += `下周也请多多指教！我会一直陪在你身边的 💕\n\n你最好的伙伴，\n${personality.name}`
  } else {
    closing += `不管怎样，我都会一直在这里等你的！一起加油吧 💪\n\n永远的伙伴，\n${personality.name}`
  }

  return opening + middle + closing
}

function getBaseSpecies(speciesId: number): number {
  const paths: Record<number, number[]> = {
    1: [1, 2, 3], 4: [4, 5, 6], 7: [7, 8, 9], 25: [25, 26], 39: [39, 40], 133: [133, 135],
  }
  for (const [base, path] of Object.entries(paths)) {
    if (path.includes(speciesId)) return parseInt(base)
  }
  return speciesId
}

// GET /api/pokemon-letter?childId=2
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const childId = parseInt(searchParams.get('childId') || '2')
  const familyId = parseInt(searchParams.get('familyId') || '1')

  try {
    const sqlite = (db as any).session.client

    // Get existing letters
    const letters = sqlite.prepare(
      'SELECT * FROM pokemon_letters WHERE child_id = ? ORDER BY created_at DESC LIMIT 10'
    ).all(childId)

    return NextResponse.json({ letters })
  } catch (error) {
    console.error('GET /api/pokemon-letter error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/pokemon-letter - Generate new letter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { childId = 2, familyId = 1 } = body
    const sqlite = (db as any).session.client

    const child = sqlite.prepare('SELECT name FROM users WHERE id = ?').get(childId) as any
    const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').get(childId) as any

    if (!pokemon) return NextResponse.json({ error: 'No pokemon' }, { status: 404 })

    // Get this week's stats
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek + 1)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = now.toISOString().split('T')[0]

    const weekTasks = sqlite.prepare(
      `SELECT * FROM tasks WHERE family_id = ? AND due_date >= ? AND due_date <= ?`
    ).all(familyId, weekStartStr, weekEndStr) as any[]

    const completedTasks = weekTasks.filter((t: any) => ['approved', 'partial'].includes(t.status)).length

    // Find best subject
    const subjectCounts: Record<string, number> = {}
    for (const t of weekTasks.filter((t: any) => ['approved', 'partial'].includes(t.status))) {
      subjectCounts[t.subject] = (subjectCounts[t.subject] || 0) + 1
    }
    const bestSubject = Object.entries(subjectCounts).sort(([, a], [, b]) => b - a)[0]?.[0]

    const content = generateLetter(
      child?.name || '小朋友',
      pokemon.species_id,
      {
        totalTasks: weekTasks.length,
        completedTasks,
        streakDays: pokemon.streak_days || 0,
        level: pokemon.level,
        bestSubject,
      }
    )

    sqlite.prepare(
      'INSERT INTO pokemon_letters (child_id, content, week_start) VALUES (?, ?, ?)'
    ).run(childId, content, weekStartStr)

    const letter = sqlite.prepare(
      'SELECT * FROM pokemon_letters WHERE child_id = ? ORDER BY id DESC LIMIT 1'
    ).get(childId)

    return NextResponse.json({ letter })
  } catch (error) {
    console.error('POST /api/pokemon-letter error:', error)
    return NextResponse.json({ error: 'Failed to generate letter' }, { status: 500 })
  }
}

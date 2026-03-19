import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'
import {
  generateBattleId, generateWildLevel, generateWildSkills, weightedRandomSpecies,
  calcBattlePower, calcDefense, calcHP, REGIONS, REGION_BOSSES,
  getTypeWeaknesses,
  type PokemonType, type WildPokemon, type BattleState
} from '@/lib/battle-logic'

// In-memory battle states (server-side)
// Use globalThis to persist across HMR / module re-evaluations in Next.js dev
const globalKey = '__pokemon_activeBattles__'
if (!(globalThis as any)[globalKey]) {
  ;(globalThis as any)[globalKey] = new Map<string, BattleState>()
}
const activeBattles: Map<string, BattleState> = (globalThis as any)[globalKey]

// Export for use by action endpoint
export { activeBattles }

// POST /api/battle/encounter - Start a new encounter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = getChildId(session)
    const { region: regionId, challengeBoss, challengeElite } = body
    const sqlite = (db as any).session.client

    // Validate region
    const regionConfig = REGIONS.find(r => r.id === regionId)
    if (!regionConfig) {
      return NextResponse.json({ error: '无效的区域' }, { status: 400 })
    }

    // Check region unlocked
    const unlock = sqlite.prepare('SELECT * FROM region_unlocks WHERE child_id = ? AND region = ?').get(childId, regionId) as any
    if (!unlock) {
      return NextResponse.json({ error: '该区域尚未解锁' }, { status: 400 })
    }

    // Check energy
    const energy = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(childId) as any
    if (!energy || energy.current_energy < 1) {
      return NextResponse.json({ error: '战斗能量不足！完成学习任务来获得能量吧！' }, { status: 400 })
    }

    // Get active pokemon
    const activePokemon = sqlite.prepare(`
      SELECT p.*, sc.type1, sc.type2, sc.base_power, sc.base_speed, sc.emoji as species_emoji,
             sc.skill1 as sp_skill1, sc.skill2 as sp_skill2, sc.skill3 as sp_skill3, sc.skill4 as sp_skill4
      FROM pokemons p
      LEFT JOIN species_catalog sc ON p.species_id = sc.id
      WHERE p.child_id = ? AND p.is_active = 1
      LIMIT 1
    `).get(childId) as any

    if (!activePokemon) {
      return NextResponse.json({ error: '请先选择出战宝可梦' }, { status: 400 })
    }

    // Get player skills
    const playerSkillRows = sqlite.prepare(`
      SELECT ps.*, s.name, s.type, s.power, s.accuracy, s.pp, s.effect
      FROM pokemon_skills ps
      JOIN skills s ON ps.skill_id = s.id
      WHERE ps.pokemon_id = ?
      ORDER BY ps.slot
    `).all(activePokemon.id) as any[]

    const playerSkills = playerSkillRows.map((s: any) => ({
      id: s.skill_id,
      name: s.name,
      type: s.type as PokemonType,
      power: s.power,
      accuracy: s.accuracy,
      pp: s.pp,
      currentPP: s.current_pp,
      effect: s.effect,
    }))

    // Generate wild pokemon
    let wild: WildPokemon
    let isBoss = false
    let bossType: 'elite' | 'boss' | undefined

    if (challengeBoss || challengeElite) {
      // Boss/Elite challenge
      const bossData = REGION_BOSSES[regionId]
      if (!bossData) {
        return NextResponse.json({ error: '该区域没有BOSS' }, { status: 400 })
      }
      const target = challengeBoss ? bossData.boss : bossData.elite
      const species = sqlite.prepare('SELECT * FROM species_catalog WHERE id = ?').get(target.speciesId) as any
      if (!species) {
        return NextResponse.json({ error: '无效的BOSS数据' }, { status: 500 })
      }

      const allSkillsRaw = sqlite.prepare('SELECT * FROM skills').all() as any[]
      const allSkills: Record<string, any> = {}
      allSkillsRaw.forEach(s => { allSkills[s.id] = s })

      const bp = calcBattlePower(species.base_power, target.level)
      const def = calcDefense(species.base_power, target.level)
      const hp = calcHP(species.base_power, target.level)
      const skills = generateWildSkills(species, allSkills, target.level)

      wild = {
        speciesId: species.id,
        name: target.name,
        emoji: species.emoji,
        type1: species.type1 as PokemonType,
        type2: species.type2 as PokemonType | null,
        level: target.level,
        hp: Math.round(hp),
        maxHp: Math.round(hp),
        battlePower: bp,
        defense: def,
        speed: species.base_speed,
        rarity: species.rarity,
        skills,
      }
      isBoss = true
      bossType = challengeBoss ? 'boss' : 'elite'
    } else {
      // Regular encounter
      const pool = sqlite.prepare('SELECT * FROM species_catalog WHERE region = ?').all(regionId) as any[]
      if (pool.length === 0) {
        return NextResponse.json({ error: '该区域没有宝可梦' }, { status: 400 })
      }

      const selected = weightedRandomSpecies(pool)
      const wildLevel = generateWildLevel(regionConfig, activePokemon.battle_level)

      const allSkillsRaw = sqlite.prepare('SELECT * FROM skills').all() as any[]
      const allSkills: Record<string, any> = {}
      allSkillsRaw.forEach(s => { allSkills[s.id] = s })

      const bp = calcBattlePower(selected.base_power, wildLevel)
      const def = calcDefense(selected.base_power, wildLevel)
      const hp = calcHP(selected.base_power, wildLevel)
      const skills = generateWildSkills(selected, allSkills, wildLevel)

      wild = {
        speciesId: selected.id,
        name: selected.name,
        emoji: selected.emoji,
        type1: selected.type1 as PokemonType,
        type2: selected.type2 as PokemonType | null,
        level: wildLevel,
        hp: Math.round(hp),
        maxHp: Math.round(hp),
        battlePower: bp,
        defense: def,
        speed: selected.base_speed,
        rarity: selected.rarity,
        skills,
      }
    }

    // Deduct energy
    sqlite.prepare('UPDATE battle_energy SET current_energy = current_energy - 1 WHERE child_id = ?').run(childId)

    // Create battle state
    const battleId = generateBattleId()
    const battleState: BattleState = {
      battleId,
      childId,
      region: regionId,
      round: 0,
      playerPokemonId: activePokemon.id,
      playerSpeciesId: activePokemon.species_id,
      playerName: activePokemon.name,
      playerType1: (activePokemon.type1 || 'normal') as PokemonType,
      playerType2: activePokemon.type2 as PokemonType | null,
      playerHP: Math.round(activePokemon.hp),
      playerMaxHP: Math.round(activePokemon.hp),
      playerBP: activePokemon.battle_power,
      playerDefense: activePokemon.defense,
      playerSpeed: activePokemon.speed || 50,
      playerSkills: playerSkills,
      playerStatus: null,
      playerAttackBuff: 0,
      playerDefenseBuff: 0,
      playerBuffTurns: 0,
      wild,
      wildStatus: null,
      wildAttackBuff: 0,
      wildDefenseBuff: 0,
      wildBuffTurns: 0,
      isBoss,
      bossType,
      status: 'ongoing',
      // Knowledge system
      quizCombo: 0,
      quizTotalCorrect: 0,
      quizTotalAnswered: 0,
      quizMaxCombo: 0,
      // Tactic system
      activeTactic: null,
      tacticTurnsLeft: 0,
      storedPower: 0,
    }

    activeBattles.set(battleId, battleState)

    // Record discovery
    sqlite.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)').run(childId, wild.speciesId)

    // Get type weakness info for UI
    const wildWeakness = getTypeWeaknesses(wild.type1, wild.type2)

    return NextResponse.json({
      battleId,
      wild: {
        speciesId: wild.speciesId,
        name: wild.name,
        emoji: wild.emoji,
        type1: wild.type1,
        type2: wild.type2,
        level: wild.level,
        hp: wild.hp,
        maxHp: wild.maxHp,
        battlePower: wild.battlePower,
        rarity: wild.rarity,
        skills: wild.skills.map(s => ({ id: s.id, name: s.name, type: s.type, power: s.power })),
        weakTo: wildWeakness.weakTo,
        resistTo: wildWeakness.resistTo,
      },
      myPokemon: {
        id: activePokemon.id,
        speciesId: activePokemon.species_id,
        name: activePokemon.name,
        emoji: activePokemon.species_emoji,
        type1: activePokemon.type1,
        type2: activePokemon.type2,
        hp: Math.round(activePokemon.hp),
        maxHp: Math.round(activePokemon.hp),
        battlePower: activePokemon.battle_power,
        battleLevel: activePokemon.battle_level,
        skills: playerSkills.map(s => ({
          id: s.id, name: s.name, type: s.type, power: s.power, accuracy: s.accuracy, pp: s.pp, currentPP: s.currentPP,
        })),
      },
      energyRemaining: Math.max(0, energy.current_energy - 1),
      isBoss,
      bossType,
    })
  } catch (error) {
    console.error('POST /api/battle/encounter error:', error)
    return NextResponse.json({ error: 'Failed to create encounter' }, { status: 500 })
  }
}

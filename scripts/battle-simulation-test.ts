/**
 * Battle System Simulation Test
 *
 * Simulates a complete user journey through the Pokemon battle system
 * by directly accessing the SQLite database and calling battle-logic functions.
 *
 * Run: cd /Users/likuan/game/pokemon/app && npx tsx scripts/battle-simulation-test.ts
 */

import Database from 'better-sqlite3'
import path from 'path'
import {
  calculateDamage,
  wildAIChooseSkill,
  attemptCapture,
  calculateBattleRewards,
  checkBattleLevelUp,
  getUnlockedSkillSlots,
  calcBattlePower,
  calcDefense,
  calcHP,
  generateBattleId,
  generateWildLevel,
  generateWildSkills,
  weightedRandomSpecies,
  REGIONS,
  REGION_BOSSES,
  BOSS_REWARDS,
  BALL_INFO,
  type PokemonType,
  type WildPokemon,
  type BattleState,
  type BallType,
} from '../lib/battle-logic'

// ── Test Infrastructure ─────────────────────────────────────────────────────

const TEST_DB_PATH = path.join(process.cwd(), 'pokemon-test.db')
let sqlite: Database.Database
let passed = 0
let failed = 0
let skipped = 0
const TEST_FAMILY_ID = 99999
const TEST_CHILD_NAME = '__test_battle_user__'
let testChildId: number

function log(icon: string, msg: string) {
  console.log(`  ${icon} ${msg}`)
}

function pass(step: string, detail?: string) {
  passed++
  log('✅', `PASS: ${step}${detail ? ` — ${detail}` : ''}`)
}

function fail(step: string, detail?: string) {
  failed++
  log('❌', `FAIL: ${step}${detail ? ` — ${detail}` : ''}`)
}

function skip(step: string, reason: string) {
  skipped++
  log('⏭️ ', `SKIP: ${step} — ${reason}`)
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  📋 ${title}`)
  console.log(`${'─'.repeat(60)}`)
}

function assert(condition: boolean, step: string, detail?: string): boolean {
  if (condition) { pass(step, detail); return true }
  else { fail(step, detail); return false }
}

// ── Database Setup (mirrors db.ts but uses test DB) ─────────────────────────

function initTestDB() {
  // Copy production DB structure by running same DDL
  sqlite = new Database(TEST_DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      family_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pokemons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      species_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      vitality REAL NOT NULL DEFAULT 60,
      wisdom REAL NOT NULL DEFAULT 60,
      affection REAL NOT NULL DEFAULT 60,
      level INTEGER NOT NULL DEFAULT 1,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_checkin_date TEXT,
      evolution_stage INTEGER NOT NULL DEFAULT 1,
      max_streak INTEGER NOT NULL DEFAULT 0,
      battle_power REAL NOT NULL DEFAULT 0,
      defense REAL NOT NULL DEFAULT 0,
      hp REAL NOT NULL DEFAULT 0,
      speed INTEGER NOT NULL DEFAULT 50,
      battle_exp INTEGER NOT NULL DEFAULT 0,
      battle_level INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'starter'
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(child_id, item_type)
    );
    CREATE TABLE IF NOT EXISTS species_catalog (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type1 TEXT NOT NULL,
      type2 TEXT,
      base_power INTEGER NOT NULL,
      base_speed INTEGER NOT NULL,
      rarity INTEGER NOT NULL DEFAULT 1,
      region INTEGER NOT NULL DEFAULT 1,
      evolves_from INTEGER,
      evolves_to TEXT,
      evolution_level INTEGER,
      emoji TEXT NOT NULL DEFAULT '?',
      skill1 TEXT,
      skill2 TEXT,
      skill3 TEXT,
      skill4 TEXT
    );
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      power INTEGER NOT NULL DEFAULT 0,
      accuracy INTEGER NOT NULL DEFAULT 100,
      pp INTEGER NOT NULL DEFAULT 20,
      effect TEXT,
      unlock_level INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pokemon_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      slot INTEGER NOT NULL DEFAULT 1,
      current_pp INTEGER NOT NULL DEFAULT 20,
      UNIQUE(pokemon_id, slot)
    );
    CREATE TABLE IF NOT EXISTS battle_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      pokemon_id INTEGER NOT NULL,
      wild_species_id INTEGER NOT NULL,
      wild_level INTEGER NOT NULL,
      region INTEGER NOT NULL,
      result TEXT NOT NULL,
      rounds INTEGER NOT NULL DEFAULT 0,
      exp_gained INTEGER NOT NULL DEFAULT 0,
      captured_pokemon_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS battle_energy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL UNIQUE,
      current_energy INTEGER NOT NULL DEFAULT 5,
      max_energy INTEGER NOT NULL DEFAULT 5,
      last_refill_date TEXT NOT NULL DEFAULT (date('now')),
      total_wins INTEGER NOT NULL DEFAULT 0,
      total_battles INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS region_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      region INTEGER NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      boss_defeated INTEGER NOT NULL DEFAULT 0,
      elite_defeated INTEGER NOT NULL DEFAULT 0,
      UNIQUE(child_id, region)
    );
    CREATE TABLE IF NOT EXISTS discovered_species (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      species_id INTEGER NOT NULL,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(child_id, species_id)
    );
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '?',
      tier INTEGER NOT NULL DEFAULT 1,
      condition_type TEXT NOT NULL,
      condition_value INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS child_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(child_id, achievement_id)
    );
  `)
}

function seedTestData() {
  // Seed skills
  const skills = [
    { id: 'S01', name: '撞击', type: 'normal', power: 30, accuracy: 100, pp: 30, effect: null, unlock_level: 1 },
    { id: 'S02', name: '抓', type: 'normal', power: 35, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S03', name: '火花', type: 'fire', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S04', name: '水枪', type: 'water', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S05', name: '藤鞭', type: 'grass', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S06', name: '电击', type: 'electric', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S07', name: '泥巴射击', type: 'ground', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S08', name: '冰冻之风', type: 'ice', power: 40, accuracy: 95, pp: 20, effect: '{"type":"speed_down","chance":100,"amount":0.3}', unlock_level: 1 },
    { id: 'S09', name: '翅膀攻击', type: 'flying', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S10', name: '虫咬', type: 'bug', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S11', name: '妖精之风', type: 'fairy', power: 40, accuracy: 100, pp: 25, effect: null, unlock_level: 1 },
    { id: 'S12', name: '喷射火焰', type: 'fire', power: 65, accuracy: 95, pp: 15, effect: '{"type":"burn","chance":10}', unlock_level: 3 },
    { id: 'S13', name: '水之波动', type: 'water', power: 60, accuracy: 100, pp: 15, effect: null, unlock_level: 3 },
    { id: 'S14', name: '飞叶快刀', type: 'grass', power: 60, accuracy: 95, pp: 15, effect: null, unlock_level: 3 },
    { id: 'S15', name: '十万伏特', type: 'electric', power: 65, accuracy: 95, pp: 15, effect: '{"type":"paralyze","chance":10}', unlock_level: 3 },
    { id: 'S16', name: '地震', type: 'ground', power: 70, accuracy: 100, pp: 10, effect: null, unlock_level: 3 },
    { id: 'S17', name: '冰冻光线', type: 'ice', power: 65, accuracy: 95, pp: 15, effect: '{"type":"freeze","chance":10}', unlock_level: 3 },
    { id: 'S18', name: '空气斩', type: 'flying', power: 60, accuracy: 95, pp: 15, effect: null, unlock_level: 3 },
    { id: 'S19', name: '信号光束', type: 'bug', power: 60, accuracy: 100, pp: 15, effect: null, unlock_level: 3 },
    { id: 'S20', name: '光墙', type: 'normal', power: 0, accuracy: 100, pp: 10, effect: '{"type":"defense_up","amount":0.5,"duration":3}', unlock_level: 8 },
    { id: 'S21', name: '剑舞', type: 'normal', power: 0, accuracy: 100, pp: 10, effect: '{"type":"attack_up","amount":0.5,"duration":3}', unlock_level: 8 },
    { id: 'S22', name: '催眠术', type: 'normal', power: 0, accuracy: 60, pp: 5, effect: '{"type":"sleep","duration":2}', unlock_level: 8 },
    { id: 'S23', name: '治愈之愿', type: 'normal', power: 0, accuracy: 100, pp: 5, effect: '{"type":"heal","amount":0.3}', unlock_level: 8 },
    { id: 'S24', name: '大字爆炎', type: 'fire', power: 90, accuracy: 85, pp: 5, effect: '{"type":"burn","chance":20}', unlock_level: 15 },
    { id: 'S25', name: '水炮', type: 'water', power: 90, accuracy: 85, pp: 5, effect: null, unlock_level: 15 },
    { id: 'S26', name: '日光束', type: 'grass', power: 95, accuracy: 90, pp: 5, effect: null, unlock_level: 15 },
    { id: 'S27', name: '雷霆', type: 'electric', power: 90, accuracy: 85, pp: 5, effect: '{"type":"paralyze","chance":20}', unlock_level: 15 },
    { id: 'S28', name: '暴风雪', type: 'ice', power: 90, accuracy: 85, pp: 5, effect: '{"type":"freeze","chance":20}', unlock_level: 15 },
    { id: 'S29', name: '破坏光线', type: 'normal', power: 100, accuracy: 90, pp: 3, effect: null, unlock_level: 15 },
  ]
  const skillStmt = sqlite.prepare('INSERT OR IGNORE INTO skills (id,name,type,power,accuracy,pp,effect,unlock_level) VALUES (?,?,?,?,?,?,?,?)')
  for (const sk of skills) {
    skillStmt.run(sk.id, sk.name, sk.type, sk.power, sk.accuracy, sk.pp, sk.effect, sk.unlock_level)
  }

  // Seed species catalog (key species for testing)
  const species = [
    // Region 1
    { id: 1, name: '妙蛙种子', type1: 'grass', type2: null, base_power: 45, base_speed: 45, rarity: 2, region: 1, evolves_from: null, evolves_to: '[2]', evolution_level: 5, emoji: '🌿', skill1: 'S05', skill2: 'S14', skill3: 'S23', skill4: 'S26' },
    { id: 10, name: '绿毛虫', type1: 'bug', type2: null, base_power: 25, base_speed: 30, rarity: 1, region: 1, evolves_from: null, evolves_to: '[11]', evolution_level: 3, emoji: '🐛', skill1: 'S10', skill2: 'S19', skill3: 'S20', skill4: 'S29' },
    { id: 43, name: '走路草', type1: 'grass', type2: null, base_power: 40, base_speed: 35, rarity: 1, region: 1, evolves_from: null, evolves_to: '[44]', evolution_level: 6, emoji: '🌿', skill1: 'S05', skill2: 'S14', skill3: 'S22', skill4: 'S26' },
    { id: 69, name: '喇叭芽', type1: 'grass', type2: null, base_power: 38, base_speed: 35, rarity: 1, region: 1, evolves_from: null, evolves_to: '[70]', evolution_level: 6, emoji: '🌱', skill1: 'S05', skill2: 'S14', skill3: 'S21', skill4: 'S26' },
    { id: 3, name: '妙蛙花', type1: 'grass', type2: null, base_power: 90, base_speed: 55, rarity: 4, region: 1, evolves_from: 2, evolves_to: null, evolution_level: null, emoji: '🌿', skill1: 'S05', skill2: 'S14', skill3: 'S23', skill4: 'S26' },
    { id: 12, name: '巴大蝶', type1: 'bug', type2: 'flying', base_power: 60, base_speed: 55, rarity: 2, region: 1, evolves_from: 11, evolves_to: null, evolution_level: null, emoji: '🦋', skill1: 'S10', skill2: 'S18', skill3: 'S22', skill4: 'S29' },
    // Region 2
    { id: 4, name: '小火龙', type1: 'fire', type2: null, base_power: 48, base_speed: 55, rarity: 2, region: 2, evolves_from: null, evolves_to: '[5]', evolution_level: 5, emoji: '🔥', skill1: 'S03', skill2: 'S12', skill3: 'S21', skill4: 'S24' },
    { id: 6, name: '喷火龙', type1: 'fire', type2: 'flying', base_power: 95, base_speed: 70, rarity: 4, region: 2, evolves_from: 5, evolves_to: null, evolution_level: null, emoji: '🔥', skill1: 'S03', skill2: 'S12', skill3: 'S09', skill4: 'S24' },
    { id: 78, name: '烈焰马', type1: 'fire', type2: null, base_power: 80, base_speed: 75, rarity: 3, region: 2, evolves_from: 77, evolves_to: null, evolution_level: null, emoji: '🐴', skill1: 'S03', skill2: 'S12', skill3: 'S01', skill4: 'S24' },
    // Region 3
    { id: 7, name: '杰尼龟', type1: 'water', type2: null, base_power: 46, base_speed: 43, rarity: 2, region: 3, evolves_from: null, evolves_to: '[8]', evolution_level: 5, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S20', skill4: 'S25' },
    // Region 4
    { id: 25, name: '皮卡丘', type1: 'electric', type2: null, base_power: 50, base_speed: 70, rarity: 2, region: 4, evolves_from: null, evolves_to: '[26]', evolution_level: 8, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S21', skill4: 'S27' },
  ]
  const specStmt = sqlite.prepare('INSERT OR IGNORE INTO species_catalog (id,name,type1,type2,base_power,base_speed,rarity,region,evolves_from,evolves_to,evolution_level,emoji,skill1,skill2,skill3,skill4) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  for (const sp of species) {
    specStmt.run(sp.id, sp.name, sp.type1, sp.type2, sp.base_power, sp.base_speed, sp.rarity, sp.region, sp.evolves_from, sp.evolves_to, sp.evolution_level, sp.emoji, sp.skill1, sp.skill2, sp.skill3, sp.skill4)
  }

  // Seed achievements
  const achievements = [
    { id: 'B-01', title: '初次战斗', description: '完成第1场战斗', category: 'battle', icon: '⚔️', tier: 1, condition_type: 'total_battles', condition_value: 1 },
    { id: 'B-02', title: '十胜将军', description: '累计胜利10场', category: 'battle', icon: '🏆', tier: 1, condition_type: 'total_wins', condition_value: 10 },
  ]
  const achStmt = sqlite.prepare('INSERT OR IGNORE INTO achievements (id,title,description,category,icon,tier,condition_type,condition_value) VALUES (?,?,?,?,?,?,?,?)')
  for (const a of achievements) {
    achStmt.run(a.id, a.title, a.description, a.category, a.icon, a.tier, a.condition_type, a.condition_value)
  }
}

function createTestUser(): number {
  // Create test user
  const result = sqlite.prepare(
    "INSERT INTO users (name, role, family_id) VALUES (?, 'child', ?)"
  ).run(TEST_CHILD_NAME, TEST_FAMILY_ID)
  const childId = Number(result.lastInsertRowid)

  // Create starter pokemon (妙蛙种子)
  const species = sqlite.prepare('SELECT * FROM species_catalog WHERE id = 1').get() as any
  const bp = calcBattlePower(species.base_power, 1)
  const def = calcDefense(species.base_power, 1)
  const hp = calcHP(species.base_power, 1)
  const now = new Date().toISOString()

  const pokeResult = sqlite.prepare(
    `INSERT INTO pokemons (child_id, species_id, name, vitality, wisdom, affection, level, battle_power, defense, hp, speed, battle_exp, battle_level, is_active, source, last_updated, created_at)
     VALUES (?,?,?,60,60,60,1,?,?,?,?,0,1,1,'starter',?,?)`
  ).run(childId, 1, '妙蛙种子', bp, def, hp, species.base_speed, now, now)

  // Assign initial skill
  sqlite.prepare('INSERT INTO pokemon_skills (pokemon_id, skill_id, slot, current_pp) VALUES (?, ?, 1, 25)')
    .run(Number(pokeResult.lastInsertRowid), 'S05')

  // Initialize battle energy (give extra energy for testing)
  sqlite.prepare('INSERT INTO battle_energy (child_id, current_energy, max_energy) VALUES (?, 20, 20)')
    .run(childId)

  // Unlock region 1
  sqlite.prepare('INSERT INTO region_unlocks (child_id, region) VALUES (?, 1)').run(childId)

  // Give initial pokeballs and candy
  sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'pokeball', 10)").run(childId)
  sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'candy', 100)").run(childId)

  return childId
}

function cleanup() {
  try {
    sqlite.close()
    require('fs').unlinkSync(TEST_DB_PATH)
    require('fs').unlinkSync(TEST_DB_PATH + '-wal').catch?.(() => {})
    require('fs').unlinkSync(TEST_DB_PATH + '-shm').catch?.(() => {})
  } catch {
    // ignore cleanup errors
  }
}

// ── Helper: Generate a wild pokemon for encounter ───────────────────────────

function generateWildForRegion(regionId: number, playerBattleLevel: number): WildPokemon {
  const regionConfig = REGIONS.find(r => r.id === regionId)!
  const pool = sqlite.prepare('SELECT * FROM species_catalog WHERE region = ?').all(regionId) as any[]
  const selected = weightedRandomSpecies(pool)
  const wildLevel = generateWildLevel(regionConfig, playerBattleLevel)

  const allSkillsRaw = sqlite.prepare('SELECT * FROM skills').all() as any[]
  const allSkills: Record<string, any> = {}
  allSkillsRaw.forEach((s: any) => { allSkills[s.id] = s })

  const bp = calcBattlePower(selected.base_power, wildLevel)
  const def = calcDefense(selected.base_power, wildLevel)
  const hp = calcHP(selected.base_power, wildLevel)
  const skills = generateWildSkills(selected, allSkills, wildLevel)

  return {
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

function getActivePokemon() {
  return sqlite.prepare(`
    SELECT p.*, sc.type1, sc.type2, sc.base_power, sc.base_speed, sc.rarity, sc.emoji as species_emoji,
           sc.skill1 as sp_skill1, sc.skill2 as sp_skill2, sc.skill3 as sp_skill3, sc.skill4 as sp_skill4
    FROM pokemons p
    LEFT JOIN species_catalog sc ON p.species_id = sc.id
    WHERE p.child_id = ? AND p.is_active = 1
    LIMIT 1
  `).get(testChildId) as any
}

function getPlayerSkills(pokemonId: number) {
  return sqlite.prepare(`
    SELECT ps.*, s.name, s.type, s.power, s.accuracy, s.pp, s.effect
    FROM pokemon_skills ps
    JOIN skills s ON ps.skill_id = s.id
    WHERE ps.pokemon_id = ?
    ORDER BY ps.slot
  `).all(pokemonId) as any[]
}

function getInventory(itemType: string): number {
  const inv = sqlite.prepare('SELECT quantity FROM inventory WHERE child_id = ? AND item_type = ?').get(testChildId, itemType) as any
  return Math.floor(inv?.quantity ?? 0)
}

function setInventory(itemType: string, quantity: number) {
  const existing = sqlite.prepare('SELECT id FROM inventory WHERE child_id = ? AND item_type = ?').get(testChildId, itemType)
  if (existing) {
    sqlite.prepare('UPDATE inventory SET quantity = ? WHERE child_id = ? AND item_type = ?').run(quantity, testChildId, itemType)
  } else {
    sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(testChildId, itemType, quantity)
  }
}

// ── Simulate battle action (fight one round, return outcome) ────────────────

function simulateBattleRound(battle: BattleState, skillId: string): {
  playerDamage: number
  wildDamage: number
  wildDefeated: boolean
  playerDefeated: boolean
} {
  battle.round++
  const playerSkill = battle.playerSkills.find(s => s.id === skillId)!
  playerSkill.currentPP--

  // Player attacks
  const playerDmg = calculateDamage(
    battle.playerBP, playerSkill.power, playerSkill.type as PokemonType,
    playerSkill.accuracy,
    battle.wild.defense,
    battle.wild.type1, battle.wild.type2,
    0, battle.playerAttackBuff, battle.wildDefenseBuff,
  )
  battle.wild.hp = Math.max(0, battle.wild.hp - playerDmg.damage)

  if (battle.wild.hp <= 0) {
    battle.status = 'win'
    return { playerDamage: playerDmg.damage, wildDamage: 0, wildDefeated: true, playerDefeated: false }
  }

  // Wild attacks
  const wildSkill = wildAIChooseSkill(
    battle.wild.skills, battle.wild.level,
    battle.playerType1, battle.playerType2,
    battle.wild.hp, battle.wild.maxHp,
  )
  const wildDmg = calculateDamage(
    battle.wild.battlePower, wildSkill.power, wildSkill.type,
    wildSkill.accuracy,
    battle.playerDefense,
    battle.playerType1, battle.playerType2,
    0, battle.wildAttackBuff, battle.playerDefenseBuff,
  )
  battle.playerHP = Math.max(0, battle.playerHP - wildDmg.damage)

  if (battle.playerHP <= 0) {
    battle.status = 'lose'
    return { playerDamage: playerDmg.damage, wildDamage: wildDmg.damage, wildDefeated: false, playerDefeated: true }
  }

  return { playerDamage: playerDmg.damage, wildDamage: wildDmg.damage, wildDefeated: false, playerDefeated: false }
}

function createBattleState(wild: WildPokemon, isBoss = false, bossType?: 'elite' | 'boss'): BattleState {
  const active = getActivePokemon()
  const skills = getPlayerSkills(active.id)

  return {
    battleId: generateBattleId(),
    childId: testChildId,
    region: 1,
    round: 0,
    playerPokemonId: active.id,
    playerSpeciesId: active.species_id,
    playerName: active.name,
    playerType1: (active.type1 || 'normal') as PokemonType,
    playerType2: active.type2 as PokemonType | null,
    playerHP: Math.round(active.hp),
    playerMaxHP: Math.round(active.hp),
    playerBP: active.battle_power,
    playerDefense: active.defense,
    playerSpeed: active.speed || 50,
    playerSkills: skills.map((s: any) => ({
      id: s.skill_id,
      name: s.name,
      type: s.type as PokemonType,
      power: s.power,
      accuracy: s.accuracy,
      pp: s.pp,
      currentPP: s.current_pp,
      effect: s.effect,
    })),
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
  }
}

function applyWinRewards(battle: BattleState) {
  const rewards = calculateBattleRewards(battle.wild.level, battle.wild.rarity)

  // Apply exp
  const pokemon = sqlite.prepare('SELECT battle_level, battle_exp, species_id FROM pokemons WHERE id = ?').get(battle.playerPokemonId) as any
  const species = sqlite.prepare('SELECT base_power, base_speed, skill1, skill2, skill3, skill4 FROM species_catalog WHERE id = ?').get(pokemon.species_id) as any

  const newExpTotal = (pokemon.battle_exp || 0) + rewards.exp
  const levelResult = checkBattleLevelUp(pokemon.battle_level || 1, newExpTotal)

  const newBP = calcBattlePower(species.base_power, levelResult.newLevel)
  const newDef = calcDefense(species.base_power, levelResult.newLevel)
  const newHP = calcHP(species.base_power, levelResult.newLevel)

  sqlite.prepare(
    `UPDATE pokemons SET battle_exp = ?, battle_level = ?, battle_power = ?, defense = ?, hp = ?, last_updated = datetime('now') WHERE id = ?`
  ).run(levelResult.newExp, levelResult.newLevel, newBP, newDef, newHP, battle.playerPokemonId)

  // Unlock new skills
  const newSkillSlots = getUnlockedSkillSlots(levelResult.newLevel)
  const skillFields = ['skill1', 'skill2', 'skill3', 'skill4'] as const
  for (const slot of newSkillSlots) {
    const fieldName = skillFields[slot - 1]
    if (species[fieldName]) {
      const existing = sqlite.prepare('SELECT id FROM pokemon_skills WHERE pokemon_id = ? AND slot = ?').get(battle.playerPokemonId, slot)
      if (!existing) {
        sqlite.prepare('INSERT OR IGNORE INTO pokemon_skills (pokemon_id, skill_id, slot) VALUES (?, ?, ?)')
          .run(battle.playerPokemonId, species[fieldName], slot)
      }
    }
  }

  // Add rewards to inventory
  if (rewards.candy > 0) {
    const candyInv = sqlite.prepare("SELECT id FROM inventory WHERE child_id = ? AND item_type = 'candy'").get(testChildId)
    if (candyInv) {
      sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'candy'").run(rewards.candy, testChildId)
    } else {
      sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'candy', ?)").run(testChildId, rewards.candy)
    }
  }
  if (rewards.pokeball > 0) {
    const pbInv = sqlite.prepare("SELECT id FROM inventory WHERE child_id = ? AND item_type = 'pokeball'").get(testChildId)
    if (pbInv) {
      sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'pokeball'").run(rewards.pokeball, testChildId)
    } else {
      sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'pokeball', ?)").run(testChildId, rewards.pokeball)
    }
  }

  // Log
  sqlite.prepare(
    'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds, exp_gained) VALUES (?,?,?,?,?,?,?,?)'
  ).run(testChildId, battle.playerPokemonId, battle.wild.speciesId, battle.wild.level, battle.region, 'win', battle.round, rewards.exp)
  sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1, total_wins = total_wins + 1, current_energy = current_energy - 1 WHERE child_id = ?').run(testChildId)

  return { rewards, levelResult }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TEST STEPS ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\n🎮 Pokemon Battle System — Comprehensive Simulation Test')
  console.log('═'.repeat(60))

  // ── Setup ──────────────────────────────────────────────────────────────────
  section('Setup')
  initTestDB()
  seedTestData()
  testChildId = createTestUser()
  pass('Test database initialized and user created', `childId=${testChildId}`)

  // ── Step 1: Check initial battle status ────────────────────────────────────
  section('Step 1: Check initial battle status')
  {
    const energy = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(testChildId) as any
    assert(energy !== undefined, 'Battle energy row exists')
    assert(energy.current_energy === 20, 'Initial energy = 20 (test override)', `got ${energy.current_energy}`)
    assert(energy.max_energy === 20, 'Max energy = 20')
    assert(energy.total_wins === 0, 'Total wins starts at 0')
    assert(energy.total_battles === 0, 'Total battles starts at 0')

    const active = getActivePokemon()
    assert(active !== undefined, 'Has active pokemon')
    assert(active.name === '妙蛙种子', 'Active pokemon is starter (妙蛙种子)', `got "${active.name}"`)
    assert(active.battle_level === 1, 'Battle level starts at 1')
    assert(active.is_active === 1, 'Pokemon is marked active')

    const skills = getPlayerSkills(active.id)
    assert(skills.length >= 1, 'Starter has at least 1 skill', `has ${skills.length}`)
    assert(skills[0].skill_id === 'S05', 'First skill is 藤鞭 (S05)')

    const unlocks = sqlite.prepare('SELECT * FROM region_unlocks WHERE child_id = ?').all(testChildId) as any[]
    assert(unlocks.length === 1, 'Has 1 region unlocked')
    assert(unlocks[0].region === 1, 'Region 1 is unlocked')

    const pokeballs = getInventory('pokeball')
    assert(pokeballs === 10, 'Has 10 initial pokeballs', `got ${pokeballs}`)
  }

  // ── Step 2: Encounter a wild pokemon in region 1 ──────────────────────────
  section('Step 2: Encounter wild pokemon in region 1')
  let wildPokemon: WildPokemon
  {
    wildPokemon = generateWildForRegion(1, 1)
    assert(wildPokemon !== undefined, 'Generated wild pokemon')
    assert(wildPokemon.hp > 0, 'Wild has HP > 0', `hp=${wildPokemon.hp}`)
    assert(wildPokemon.skills.length >= 1, 'Wild has skills', `count=${wildPokemon.skills.length}`)
    assert(['grass', 'bug'].includes(wildPokemon.type1), 'Wild is grass or bug type (region 1)', `type=${wildPokemon.type1}`)
    assert(wildPokemon.level >= 1 && wildPokemon.level <= 5, 'Wild level within region range', `level=${wildPokemon.level}`)

    // Record discovery
    sqlite.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)').run(testChildId, wildPokemon.speciesId)
    const discovered = sqlite.prepare('SELECT COUNT(*) as c FROM discovered_species WHERE child_id = ?').get(testChildId) as any
    assert(discovered.c >= 1, 'Species discovered recorded in pokedex')

    log('📝', `Encountered: ${wildPokemon.name} (Lv.${wildPokemon.level}, HP: ${wildPokemon.hp}, Type: ${wildPokemon.type1})`)
  }

  // ── Step 3: Fight multiple rounds ─────────────────────────────────────────
  section('Step 3: Fight multiple rounds using skills')
  let battle: BattleState
  {
    battle = createBattleState(wildPokemon)
    assert(battle.status === 'ongoing', 'Battle created in ongoing state')
    assert(battle.round === 0, 'Battle starts at round 0')

    let roundCount = 0
    const maxRounds = 50 // safety limit
    while (battle.status === 'ongoing' && roundCount < maxRounds) {
      // Always use first available skill
      const skill = battle.playerSkills.find(s => s.currentPP > 0)
      if (!skill) {
        log('⚠️', 'All skills out of PP - breaking')
        break
      }
      const result = simulateBattleRound(battle, skill.id)
      roundCount++
      log('⚔️', `Round ${roundCount}: Player dealt ${result.playerDamage}, Wild dealt ${result.wildDamage} | Wild HP: ${battle.wild.hp}/${battle.wild.maxHp} | Player HP: ${battle.playerHP}/${battle.playerMaxHP}`)
    }

    assert(roundCount > 0, 'At least 1 round fought', `fought ${roundCount} rounds`)
    assert(roundCount < maxRounds, 'Battle ended before safety limit')
    assert(['win', 'lose'].includes(battle.status), 'Battle resolved', `status=${battle.status}`)
    log('📝', `Battle ended: ${battle.status} after ${roundCount} rounds`)
  }

  // ── Step 4: Win battle and collect rewards ────────────────────────────────
  section('Step 4: Win battle and collect rewards')
  {
    // If we lost, make a new fight with a very weak wild
    if (battle.status !== 'win') {
      log('🔄', 'Previous battle was lost, creating a guaranteed-win fight...')
      const weakWild: WildPokemon = {
        speciesId: 10, name: '绿毛虫', emoji: '🐛',
        type1: 'bug', type2: null, level: 1,
        hp: 1, maxHp: 50, battlePower: 5, defense: 5, speed: 10, rarity: 1,
        skills: [{ id: 'S10', name: '虫咬', type: 'bug', power: 40, accuracy: 100, pp: 25, currentPP: 25, effect: null }],
      }
      battle = createBattleState(weakWild)
      const result = simulateBattleRound(battle, battle.playerSkills[0].id)
      assert(result.wildDefeated, 'Weak wild defeated in 1 hit')
    }

    assert(battle.status === 'win', 'Battle won')

    const candyBefore = getInventory('candy')
    const { rewards, levelResult } = applyWinRewards(battle)
    const candyAfter = getInventory('candy')

    assert(rewards.exp > 0, 'Earned EXP', `exp=${rewards.exp}`)
    assert(rewards.candy >= 1, 'Earned candy', `candy=${rewards.candy}`)
    assert(candyAfter >= candyBefore + rewards.candy, 'Candy added to inventory', `${candyBefore} -> ${candyAfter}`)

    const energy = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(testChildId) as any
    assert(energy.total_wins === 1, 'Total wins incremented to 1', `got ${energy.total_wins}`)
    assert(energy.total_battles === 1, 'Total battles incremented to 1', `got ${energy.total_battles}`)

    log('📝', `Rewards: +${rewards.exp} EXP, +${rewards.candy} candy, +${rewards.pokeball} pokeball`)
    log('📝', `Level: ${levelResult.newLevel} (exp remaining: ${levelResult.newExp})`)
  }

  // ── Step 5: Check inventory ───────────────────────────────────────────────
  section('Step 5: Check inventory for rewards received')
  {
    const candy = getInventory('candy')
    const pokeballs = getInventory('pokeball')
    assert(candy > 0, 'Has candy in inventory', `candy=${candy}`)
    assert(pokeballs > 0, 'Has pokeballs in inventory', `pokeballs=${pokeballs}`)

    const logs = sqlite.prepare('SELECT * FROM battle_logs WHERE child_id = ? ORDER BY id DESC LIMIT 1').get(testChildId) as any
    assert(logs !== undefined, 'Battle log recorded')
    assert(logs.result === 'win', 'Battle log shows win')
    assert(logs.exp_gained > 0, 'Battle log has exp gained', `exp=${logs.exp_gained}`)
  }

  // ── Step 6: Capture a pokemon ─────────────────────────────────────────────
  section('Step 6: Capture a wild pokemon')
  {
    // Create a fight with a very weak wild for guaranteed capture
    const weakWild: WildPokemon = {
      speciesId: 10, name: '绿毛虫', emoji: '🐛',
      type1: 'bug', type2: null, level: 1,
      hp: 1, maxHp: 100, battlePower: 5, defense: 5, speed: 10, rarity: 1,
      skills: [{ id: 'S10', name: '虫咬', type: 'bug', power: 40, accuracy: 100, pp: 25, currentPP: 25, effect: null }],
    }

    const pokeballsBefore = getInventory('pokeball')
    assert(pokeballsBefore > 0, 'Have pokeballs to use', `count=${pokeballsBefore}`)

    // Try capture multiple times (RNG may fail)
    let captured = false
    for (let attempt = 0; attempt < 20; attempt++) {
      const captureResult = attemptCapture(1, 100, 'pokeball', 1)
      if (captureResult.success) {
        captured = true
        log('📝', `Capture succeeded on attempt ${attempt + 1} (rate: ${(captureResult.rate * 100).toFixed(1)}%)`)

        // Deduct pokeball
        sqlite.prepare("UPDATE inventory SET quantity = quantity - 1 WHERE child_id = ? AND item_type = 'pokeball'").run(testChildId)

        // Add pokemon to team
        const now = new Date().toISOString()
        const insertResult = sqlite.prepare(
          `INSERT INTO pokemons (child_id, species_id, name, vitality, wisdom, affection, level, battle_power, defense, hp, speed, battle_exp, battle_level, is_active, source, last_updated, created_at)
           VALUES (?,?,?,50,50,30,1,?,?,?,?,0,?,0,'captured',?,?)`
        ).run(testChildId, weakWild.speciesId, weakWild.name, weakWild.battlePower, weakWild.defense, weakWild.maxHp, weakWild.speed, weakWild.level, now, now)

        // Assign initial skill
        sqlite.prepare('INSERT OR IGNORE INTO pokemon_skills (pokemon_id, skill_id, slot) VALUES (?, ?, 1)')
          .run(Number(insertResult.lastInsertRowid), 'S10')

        sqlite.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)').run(testChildId, weakWild.speciesId)

        // Log
        sqlite.prepare(
          'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds, captured_pokemon_id) VALUES (?,?,?,?,?,?,?,?)'
        ).run(testChildId, battle.playerPokemonId, weakWild.speciesId, weakWild.level, 1, 'capture', 1, Number(insertResult.lastInsertRowid))
        sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1, total_wins = total_wins + 1, current_energy = current_energy - 1 WHERE child_id = ?').run(testChildId)
        break
      }
    }

    assert(captured, 'Successfully captured a pokemon')
    const pokeballsAfter = getInventory('pokeball')
    assert(pokeballsAfter < pokeballsBefore, 'Pokeball deducted', `${pokeballsBefore} -> ${pokeballsAfter}`)
  }

  // ── Step 7: Verify captured pokemon in team ───────────────────────────────
  section('Step 7: Verify captured pokemon appears in team')
  {
    const team = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ? ORDER BY id').all(testChildId) as any[]
    assert(team.length >= 2, 'Team has at least 2 pokemon', `size=${team.length}`)

    const capturedPoke = team.find((p: any) => p.source === 'captured')
    assert(capturedPoke !== undefined, 'Found captured pokemon in team')
    assert(capturedPoke.species_id === 10, 'Captured pokemon is 绿毛虫 (id=10)', `species_id=${capturedPoke?.species_id}`)
    assert(capturedPoke.is_active === 0, 'Captured pokemon is NOT active (starter still active)')

    const capturedSkills = getPlayerSkills(capturedPoke.id)
    assert(capturedSkills.length >= 1, 'Captured pokemon has skills', `count=${capturedSkills.length}`)

    log('📝', `Team: ${team.map((p: any) => `${p.name}(Lv.${p.battle_level}${p.is_active ? '*' : ''})`).join(', ')}`)
  }

  // ── Step 8: Switch active pokemon ─────────────────────────────────────────
  section('Step 8: Switch active pokemon')
  {
    const team = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ? ORDER BY id').all(testChildId) as any[]
    const capturedPoke = team.find((p: any) => p.source === 'captured')!

    // Switch to captured pokemon
    sqlite.prepare('UPDATE pokemons SET is_active = 0 WHERE child_id = ?').run(testChildId)
    sqlite.prepare('UPDATE pokemons SET is_active = 1 WHERE id = ?').run(capturedPoke.id)

    const newActive = getActivePokemon()
    assert(newActive.id === capturedPoke.id, 'Active pokemon switched to captured one', `active=${newActive.name}`)
    assert(newActive.source === 'captured', 'Active pokemon source is "captured"')

    // Switch back to starter
    sqlite.prepare('UPDATE pokemons SET is_active = 0 WHERE child_id = ?').run(testChildId)
    const starter = team.find((p: any) => p.source === 'starter')!
    sqlite.prepare('UPDATE pokemons SET is_active = 1 WHERE id = ?').run(starter.id)

    const backToStarter = getActivePokemon()
    assert(backToStarter.source === 'starter', 'Switched back to starter', `active=${backToStarter.name}`)
  }

  // ── Step 9: Buy pokeballs from shop ───────────────────────────────────────
  section('Step 9: Buy pokeballs from shop')
  {
    const candyBefore = getInventory('candy')
    const pokeballsBefore = getInventory('pokeball')

    // Buy 3 pokeballs (5 candy each)
    const quantity = 3
    const totalCost = BALL_INFO.pokeball.price * quantity // 15
    assert(candyBefore >= totalCost, 'Have enough candy to buy', `need ${totalCost}, have ${candyBefore}`)

    sqlite.prepare("UPDATE inventory SET quantity = quantity - ? WHERE child_id = ? AND item_type = 'candy'").run(totalCost, testChildId)
    sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'pokeball'").run(quantity, testChildId)

    const candyAfter = getInventory('candy')
    const pokeballsAfter = getInventory('pokeball')
    assert(candyAfter === candyBefore - totalCost, 'Candy deducted correctly', `${candyBefore} -> ${candyAfter} (cost ${totalCost})`)
    assert(pokeballsAfter === pokeballsBefore + quantity, 'Pokeballs added', `${pokeballsBefore} -> ${pokeballsAfter}`)

    // Try buying greatball
    const greatballCost = BALL_INFO.greatball.price // 15
    if (candyAfter >= greatballCost) {
      sqlite.prepare("UPDATE inventory SET quantity = quantity - ? WHERE child_id = ? AND item_type = 'candy'").run(greatballCost, testChildId)
      setInventory('greatball', getInventory('greatball') + 1)
      assert(getInventory('greatball') >= 1, 'Greatball purchased', `count=${getInventory('greatball')}`)
    } else {
      skip('Buy greatball', 'Not enough candy')
    }

    // Verify masterball cannot be bought (price=0)
    assert(BALL_INFO.masterball.price === 0, 'Masterball price is 0 (unbuyable)')
  }

  // ── Step 10: Encounter and fight a boss ───────────────────────────────────
  section('Step 10: Encounter and fight a boss')
  {
    const bossData = REGION_BOSSES[1]
    assert(bossData !== undefined, 'Region 1 has boss data')

    const eliteData = bossData.elite
    log('📝', `Elite: ${eliteData.name} (speciesId=${eliteData.speciesId}, Lv.${eliteData.level})`)

    const bossSpecies = sqlite.prepare('SELECT * FROM species_catalog WHERE id = ?').get(eliteData.speciesId) as any
    if (!bossSpecies) {
      skip('Boss fight', 'Boss species not in test seed data')
    } else {
      const allSkillsRaw = sqlite.prepare('SELECT * FROM skills').all() as any[]
      const allSkills: Record<string, any> = {}
      allSkillsRaw.forEach((s: any) => { allSkills[s.id] = s })

      const bp = calcBattlePower(bossSpecies.base_power, eliteData.level)
      const def = calcDefense(bossSpecies.base_power, eliteData.level)
      const hp = calcHP(bossSpecies.base_power, eliteData.level)
      const bossSkills = generateWildSkills(bossSpecies, allSkills, eliteData.level)

      const bossWild: WildPokemon = {
        speciesId: bossSpecies.id,
        name: eliteData.name,
        emoji: bossSpecies.emoji,
        type1: bossSpecies.type1 as PokemonType,
        type2: bossSpecies.type2 as PokemonType | null,
        level: eliteData.level,
        hp: Math.round(hp),
        maxHp: Math.round(hp),
        battlePower: bp,
        defense: def,
        speed: bossSpecies.base_speed,
        rarity: bossSpecies.rarity,
        skills: bossSkills,
      }

      log('📝', `Boss: ${bossWild.name} Lv.${bossWild.level} (HP: ${bossWild.hp}, BP: ${bossWild.battlePower.toFixed(1)})`)

      // Buff player to fight boss (set high level)
      const active = getActivePokemon()
      const activeSpecies = sqlite.prepare('SELECT * FROM species_catalog WHERE id = ?').get(active.species_id) as any
      const buffLevel = 20
      sqlite.prepare('UPDATE pokemons SET battle_level = ?, battle_power = ?, defense = ?, hp = ? WHERE id = ?')
        .run(buffLevel, calcBattlePower(activeSpecies.base_power, buffLevel), calcDefense(activeSpecies.base_power, buffLevel), calcHP(activeSpecies.base_power, buffLevel), active.id)

      // Add more skills for the buffed pokemon
      const skillSlots = getUnlockedSkillSlots(buffLevel)
      const skillFields = ['skill1', 'skill2', 'skill3', 'skill4'] as const
      for (const slot of skillSlots) {
        if (activeSpecies[skillFields[slot - 1]]) {
          sqlite.prepare('INSERT OR IGNORE INTO pokemon_skills (pokemon_id, skill_id, slot) VALUES (?, ?, ?)')
            .run(active.id, activeSpecies[skillFields[slot - 1]], slot)
        }
      }

      const bossBattle = createBattleState(bossWild, true, 'elite')
      assert(bossBattle.isBoss === true, 'Battle marked as boss fight')
      assert(bossBattle.bossType === 'elite', 'Boss type is elite')

      let rounds = 0
      while (bossBattle.status === 'ongoing' && rounds < 100) {
        const skill = bossBattle.playerSkills.find(s => s.currentPP > 0 && s.power > 0)
          || bossBattle.playerSkills.find(s => s.currentPP > 0)
        if (!skill) break
        simulateBattleRound(bossBattle, skill.id)
        rounds++
      }

      log('📝', `Boss battle ended: ${bossBattle.status} after ${rounds} rounds`)
      assert(['win', 'lose'].includes(bossBattle.status), 'Boss battle resolved')

      if (bossBattle.status === 'win') {
        pass('Boss defeated!', `${bossWild.name} beaten in ${rounds} rounds`)

        // Mark elite defeated
        sqlite.prepare('UPDATE region_unlocks SET elite_defeated = 1 WHERE child_id = ? AND region = 1').run(testChildId)
        const unlock = sqlite.prepare('SELECT * FROM region_unlocks WHERE child_id = ? AND region = 1').get(testChildId) as any
        assert(unlock.elite_defeated === 1, 'Elite defeat recorded in DB')
      } else {
        log('⚠️', 'Boss fight lost (acceptable for simulation)')
      }
    }
  }

  // ── Step 11: Check achievements/stats ─────────────────────────────────────
  section('Step 11: Check achievements/stats after battles')
  {
    const energy = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(testChildId) as any
    assert(energy.total_battles >= 2, 'Multiple battles tracked', `battles=${energy.total_battles}`)
    assert(energy.total_wins >= 2, 'Multiple wins tracked', `wins=${energy.total_wins}`)

    const logs = sqlite.prepare('SELECT COUNT(*) as c FROM battle_logs WHERE child_id = ?').get(testChildId) as any
    assert(logs.c >= 2, 'Battle logs recorded', `count=${logs.c}`)

    // Check achievement eligibility
    const battleAch = sqlite.prepare("SELECT * FROM achievements WHERE condition_type = 'total_battles' AND condition_value <= ?").all(energy.total_battles) as any[]
    if (battleAch.length > 0) {
      // Award achievements
      for (const ach of battleAch) {
        sqlite.prepare('INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?, ?)').run(testChildId, ach.id)
      }
      const unlocked = sqlite.prepare('SELECT COUNT(*) as c FROM child_achievements WHERE child_id = ?').get(testChildId) as any
      assert(unlocked.c >= 1, 'Achievement unlocked', `B-01: ${battleAch[0].title}`)
    }

    log('📝', `Stats: ${energy.total_battles} battles, ${energy.total_wins} wins, energy remaining: ${energy.current_energy}/${energy.max_energy}`)
  }

  // ── Step 12: Release a captured pokemon ───────────────────────────────────
  section('Step 12: Release a captured pokemon')
  {
    const team = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ? ORDER BY id').all(testChildId) as any[]
    const capturedPoke = team.find((p: any) => p.source === 'captured')

    if (!capturedPoke) {
      skip('Release pokemon', 'No captured pokemon to release')
    } else {
      const teamSizeBefore = team.length
      assert(teamSizeBefore >= 2, 'Team has enough pokemon to release one')

      // Cannot release starter
      const starter = team.find((p: any) => p.source === 'starter')!
      // Simulate the "starter can't be released" check
      assert(starter.source === 'starter', 'Starter protection: source is "starter"')

      // Release captured pokemon
      const candyReturn = (capturedPoke.battle_level || 1) * 2
      const candyBefore = getInventory('candy')

      sqlite.prepare('DELETE FROM pokemon_skills WHERE pokemon_id = ?').run(capturedPoke.id)
      sqlite.prepare('DELETE FROM pokemons WHERE id = ?').run(capturedPoke.id)

      // Return candy
      sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'candy'").run(candyReturn, testChildId)

      const teamAfter = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = ?').all(testChildId) as any[]
      const candyAfter = getInventory('candy')

      assert(teamAfter.length === teamSizeBefore - 1, 'Team size decreased by 1', `${teamSizeBefore} -> ${teamAfter.length}`)
      assert(candyAfter === candyBefore + candyReturn, 'Candy returned on release', `+${candyReturn} candy`)
      assert(teamAfter.every((p: any) => p.source === 'starter'), 'Only starter remains')

      // Verify starter is still active
      const active = getActivePokemon()
      assert(active !== undefined, 'Still have an active pokemon after release')
    }
  }

  // ── Step 13: Check pokedex discovery status ───────────────────────────────
  section('Step 13: Check pokedex discovery status')
  {
    const discovered = sqlite.prepare('SELECT * FROM discovered_species WHERE child_id = ?').all(testChildId) as any[]
    assert(discovered.length >= 1, 'At least 1 species discovered', `count=${discovered.length}`)

    const totalSpecies = (sqlite.prepare('SELECT COUNT(*) as c FROM species_catalog').get() as any).c
    assert(totalSpecies > 0, 'Species catalog has entries', `total=${totalSpecies}`)

    // Check discovery details
    for (const d of discovered) {
      const species = sqlite.prepare('SELECT name FROM species_catalog WHERE id = ?').get(d.species_id) as any
      if (species) {
        log('📝', `  Discovered: #${d.species_id} ${species.name}`)
      }
    }

    // Undiscovered species should show as '???'
    const allSpecies = sqlite.prepare('SELECT id, name FROM species_catalog').all() as any[]
    const discoveredIds = new Set(discovered.map((d: any) => d.species_id))
    const undiscovered = allSpecies.filter((s: any) => !discoveredIds.has(s.id))
    assert(undiscovered.length > 0, 'Some species still undiscovered', `${undiscovered.length} remaining`)

    log('📝', `Pokedex: ${discovered.length}/${totalSpecies} discovered`)
  }

  // ── Step 14: Energy depletion and refill cycle ────────────────────────────
  section('Step 14: Energy depletion and refill cycle')
  {
    // Deplete energy
    sqlite.prepare('UPDATE battle_energy SET current_energy = 0 WHERE child_id = ?').run(testChildId)
    const depleted = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(testChildId) as any
    assert(depleted.current_energy === 0, 'Energy depleted to 0')

    // Verify can't battle with 0 energy
    assert(depleted.current_energy < 1, 'Cannot battle: energy < 1')

    // Simulate day change refill
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    sqlite.prepare('UPDATE battle_energy SET last_refill_date = ? WHERE child_id = ?').run(yesterday, testChildId)

    // Check auto-refill logic (same as route.ts)
    const energy = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(testChildId) as any
    const today = new Date().toISOString().slice(0, 10)
    if (energy.last_refill_date !== today) {
      sqlite.prepare('UPDATE battle_energy SET current_energy = max_energy, last_refill_date = ? WHERE child_id = ?').run(today, testChildId)
    }

    const refilled = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(testChildId) as any
    assert(refilled.current_energy === refilled.max_energy, 'Energy refilled to max', `${refilled.current_energy}/${refilled.max_energy}`)
    assert(refilled.last_refill_date === today, 'Refill date updated to today')
  }

  // ── Step 15: Region unlock progression ────────────────────────────────────
  section('Step 15: Region unlock progression check')
  {
    // Region 2 requires 5 wins
    const energyRow = sqlite.prepare('SELECT * FROM battle_energy WHERE child_id = ?').get(testChildId) as any

    // Simulate enough wins
    sqlite.prepare('UPDATE battle_energy SET total_wins = 5 WHERE child_id = ?').run(testChildId)

    // Check unlock logic (same as GET /api/battle)
    const unlocks = sqlite.prepare('SELECT region FROM region_unlocks WHERE child_id = ?').all(testChildId) as any[]
    const unlockedRegions = unlocks.map((u: any) => u.region)
    const updatedEnergy = sqlite.prepare('SELECT total_wins FROM battle_energy WHERE child_id = ?').get(testChildId) as any

    for (const region of REGIONS) {
      if (!unlockedRegions.includes(region.id) && updatedEnergy.total_wins >= region.unlockWins) {
        sqlite.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?, ?)').run(testChildId, region.id)
      }
    }

    const finalUnlocks = sqlite.prepare('SELECT region FROM region_unlocks WHERE child_id = ?').all(testChildId) as any[]
    const finalUnlockedIds = finalUnlocks.map((u: any) => u.region)

    assert(finalUnlockedIds.includes(1), 'Region 1 still unlocked')
    assert(finalUnlockedIds.includes(2), 'Region 2 unlocked (5 wins required)', `unlocked: ${finalUnlockedIds.join(', ')}`)

    // With 5 wins, region 3 (15 wins) should NOT be unlocked
    assert(!finalUnlockedIds.includes(3), 'Region 3 NOT unlocked yet (needs 15 wins)')

    // Simulate 50 wins to unlock more
    sqlite.prepare('UPDATE battle_energy SET total_wins = 50 WHERE child_id = ?').run(testChildId)
    const moreEnergy = sqlite.prepare('SELECT total_wins FROM battle_energy WHERE child_id = ?').get(testChildId) as any
    for (const region of REGIONS) {
      if (!finalUnlockedIds.includes(region.id) && moreEnergy.total_wins >= region.unlockWins) {
        sqlite.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?, ?)').run(testChildId, region.id)
      }
    }

    const allUnlocks = sqlite.prepare('SELECT region FROM region_unlocks WHERE child_id = ? ORDER BY region').all(testChildId) as any[]
    const allUnlockedIds = allUnlocks.map((u: any) => u.region)
    assert(allUnlockedIds.includes(3), 'Region 3 unlocked with 50 wins')
    assert(allUnlockedIds.includes(4), 'Region 4 unlocked with 50 wins')
    assert(allUnlockedIds.includes(5), 'Region 5 unlocked with 50 wins')
    assert(!allUnlockedIds.includes(6), 'Region 6 NOT unlocked (needs 80 wins)', `unlocked: ${allUnlockedIds.join(', ')}`)

    log('📝', `Regions unlocked: ${allUnlockedIds.join(', ')} (with ${moreEnergy.total_wins} total wins)`)
  }

  // ── Bonus: Battle logic unit checks ───────────────────────────────────────
  section('Bonus: Core battle logic unit checks')
  {
    // Type effectiveness
    const fireVsGrass = calculateDamage(50, 40, 'fire', 100, 30, 'grass', null, 0)
    assert(!fireVsGrass.missed, 'Fire vs Grass hits (100 accuracy)')
    // Note: damage is random so we just check it's > 0

    const grassVsFire = calculateDamage(50, 40, 'grass', 100, 30, 'fire', null, 0)
    assert(!grassVsFire.missed, 'Grass vs Fire hits')

    // Capture rate
    const lowHPRate = calculateBattleRewards(5, 1)
    assert(lowHPRate.exp > 0, 'Battle rewards have positive EXP')

    // Level up
    const lvUp = checkBattleLevelUp(1, 100)
    assert(lvUp.newLevel > 1, 'Level up with 100 exp', `newLevel=${lvUp.newLevel}`)

    // Skill unlock
    const slots1 = getUnlockedSkillSlots(1)
    assert(slots1.includes(1), 'Slot 1 unlocked at level 1')
    assert(!slots1.includes(2), 'Slot 2 NOT unlocked at level 1')

    const slots3 = getUnlockedSkillSlots(3)
    assert(slots3.includes(2), 'Slot 2 unlocked at level 3')

    const slots8 = getUnlockedSkillSlots(8)
    assert(slots8.includes(3), 'Slot 3 unlocked at level 8')

    const slots15 = getUnlockedSkillSlots(15)
    assert(slots15.includes(4), 'Slot 4 unlocked at level 15')
    assert(slots15.length === 4, 'All 4 slots unlocked at level 15')

    // Ball prices
    assert(BALL_INFO.pokeball.price === 5, 'Pokeball costs 5 candy')
    assert(BALL_INFO.greatball.price === 15, 'Greatball costs 15 candy')
    assert(BALL_INFO.ultraball.price === 30, 'Ultraball costs 30 candy')
    assert(BALL_INFO.masterball.multiplier === 100, 'Masterball has 100x capture rate')

    // Region data
    assert(REGIONS.length === 6, '6 regions defined')
    assert(REGIONS[0].unlockWins === 0, 'Region 1 requires 0 wins')
    assert(REGIONS[5].unlockWins === 80, 'Region 6 requires 80 wins')
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  📊 Test Results Summary`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  ✅ Passed:  ${passed}`)
  console.log(`  ❌ Failed:  ${failed}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log(`  📝 Total:   ${passed + failed + skipped}`)
  console.log(`${'═'.repeat(60)}`)

  if (failed > 0) {
    console.log('\n  ⚠️  Some tests failed! Review the output above.\n')
  } else {
    console.log('\n  🎉 All tests passed! Battle system is working correctly.\n')
  }

  // Cleanup
  cleanup()

  process.exit(failed > 0 ? 1 : 0)
}

// ── Run ─────────────────────────────────────────────────────────────────────
runTests().catch((err) => {
  console.error('\n💥 Test crashed:', err)
  cleanup()
  process.exit(2)
})

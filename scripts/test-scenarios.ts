#!/usr/bin/env tsx
/**
 * 测试场景切换脚本
 * 快速创建不同阶段的测试数据，用于测试各功能模块
 *
 * Usage:
 *   npx tsx scripts/test-scenarios.ts <scenario>
 *   npx tsx scripts/test-scenarios.ts --list
 *   npx tsx scripts/test-scenarios.ts --clean
 *
 * Login:
 *   家长: 测试家长 / 123456
 *   孩子: 测试宝贝 / 123456
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'pokemon.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Password hash (matches lib/auth.ts hashPassword) ──────────────────────

function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

// ── Battle stat formulas (matches lib/battle-logic.ts) ────────────────────

function calcBP(basePower: number, battleLevel: number) {
  return Math.round(basePower * (1 + (battleLevel - 1) * 0.08) * 10) / 10
}
function calcDef(basePower: number, battleLevel: number) {
  return Math.round(basePower * 0.8 * (1 + (battleLevel - 1) * 0.06) * 10) / 10
}
function calcHP(basePower: number, battleLevel: number) {
  return Math.round(basePower * 3 * (1 + (battleLevel - 1) * 0.1) * 10) / 10
}

const SKILL_UNLOCK: Record<number, number> = { 1: 1, 2: 3, 3: 8, 4: 15 }
const now = new Date().toISOString()
const today = now.slice(0, 10)

// ── Helpers ───────────────────────────────────────────────────────────────

function getSpecies(id: number) {
  return db.prepare('SELECT * FROM species_catalog WHERE id = ?').get(id) as any
}

function createPokemon(childId: number, speciesId: number, opts: {
  name?: string; battleLevel?: number; level?: number; stage?: number
  vitality?: number; wisdom?: number; affection?: number
  isActive?: boolean; streakDays?: number; source?: string
} = {}) {
  const sp = getSpecies(speciesId)
  if (!sp) throw new Error(`Species ${speciesId} not found`)
  const bl = opts.battleLevel ?? 1
  const bp = calcBP(sp.base_power, bl)
  const def = calcDef(sp.base_power, bl)
  const hp = calcHP(sp.base_power, bl)

  const result = db.prepare(`
    INSERT INTO pokemons (child_id, species_id, name, vitality, wisdom, affection,
      level, battle_level, battle_exp, battle_power, defense, hp, speed,
      evolution_stage, is_active, source, streak_days, max_streak,
      last_updated, created_at)
    VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
  `).run(
    childId, speciesId, opts.name ?? sp.name,
    opts.vitality ?? 60, opts.wisdom ?? 60, opts.affection ?? 60,
    opts.level ?? bl, bl, bp, def, hp, sp.base_speed,
    opts.stage ?? 1, opts.isActive ? 1 : 0,
    opts.source ?? 'starter', opts.streakDays ?? 0, opts.streakDays ?? 0
  )

  const pokemonId = result.lastInsertRowid as number

  // Assign skills based on battle level
  const slots = [sp.skill1, sp.skill2, sp.skill3, sp.skill4]
  for (let slot = 1; slot <= 4; slot++) {
    if (bl >= SKILL_UNLOCK[slot] && slots[slot - 1]) {
      const skillPP = (db.prepare('SELECT pp FROM skills WHERE id = ?').get(slots[slot - 1]) as any)?.pp ?? 20
      db.prepare('INSERT INTO pokemon_skills (pokemon_id, skill_id, slot, current_pp) VALUES (?,?,?,?)')
        .run(pokemonId, slots[slot - 1], slot, skillPP)
    }
  }

  // Record discovered species
  db.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?,?)').run(childId, speciesId)

  return pokemonId
}

function addInventory(childId: number, itemType: string, quantity: number) {
  const existing = db.prepare('SELECT id FROM inventory WHERE child_id = ? AND item_type = ?').get(childId, itemType) as any
  if (existing) {
    db.prepare('UPDATE inventory SET quantity = ? WHERE id = ?').run(quantity, existing.id)
  } else {
    db.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?,?,?)').run(childId, itemType, quantity)
  }
}

function addTask(familyId: number, createdBy: number, opts: {
  title: string; subject: string; difficulty?: number; status?: string; daysAgo?: number
}) {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() - (opts.daysAgo ?? 0))
  const result = db.prepare(`
    INSERT INTO tasks (family_id, created_by, title, subject, description, difficulty, status, due_date, last_updated, created_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
  `).run(familyId, createdBy, opts.title, opts.subject, `${opts.title}的详细说明`,
    opts.difficulty ?? 3, opts.status ?? 'pending', dueDate.toISOString().slice(0, 10))
  return result.lastInsertRowid as number
}

function addSubmission(taskId: number, childId: number, status: string, comment?: string) {
  db.prepare(`
    INSERT INTO submissions (task_id, child_id, review_status, review_comment, quality_score, submitted_at)
    VALUES (?,?,?,?,?,datetime('now'))
  `).run(taskId, childId, status, comment ?? null, status === 'approved' ? 5 : status === 'partial' ? 3 : null)
}

// ── Clean all user data ───────────────────────────────────────────────────

function cleanAll() {
  const tables = [
    'pokemon_skills', 'battle_logs', 'battle_energy', 'region_unlocks',
    'evolution_history', 'discovered_species', 'pokemons', 'submissions',
    'tasks', 'inventory', 'child_achievements', 'house_items',
    'notifications', 'pokemon_letters', 'weekend_challenges', 'session_logs',
    'honor_records', 'daily_plans', 'onboarding', 'family_settings', 'users'
  ]
  for (const t of tables) {
    db.prepare(`DELETE FROM ${t}`).run()
  }
  // Reset autoincrement
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users','pokemons','tasks','submissions','inventory')").run()
}

// ── Base setup (every scenario needs this) ────────────────────────────────

function setupBase(): { parentId: number; childId: number; familyId: number } {
  const familyId = 1
  const pwHash = hashPassword('123456')

  const p = db.prepare('INSERT INTO users (name, role, family_id, password_hash) VALUES (?,?,?,?)')
    .run('测试家长', 'parent', familyId, pwHash)
  const parentId = p.lastInsertRowid as number

  const c = db.prepare('INSERT INTO users (name, role, family_id, password_hash) VALUES (?,?,?,?)')
    .run('测试宝贝', 'child', familyId, pwHash)
  const childId = c.lastInsertRowid as number

  // Onboarding completed
  db.prepare('INSERT INTO onboarding (user_id, completed, current_step) VALUES (?,1,99)').run(parentId)
  db.prepare('INSERT INTO onboarding (user_id, completed, current_step) VALUES (?,1,99)').run(childId)

  // Family settings
  db.prepare('INSERT OR IGNORE INTO family_settings (family_id) VALUES (?)').run(familyId)

  // Battle energy
  db.prepare('INSERT INTO battle_energy (child_id, current_energy, max_energy, last_refill_date) VALUES (?,5,5,?)').run(childId, today)

  // Region 1 unlocked by default
  db.prepare('INSERT INTO region_unlocks (child_id, region) VALUES (?,1)').run(childId)

  return { parentId, childId, familyId }
}

// ══════════════════════════════════════════════════════════════════════════
// SCENARIOS
// ══════════════════════════════════════════════════════════════════════════

const SCENARIOS: Record<string, { desc: string; setup: () => void }> = {

  // ── fresh: 全新家庭 ─────────────────────────────────────────────────────
  fresh: {
    desc: '全新家庭（刚注册+引导完成），1只皮卡丘，少量道具',
    setup() {
      const { childId } = setupBase()
      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 1, isActive: true })
      addInventory(childId, 'food', 5)
      addInventory(childId, 'candy', 3)
      addInventory(childId, 'pokeball', 3)
    }
  },

  // ── tasks: 任务管理测试 ─────────────────────────────────────────────────
  tasks: {
    desc: '10个不同状态的任务，用于测试家长审核、孩子提交、任务列表',
    setup() {
      const { parentId, childId, familyId } = setupBase()
      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 1, isActive: true })
      addInventory(childId, 'food', 10)
      addInventory(childId, 'candy', 10)

      // pending tasks (3)
      addTask(familyId, parentId, { title: '背诵古诗三首', subject: 'chinese', difficulty: 2, status: 'pending' })
      addTask(familyId, parentId, { title: '完成数学练习册P20-P22', subject: 'math', difficulty: 4, status: 'pending' })
      addTask(familyId, parentId, { title: '英语单词听写', subject: 'english', difficulty: 2, status: 'pending' })

      // submitted tasks (2) - 待审核
      const t4 = addTask(familyId, parentId, { title: '写一篇日记(200字)', subject: 'chinese', difficulty: 3, status: 'submitted', daysAgo: 1 })
      addSubmission(t4, childId, 'pending')
      const t5 = addTask(familyId, parentId, { title: '做科学实验报告', subject: 'science', difficulty: 4, status: 'submitted', daysAgo: 1 })
      addSubmission(t5, childId, 'pending')

      // approved tasks (2) - 已通过
      const t6 = addTask(familyId, parentId, { title: '阅读《西游记》第3章', subject: 'chinese', difficulty: 2, status: 'approved', daysAgo: 3 })
      addSubmission(t6, childId, 'approved', '读得很认真，理解到位！')
      const t7 = addTask(familyId, parentId, { title: '完成口算100题', subject: 'math', difficulty: 3, status: 'approved', daysAgo: 2 })
      addSubmission(t7, childId, 'approved', '正确率95%，非常棒！')

      // rejected task (1)
      const t8 = addTask(familyId, parentId, { title: '英语作文：My Family', subject: 'english', difficulty: 4, status: 'rejected', daysAgo: 2 })
      addSubmission(t8, childId, 'rejected', '内容太少了，请补充更多细节')

      // partial tasks (2)
      const t9 = addTask(familyId, parentId, { title: '练习钢笔字帖2页', subject: 'chinese', difficulty: 2, status: 'partial', daysAgo: 4 })
      addSubmission(t9, childId, 'partial', '字迹有进步，但部分笔画还需注意')
      const t10 = addTask(familyId, parentId, { title: '画一幅风景画', subject: 'other', difficulty: 3, status: 'partial', daysAgo: 3 })
      addSubmission(t10, childId, 'partial', '构图不错，颜色搭配再改进一下')
    }
  },

  // ── pokemon-care: 宝可梦养成测试 ───────────────────────────────────────
  'pokemon-care': {
    desc: '宝可梦养成测试（喂食/状态/打卡），丰富道具库存',
    setup() {
      const { parentId, childId, familyId } = setupBase()
      createPokemon(childId, 1, { // 妙蛙种子
        name: '小绿', battleLevel: 3, vitality: 40, wisdom: 70, affection: 55,
        isActive: true, streakDays: 3,
      })
      addInventory(childId, 'food', 20)
      addInventory(childId, 'candy', 30)
      addInventory(childId, 'crystal', 15)
      addInventory(childId, 'fragment', 10)
      addInventory(childId, 'pokeball', 5)

      // 5个已完成任务
      for (let i = 0; i < 5; i++) {
        const tid = addTask(familyId, parentId, {
          title: `已完成任务${i + 1}`, subject: ['chinese', 'math', 'english', 'science', 'other'][i],
          difficulty: 3, status: 'approved', daysAgo: i + 1
        })
        addSubmission(tid, childId, 'approved', '完成得不错！')
      }
    }
  },

  // ── evolution: 进化测试 ─────────────────────────────────────────────────
  evolution: {
    desc: '3只宝可梦处于不同进化条件，fragment充足',
    setup() {
      const { childId } = setupBase()

      // 小火龙(Lv.10, stage 1) — 刚好达到进化等级 (需要level>=10, fragment>=3)
      createPokemon(childId, 4, { name: '小火龙', battleLevel: 10, level: 10, stage: 1, isActive: true })
      // 妙蛙草(Lv.20, stage 2) — 可二次进化 (需要level>=20, fragment>=5)
      createPokemon(childId, 2, { name: '妙蛙草', battleLevel: 20, level: 20, stage: 2 })
      // 皮卡丘(Lv.3, stage 1) — 不够等级
      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 3, level: 3, stage: 1 })

      addInventory(childId, 'fragment', 50)
      addInventory(childId, 'food', 10)
      addInventory(childId, 'candy', 20)
    }
  },

  // ── battle-early: 战斗初期 ─────────────────────────────────────────────
  'battle-early': {
    desc: '战斗初期，1只Lv.3皮卡丘，区域1已解锁',
    setup() {
      const { childId } = setupBase()

      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 3, isActive: true, source: 'starter' })

      // Update battle energy stats
      db.prepare('UPDATE battle_energy SET total_wins=3, total_battles=5 WHERE child_id=?').run(childId)

      addInventory(childId, 'pokeball', 10)
      addInventory(childId, 'candy', 20)
      addInventory(childId, 'food', 5)

      // Some battle logs
      for (let i = 0; i < 5; i++) {
        db.prepare(`INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds, exp_gained, created_at)
          VALUES (?,1,?,?,1,?,?,?,datetime('now','-${i} hours'))`)
          .run(childId, [10, 43, 69, 10, 1][i], [2, 3, 2, 3, 4][i], i < 3 ? 'win' : 'lose', [4, 5, 3, 6, 5][i], i < 3 ? 14 : 0)
      }
    }
  },

  // ── battle-mid: 战斗中期 ───────────────────────────────────────────────
  'battle-mid': {
    desc: '战斗中期，3只宝可梦，解锁3个区域，击败区域1 Boss',
    setup() {
      const { childId } = setupBase()

      // 喷火龙 (battle_level=12, active) — 3 skills
      createPokemon(childId, 6, { name: '喷火龙', battleLevel: 12, stage: 3, isActive: true, source: 'captured' })
      // 水箭龟 (battle_level=8) — 3 skills
      createPokemon(childId, 9, { name: '水箭龟', battleLevel: 8, stage: 3, source: 'captured' })
      // 皮卡丘 (battle_level=5) — 2 skills
      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 5, source: 'starter' })

      // Battle stats
      db.prepare('UPDATE battle_energy SET total_wins=20, total_battles=35 WHERE child_id=?').run(childId)

      // Unlock regions 1-3, boss defeated in region 1
      db.prepare('UPDATE region_unlocks SET boss_defeated=1 WHERE child_id=? AND region=1').run(childId)
      db.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?,2)').run(childId)
      db.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?,3)').run(childId)

      // Inventory
      addInventory(childId, 'pokeball', 15)
      addInventory(childId, 'greatball', 5)
      addInventory(childId, 'candy', 50)
      addInventory(childId, 'food', 10)
      addInventory(childId, 'fragment', 8)

      // Discovered species
      const discovered = [1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 25, 37, 43, 54, 60]
      for (const sid of discovered) {
        db.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?,?)').run(childId, sid)
      }
    }
  },

  // ── battle-endgame: 战斗后期 ───────────────────────────────────────────
  'battle-endgame': {
    desc: '战斗后期/全通关，5只满技能宝可梦，全区域解锁',
    setup() {
      const { childId } = setupBase()

      // 5只高等级宝可梦
      createPokemon(childId, 6,   { name: '喷火龙', battleLevel: 30, stage: 3, isActive: true, source: 'captured' })
      createPokemon(childId, 9,   { name: '水箭龟', battleLevel: 28, stage: 3, source: 'captured' })
      createPokemon(childId, 3,   { name: '妙蛙花', battleLevel: 25, stage: 3, source: 'captured' })
      createPokemon(childId, 26,  { name: '雷丘', battleLevel: 22, stage: 2, source: 'captured' })
      createPokemon(childId, 131, { name: '拉普拉斯', battleLevel: 20, source: 'captured' })

      // Battle stats
      db.prepare('UPDATE battle_energy SET total_wins=90, total_battles=120 WHERE child_id=?').run(childId)

      // All 6 regions unlocked, boss defeated 1-5
      for (let r = 2; r <= 6; r++) {
        db.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?,?)').run(childId, r)
      }
      for (let r = 1; r <= 5; r++) {
        db.prepare('UPDATE region_unlocks SET boss_defeated=1 WHERE child_id=? AND region=?').run(childId, r)
      }

      // Rich inventory
      addInventory(childId, 'pokeball', 20)
      addInventory(childId, 'greatball', 15)
      addInventory(childId, 'ultraball', 5)
      addInventory(childId, 'masterball', 1)
      addInventory(childId, 'candy', 200)
      addInventory(childId, 'food', 30)
      addInventory(childId, 'crystal', 20)
      addInventory(childId, 'fragment', 30)

      // Many discovered species
      const discovered = [1,2,3,4,5,6,7,8,9,10,11,12,25,26,27,28,35,36,37,38,39,40,43,44,45,
        50,51,54,55,58,59,60,61,62,69,70,71,74,75,76,77,78,81,82,86,87,100,101,120,121,125,131,133]
      for (const sid of discovered) {
        db.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?,?)').run(childId, sid)
      }
    }
  },

  // ── house: 小屋装饰测试 ────────────────────────────────────────────────
  house: {
    desc: '小屋装饰测试，candy充足，已有装饰品',
    setup() {
      const { childId } = setupBase()
      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 5, isActive: true })

      addInventory(childId, 'candy', 500)
      addInventory(childId, 'food', 20)
      addInventory(childId, 'crystal', 10)

      // 购买5个装饰品，3个已放置
      const items = [
        { id: 'F-01', placed: 1, slot: 'furniture-1' },
        { id: 'F-05', placed: 1, slot: 'furniture-2' },
        { id: 'W-01', placed: 1, slot: 'wallpaper-1' },
        { id: 'G-01', placed: 0, slot: null },
        { id: 'T-01', placed: 0, slot: null },
      ]
      for (const item of items) {
        db.prepare('INSERT INTO house_items (child_id, decoration_id, placed, slot) VALUES (?,?,?,?)').run(childId, item.id, item.placed, item.slot)
      }
    }
  },

  // ── achievements: 成就系统测试 ─────────────────────────────────────────
  achievements: {
    desc: '成就系统测试，丰富任务历史，多个已解锁成就',
    setup() {
      const { parentId, childId, familyId } = setupBase()
      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 8, isActive: true, streakDays: 7 })

      addInventory(childId, 'food', 15)
      addInventory(childId, 'candy', 40)
      addInventory(childId, 'pokeball', 8)

      // Battle stats
      db.prepare('UPDATE battle_energy SET total_wins=15, total_battles=25 WHERE child_id=?').run(childId)
      db.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?,2)').run(childId)

      // 20 completed tasks across subjects
      const subjects = ['chinese', 'math', 'english', 'science', 'other']
      for (let i = 0; i < 20; i++) {
        const tid = addTask(familyId, parentId, {
          title: `历史任务${i + 1}`, subject: subjects[i % 5],
          difficulty: (i % 4) + 2, status: 'approved', daysAgo: i + 1,
        })
        addSubmission(tid, childId, 'approved', '完成！')
      }

      // Unlocked achievements
      const achievements = ['H-01', 'H-02', 'H-03', 'P-01', 'B-01']
      for (const achId of achievements) {
        db.prepare('INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?,?)').run(childId, achId)
      }

      // Discovered species
      const discovered = [1, 4, 7, 10, 25, 37, 43, 54, 60, 69, 74, 81, 100]
      for (const sid of discovered) {
        db.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?,?)').run(childId, sid)
      }
    }
  },

  // ── full: 完整丰富数据 ─────────────────────────────────────────────────
  full: {
    desc: '完整丰富数据，所有系统均有数据，适合整体测试',
    setup() {
      const { parentId, childId, familyId } = setupBase()

      // 4只宝可梦
      createPokemon(childId, 6,  { name: '喷火龙', battleLevel: 18, stage: 3, isActive: true, source: 'captured', streakDays: 5 })
      createPokemon(childId, 9,  { name: '水箭龟', battleLevel: 12, stage: 3, source: 'captured' })
      createPokemon(childId, 25, { name: '皮卡丘', battleLevel: 8, source: 'starter' })
      createPokemon(childId, 131,{ name: '拉普拉斯', battleLevel: 6, source: 'captured' })

      // Battle stats
      db.prepare('UPDATE battle_energy SET total_wins=40, total_battles=60 WHERE child_id=?').run(childId)

      // Unlock regions 1-4, boss defeated 1-2
      for (let r = 2; r <= 4; r++) {
        db.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?,?)').run(childId, r)
      }
      db.prepare('UPDATE region_unlocks SET boss_defeated=1 WHERE child_id=? AND region=1').run(childId)
      db.prepare('UPDATE region_unlocks SET boss_defeated=1 WHERE child_id=? AND region=2').run(childId)

      // Rich inventory
      addInventory(childId, 'food', 25)
      addInventory(childId, 'candy', 150)
      addInventory(childId, 'crystal', 15)
      addInventory(childId, 'fragment', 20)
      addInventory(childId, 'pokeball', 12)
      addInventory(childId, 'greatball', 8)
      addInventory(childId, 'ultraball', 2)

      // Mixed tasks
      const taskConfigs = [
        { title: '背诵唐诗5首', subject: 'chinese', difficulty: 3, status: 'pending' },
        { title: '数学应用题', subject: 'math', difficulty: 4, status: 'pending' },
        { title: '英语绘本阅读', subject: 'english', difficulty: 2, status: 'submitted', daysAgo: 0 },
        { title: '科学观察日记', subject: 'science', difficulty: 3, status: 'submitted', daysAgo: 0 },
      ]
      for (const tc of taskConfigs) {
        const tid = addTask(familyId, parentId, tc)
        if (tc.status === 'submitted') addSubmission(tid, childId, 'pending')
      }
      // Completed tasks
      for (let i = 0; i < 15; i++) {
        const subjects = ['chinese', 'math', 'english', 'science', 'other']
        const tid = addTask(familyId, parentId, {
          title: `已完成任务${i + 1}`, subject: subjects[i % 5],
          difficulty: (i % 3) + 2, status: 'approved', daysAgo: i + 1,
        })
        addSubmission(tid, childId, 'approved', '很棒！')
      }

      // Decorations
      const houseItems = [
        { id: 'F-01', placed: 1, slot: 'furniture-1' },
        { id: 'F-04', placed: 1, slot: 'furniture-2' },
        { id: 'W-03', placed: 1, slot: 'wallpaper-1' },
        { id: 'G-02', placed: 1, slot: 'floor-1' },
        { id: 'O-01', placed: 0, slot: null },
        { id: 'T-02', placed: 0, slot: null },
        { id: 'B-02', placed: 1, slot: 'bed-1' },
      ]
      for (const item of houseItems) {
        db.prepare('INSERT INTO house_items (child_id, decoration_id, placed, slot) VALUES (?,?,?,?)').run(childId, item.id, item.placed, item.slot)
      }

      // Achievements
      const achievements = ['H-01', 'H-02', 'H-03', 'H-04', 'P-01', 'P-02', 'B-01', 'B-02', 'S-01']
      for (const achId of achievements) {
        db.prepare('INSERT OR IGNORE INTO child_achievements (child_id, achievement_id) VALUES (?,?)').run(childId, achId)
      }

      // Discovered species
      const discovered = [1,2,3,4,5,6,7,8,9,10,11,12,25,26,37,38,43,44,54,55,58,60,61,69,70,74,75,81,86,100,120,131,133]
      for (const sid of discovered) {
        db.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?,?)').run(childId, sid)
      }

      // Honor records
      db.prepare("INSERT INTO honor_records (child_id, metric, value, period) VALUES (?,?,?,?)").run(childId, 'weekly_tasks', 8, `${today}`)
      db.prepare("INSERT INTO honor_records (child_id, metric, value, period) VALUES (?,?,?,?)").run(childId, 'weekly_streak', 5, `${today}`)
    }
  },
}

// ══════════════════════════════════════════════════════════════════════════
// CLI
// ══════════════════════════════════════════════════════════════════════════

const arg = process.argv[2]

if (!arg || arg === '--help') {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          🎮 宝可梦学习乐园 - 测试场景切换脚本              ║
╚════════════════════════════════════════════════════════════╝

用法: npx tsx scripts/test-scenarios.ts <场景名>

场景列表:
${Object.entries(SCENARIOS).map(([k, v]) => `  ${k.padEnd(18)} ${v.desc}`).join('\n')}

选项:
  --list     列出所有场景
  --clean    仅清空数据（不创建场景）
  --help     显示帮助

登录信息:
  家长: 测试家长 / 123456
  孩子: 测试宝贝 / 123456
`)
  process.exit(0)
}

if (arg === '--list') {
  console.log('\n📋 可用场景:\n')
  for (const [name, { desc }] of Object.entries(SCENARIOS)) {
    console.log(`  ${name.padEnd(18)} ${desc}`)
  }
  console.log()
  process.exit(0)
}

if (arg === '--clean') {
  cleanAll()
  console.log('🧹 已清空所有用户数据（保留技能库和物种图鉴）')
  db.close()
  process.exit(0)
}

const scenario = SCENARIOS[arg]
if (!scenario) {
  console.error(`❌ 未知场景: "${arg}"`)
  console.error(`   可用场景: ${Object.keys(SCENARIOS).join(', ')}`)
  process.exit(1)
}

// Execute
console.log(`\n🔄 切换到场景: ${arg}`)
console.log(`   ${scenario.desc}\n`)

try {
  cleanAll()
  console.log('  ✅ 已清空旧数据')

  scenario.setup()
  console.log('  ✅ 已创建场景数据')

  // Summary
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
  const pokeCount = (db.prepare('SELECT COUNT(*) as c FROM pokemons').get() as any).c
  const taskCount = (db.prepare('SELECT COUNT(*) as c FROM tasks').get() as any).c
  const invCount = (db.prepare('SELECT COUNT(*) as c FROM inventory').get() as any).c

  console.log(`\n📊 数据概览:`)
  console.log(`  👤 用户: ${userCount}`)
  console.log(`  🐾 宝可梦: ${pokeCount}`)
  console.log(`  📚 任务: ${taskCount}`)
  console.log(`  🎒 道具种类: ${invCount}`)
  console.log(`\n🔑 登录信息:`)
  console.log(`  家长: 测试家长 / 123456`)
  console.log(`  孩子: 测试宝贝 / 123456\n`)
} catch (err) {
  console.error('❌ 场景创建失败:', err)
  process.exit(1)
} finally {
  db.close()
}

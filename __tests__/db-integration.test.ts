import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import {
  calculateRewards,
  calculateStatUpdates,
  checkEvolution,
  getEvolutionRequirements,
  POKEMON_NAMES,
} from '@/lib/game-logic'

// We'll use a separate test DB
const TEST_DB_PATH = path.join(process.cwd(), 'test-pokemon.db')

function createTestDb() {
  // Remove old test DB
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)

  const sqlite = new Database(TEST_DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      family_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      password_hash TEXT,
      avatar TEXT
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
      max_streak INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      difficulty INTEGER NOT NULL DEFAULT 3,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_weekend_challenge INTEGER NOT NULL DEFAULT 0,
      task_type TEXT NOT NULL DEFAULT 'regular'
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      review_status TEXT NOT NULL DEFAULT 'pending',
      review_comment TEXT,
      quality_score INTEGER,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discovered_species (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      species_id INTEGER NOT NULL,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(child_id, species_id)
    );

    CREATE TABLE IF NOT EXISTS evolution_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      from_species_id INTEGER NOT NULL,
      to_species_id INTEGER NOT NULL,
      from_stage INTEGER NOT NULL,
      to_stage INTEGER NOT NULL,
      evolved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS child_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(child_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS family_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL UNIQUE,
      curfew_start INTEGER NOT NULL DEFAULT 21,
      curfew_end INTEGER NOT NULL DEFAULT 7,
      warning_minutes INTEGER NOT NULL DEFAULT 20,
      limit_minutes INTEGER NOT NULL DEFAULT 30,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  return sqlite
}

function seedTestData(sqlite: Database.Database) {
  // Create family
  sqlite.prepare('INSERT INTO users (name, role, family_id) VALUES (?, ?, ?)').run('测试家长', 'parent', 1)
  sqlite.prepare('INSERT INTO users (name, role, family_id) VALUES (?, ?, ?)').run('测试小朋友', 'child', 1)

  // Create pokemon for child (user id = 2)
  sqlite.prepare(
    'INSERT INTO pokemons (child_id, species_id, name, level, evolution_stage) VALUES (?, ?, ?, ?, ?)'
  ).run(2, 1, '妙蛙种子', 1, 1)

  // Add initial discovered species
  sqlite.prepare('INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)').run(2, 1)
}

describe('Database Integration Tests', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    sqlite = createTestDb()
    seedTestData(sqlite)
  })

  afterAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 用户系统
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('用户系统', () => {
    it('正确创建家长和孩子', () => {
      const parent = sqlite.prepare('SELECT * FROM users WHERE role = ?').get('parent') as any
      const child = sqlite.prepare('SELECT * FROM users WHERE role = ?').get('child') as any
      expect(parent.name).toBe('测试家长')
      expect(parent.family_id).toBe(1)
      expect(child.name).toBe('测试小朋友')
      expect(child.family_id).toBe(1)
    })

    it('同一家庭的成员有相同family_id', () => {
      const members = sqlite.prepare('SELECT * FROM users WHERE family_id = 1').all() as any[]
      expect(members).toHaveLength(2)
      expect(members.map(m => m.role).sort()).toEqual(['child', 'parent'])
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 宝可梦系统
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('宝可梦系统', () => {
    it('创建宝可梦', () => {
      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(pokemon).toBeDefined()
      expect(pokemon.species_id).toBe(1)
      expect(pokemon.name).toBe('妙蛙种子')
      expect(pokemon.level).toBe(1)
      expect(pokemon.evolution_stage).toBe(1)
    })

    it('更新宝可梦属性', () => {
      sqlite.prepare('UPDATE pokemons SET vitality = 80, wisdom = 70 WHERE child_id = 2').run()
      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(pokemon.vitality).toBe(80)
      expect(pokemon.wisdom).toBe(70)
    })

    it('更换宝可梦重置进化阶段', () => {
      // Simulate changing pokemon
      sqlite.prepare(
        'UPDATE pokemons SET species_id = 4, name = ?, evolution_stage = 1 WHERE child_id = 2'
      ).run('小火龙')
      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(pokemon.species_id).toBe(4)
      expect(pokemon.evolution_stage).toBe(1)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 任务系统
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('任务系统', () => {
    it('创建任务', () => {
      sqlite.prepare(
        'INSERT INTO tasks (family_id, created_by, title, subject, difficulty, estimated_minutes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(1, 1, '数学练习', '数学', 3, 30, '2026-03-18')

      const task = sqlite.prepare('SELECT * FROM tasks WHERE title = ?').get('数学练习') as any
      expect(task).toBeDefined()
      expect(task.status).toBe('pending')
      expect(task.family_id).toBe(1)
    })

    it('任务状态流转: pending → submitted → approved', () => {
      // Create task
      const { lastInsertRowid: taskId } = sqlite.prepare(
        'INSERT INTO tasks (family_id, created_by, title, subject, difficulty, estimated_minutes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(1, 1, '语文作业', '语文', 2, 20, '2026-03-18')

      // Child submits
      sqlite.prepare(
        'INSERT INTO submissions (task_id, child_id) VALUES (?, ?)'
      ).run(taskId, 2)
      sqlite.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('submitted', taskId)

      let task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task.status).toBe('submitted')

      // Parent reviews
      sqlite.prepare(
        `UPDATE submissions SET review_status = 'approved', quality_score = 5, reviewed_at = datetime('now')
         WHERE task_id = ? AND child_id = ?`
      ).run(taskId, 2)
      sqlite.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('approved', taskId)

      task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task.status).toBe('approved')
    })

    it('任务可以被退回', () => {
      const { lastInsertRowid: taskId } = sqlite.prepare(
        'INSERT INTO tasks (family_id, created_by, title, subject, difficulty, estimated_minutes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(1, 1, '英语听写', '英语', 3, 20, '2026-03-18')

      sqlite.prepare('INSERT INTO submissions (task_id, child_id) VALUES (?, ?)').run(taskId, 2)
      sqlite.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('rejected', taskId)

      const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task.status).toBe('rejected')
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 库存系统
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('库存系统', () => {
    it('添加道具', () => {
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'food', 5)
      const item = sqlite.prepare('SELECT * FROM inventory WHERE child_id = 2 AND item_type = ?').get('food') as any
      expect(item.quantity).toBe(5)
    })

    it('增加道具数量', () => {
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'fragment', 2)
      sqlite.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE child_id = 2 AND item_type = ?').run('fragment')
      const item = sqlite.prepare('SELECT * FROM inventory WHERE child_id = 2 AND item_type = ?').get('fragment') as any
      expect(item.quantity).toBe(3)
    })

    it('消耗道具', () => {
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'crystal', 10)
      sqlite.prepare('UPDATE inventory SET quantity = quantity - 3 WHERE child_id = 2 AND item_type = ?').run('crystal')
      const item = sqlite.prepare('SELECT * FROM inventory WHERE child_id = 2 AND item_type = ?').get('crystal') as any
      expect(item.quantity).toBe(7)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 进化系统集成
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('进化系统集成', () => {
    it('碎片不足不能进化', () => {
      // Set level to 10 but no fragments
      sqlite.prepare('UPDATE pokemons SET level = 10 WHERE child_id = 2').run()

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      const fragmentInv = sqlite.prepare(
        'SELECT quantity FROM inventory WHERE child_id = 2 AND item_type = ?'
      ).get('fragment') as { quantity: number } | undefined

      const result = checkEvolution(pokemon.species_id, pokemon.evolution_stage, pokemon.level, fragmentInv?.quantity ?? 0)
      expect(result.canEvolve).toBe(false)
    })

    it('条件满足可以进化', () => {
      // Set level to 10 and add fragments
      sqlite.prepare('UPDATE pokemons SET level = 10 WHERE child_id = 2').run()
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'fragment', 5)

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      const fragmentInv = sqlite.prepare(
        'SELECT quantity FROM inventory WHERE child_id = 2 AND item_type = ?'
      ).get('fragment') as { quantity: number }

      const result = checkEvolution(pokemon.species_id, pokemon.evolution_stage, pokemon.level, fragmentInv.quantity)
      expect(result.canEvolve).toBe(true)
      expect(result.nextSpeciesId).toBe(2) // 妙蛙草
    })

    it('进化后正确更新数据', () => {
      sqlite.prepare('UPDATE pokemons SET level = 10 WHERE child_id = 2').run()
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'fragment', 5)

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      const fragmentInv = sqlite.prepare(
        'SELECT quantity FROM inventory WHERE child_id = 2 AND item_type = ?'
      ).get('fragment') as { quantity: number }

      const { canEvolve, nextSpeciesId } = checkEvolution(
        pokemon.species_id, pokemon.evolution_stage, pokemon.level, fragmentInv.quantity
      )
      expect(canEvolve).toBe(true)

      // Perform evolution
      const currentStage = pokemon.evolution_stage
      const newStage = currentStage + 1
      const requiredFragments = getEvolutionRequirements(currentStage).fragments
      const newName = POKEMON_NAMES[nextSpeciesId]

      sqlite.prepare(
        'UPDATE inventory SET quantity = quantity - ? WHERE child_id = 2 AND item_type = ?'
      ).run(requiredFragments, 'fragment')

      sqlite.prepare(
        'UPDATE pokemons SET species_id = ?, name = ?, evolution_stage = ? WHERE child_id = 2'
      ).run(nextSpeciesId, newName, newStage)

      sqlite.prepare(
        'INSERT INTO evolution_history (child_id, from_species_id, to_species_id, from_stage, to_stage) VALUES (?, ?, ?, ?, ?)'
      ).run(2, pokemon.species_id, nextSpeciesId, currentStage, newStage)

      sqlite.prepare(
        'INSERT OR IGNORE INTO discovered_species (child_id, species_id) VALUES (?, ?)'
      ).run(2, nextSpeciesId)

      // Verify
      const updatedPokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(updatedPokemon.species_id).toBe(2)
      expect(updatedPokemon.name).toBe('妙蛙草')
      expect(updatedPokemon.evolution_stage).toBe(2)

      const remainingFragments = sqlite.prepare(
        'SELECT quantity FROM inventory WHERE child_id = 2 AND item_type = ?'
      ).get('fragment') as { quantity: number }
      expect(remainingFragments.quantity).toBe(2) // 5 - 3 = 2

      const history = sqlite.prepare('SELECT * FROM evolution_history WHERE child_id = 2').all() as any[]
      expect(history).toHaveLength(1)
      expect(history[0].from_species_id).toBe(1)
      expect(history[0].to_species_id).toBe(2)

      const discovered = sqlite.prepare('SELECT * FROM discovered_species WHERE child_id = 2').all() as any[]
      expect(discovered.length).toBeGreaterThanOrEqual(2)
    })

    it('二次进化需要更高条件', () => {
      // Setup: already evolved to stage 2
      sqlite.prepare('UPDATE pokemons SET species_id = 2, name = ?, level = 15, evolution_stage = 2 WHERE child_id = 2').run('妙蛙草')
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'fragment', 3)

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any

      // Level 15 with 3 fragments - not enough (need 20 and 5)
      const result = checkEvolution(pokemon.species_id, pokemon.evolution_stage, pokemon.level, 3)
      expect(result.canEvolve).toBe(false)

      // Level 20 with 5 fragments - enough
      const result2 = checkEvolution(pokemon.species_id, pokemon.evolution_stage, 20, 5)
      expect(result2.canEvolve).toBe(true)
      expect(result2.nextSpeciesId).toBe(3) // 妙蛙花
    })

    it('最终形态不能继续进化', () => {
      sqlite.prepare('UPDATE pokemons SET species_id = 3, name = ?, level = 30, evolution_stage = 3 WHERE child_id = 2').run('妙蛙花')
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'fragment', 99)

      const result3 = checkEvolution(3, 3, 30, 99)
      expect(result3.canEvolve).toBe(false)
    })

    it('伊布分支进化', () => {
      // Setup: Eevee
      sqlite.prepare('UPDATE pokemons SET species_id = 133, name = ?, level = 10, evolution_stage = 1 WHERE child_id = 2').run('伊布')
      sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, 'fragment', 5)

      // Can evolve to water Eevee
      const waterResult = checkEvolution(133, 1, 10, 5, 134)
      expect(waterResult.canEvolve).toBe(true)
      expect(waterResult.nextSpeciesId).toBe(134)
      expect(POKEMON_NAMES[134]).toBe('水伊布')

      // Can evolve to fire Eevee
      const fireResult = checkEvolution(133, 1, 10, 5, 136)
      expect(fireResult.canEvolve).toBe(true)
      expect(fireResult.nextSpeciesId).toBe(136)
      expect(POKEMON_NAMES[136]).toBe('火伊布')

      // Perform evolution to water
      sqlite.prepare(
        'UPDATE pokemons SET species_id = 134, name = ?, evolution_stage = 2 WHERE child_id = 2'
      ).run('水伊布')

      const evolved = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(evolved.species_id).toBe(134)
      expect(evolved.name).toBe('水伊布')
      expect(evolved.evolution_stage).toBe(2)

      // Water Eevee is final form (no 3rd stage for Eevee)
      const noMore = checkEvolution(134, 2, 30, 99)
      expect(noMore.canEvolve).toBe(false)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 连续打卡
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('连续打卡', () => {
    it('首次打卡设置streak为1', () => {
      const today = new Date().toISOString().split('T')[0]
      sqlite.prepare('UPDATE pokemons SET streak_days = 1, last_checkin_date = ? WHERE child_id = 2').run(today)
      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(pokemon.streak_days).toBe(1)
      expect(pokemon.last_checkin_date).toBe(today)
    })

    it('连续打卡streak递增', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      sqlite.prepare('UPDATE pokemons SET streak_days = 5, last_checkin_date = ? WHERE child_id = 2').run(yesterday)

      // Simulate today's checkin
      const today = new Date().toISOString().split('T')[0]
      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any

      let newStreak = pokemon.streak_days
      if (pokemon.last_checkin_date === yesterday) {
        newStreak += 1
      }

      sqlite.prepare('UPDATE pokemons SET streak_days = ?, last_checkin_date = ? WHERE child_id = 2').run(newStreak, today)

      const updated = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(updated.streak_days).toBe(6)
    })

    it('断签重置streak', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
      sqlite.prepare('UPDATE pokemons SET streak_days = 10, last_checkin_date = ? WHERE child_id = 2').run(threeDaysAgo)

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      let newStreak: number
      if (pokemon.last_checkin_date === today) {
        newStreak = pokemon.streak_days
      } else if (pokemon.last_checkin_date === yesterday) {
        newStreak = pokemon.streak_days + 1
      } else {
        newStreak = 1
      }

      expect(newStreak).toBe(1) // Reset
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 防沉迷设置
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('防沉迷设置', () => {
    it('创建家庭设置', () => {
      sqlite.prepare(
        'INSERT INTO family_settings (family_id, curfew_start, curfew_end, warning_minutes, limit_minutes) VALUES (?, ?, ?, ?, ?)'
      ).run(1, 22, 8, 25, 40)

      const settings = sqlite.prepare('SELECT * FROM family_settings WHERE family_id = 1').get() as any
      expect(settings.curfew_start).toBe(22)
      expect(settings.curfew_end).toBe(8)
      expect(settings.warning_minutes).toBe(25)
      expect(settings.limit_minutes).toBe(40)
    })

    it('更新家庭设置', () => {
      sqlite.prepare(
        'INSERT INTO family_settings (family_id) VALUES (?)'
      ).run(1)

      sqlite.prepare(
        'UPDATE family_settings SET curfew_start = ?, limit_minutes = ? WHERE family_id = 1'
      ).run(23, 60)

      const settings = sqlite.prepare('SELECT * FROM family_settings WHERE family_id = 1').get() as any
      expect(settings.curfew_start).toBe(23)
      expect(settings.limit_minutes).toBe(60)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 通知系统
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('通知系统', () => {
    it('创建通知', () => {
      sqlite.prepare(
        'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
      ).run(2, 'evolution', '进化成功！', '妙蛙种子进化成了妙蛙草')

      const notif = sqlite.prepare('SELECT * FROM notifications WHERE user_id = 2').all() as any[]
      expect(notif).toHaveLength(1)
      expect(notif[0].type).toBe('evolution')
      expect(notif[0].read).toBe(0)
    })

    it('标记通知已读', () => {
      sqlite.prepare(
        'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
      ).run(2, 'reward', '获得奖励', '获得3个食物')

      sqlite.prepare('UPDATE notifications SET read = 1 WHERE user_id = 2').run()

      const notif = sqlite.prepare('SELECT * FROM notifications WHERE user_id = 2').get() as any
      expect(notif.read).toBe(1)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 完整审核流程
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('完整审核流程', () => {
    it('审核通过后奖励道具和属性提升', () => {
      // Create task
      const { lastInsertRowid: taskId } = sqlite.prepare(
        'INSERT INTO tasks (family_id, created_by, title, subject, difficulty, estimated_minutes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(1, 1, '数学测试', '数学', 3, 30, '2026-03-18')

      // Submit
      sqlite.prepare('INSERT INTO submissions (task_id, child_id) VALUES (?, ?)').run(taskId, 2)
      sqlite.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('submitted', taskId)

      // Review with score 5
      const qualityScore = 5
      const rewards = calculateRewards(qualityScore)
      expect(rewards.fragment).toBe(0.5)

      const pokemon = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      const statUpdates = calculateStatUpdates(rewards, 3, pokemon.vitality, pokemon.wisdom, pokemon.affection, 0)

      // Apply rewards
      for (const [itemType, qty] of Object.entries(rewards)) {
        if ((qty as number) > 0) {
          const existing = sqlite.prepare('SELECT * FROM inventory WHERE child_id = 2 AND item_type = ?').get(itemType)
          if (existing) {
            sqlite.prepare('UPDATE inventory SET quantity = quantity + ? WHERE child_id = 2 AND item_type = ?').run(qty, itemType)
          } else {
            sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(2, itemType, qty)
          }
        }
      }

      // Apply stats
      sqlite.prepare('UPDATE pokemons SET vitality = ?, wisdom = ?, affection = ? WHERE child_id = 2')
        .run(statUpdates.vitality, statUpdates.wisdom, statUpdates.affection)

      // Verify
      const updated = sqlite.prepare('SELECT * FROM pokemons WHERE child_id = 2').get() as any
      expect(updated.vitality).toBeGreaterThanOrEqual(pokemon.vitality)

      const foodInv = sqlite.prepare('SELECT quantity FROM inventory WHERE child_id = 2 AND item_type = ?').get('food') as any
      expect(foodInv.quantity).toBe(3)

      const fragmentInv = sqlite.prepare('SELECT quantity FROM inventory WHERE child_id = 2 AND item_type = ?').get('fragment') as any
      expect(fragmentInv.quantity).toBe(0.5)
    })
  })
})

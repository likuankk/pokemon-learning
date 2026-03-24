import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

const DB_PATH = path.join(process.cwd(), 'pokemon.db')

// ── Lazy initialization ──────────────────────────────────────────────────────
// We must NOT open the SQLite database at module-import time because Next.js
// evaluates API-route modules during `next build` (static analysis / page-data
// collection).  On Linux CI the native better-sqlite3 binding or the DB file
// may not be available at that point, causing "Failed to collect page data".
//
// Instead we open the connection lazily on first use at *runtime*.

let _sqlite: InstanceType<typeof Database> | null = null
let _db: ReturnType<typeof drizzle> | null = null
let _initialized = false

function getSqlite() {
  if (!_sqlite) {
    _sqlite = new Database(DB_PATH)
    _sqlite.pragma('journal_mode = WAL')
    _sqlite.pragma('foreign_keys = ON')
    _sqlite.pragma('busy_timeout = 5000')
  }
  return _sqlite
}

function getDb() {
  if (!_db) {
    _db = drizzle(getSqlite(), { schema })
  }
  if (!_initialized) {
    _initialized = true
    initTables()
    runMigrations()
  }
  return _db
}

// Proxy that lazily initialises on property access so existing call-sites
// like `(db as any).session.client` and drizzle queries keep working.
const db: any = new Proxy({} as any, {
  get(_target, prop) {
    const realDb = getDb() as any
    // Expose the raw sqlite connection via `session.client` for legacy code
    if (prop === 'session') {
      return { client: getSqlite() }
    }
    return realDb[prop]
  },
})

export { db }
export default db

// Initialize tables (called lazily on first db access)
function initTables() {
  const sqlite = getSqlite()
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
`)

sqlite.exec(`
  -- Achievements definition table
  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '🏅',
    tier INTEGER NOT NULL DEFAULT 1,
    condition_type TEXT NOT NULL,
    condition_value INTEGER NOT NULL DEFAULT 1
  );

  -- Child achievement unlocks
  CREATE TABLE IF NOT EXISTS child_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(child_id, achievement_id)
  );

  -- Decoration items catalog
  CREATE TABLE IF NOT EXISTS decorations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 10,
    icon TEXT NOT NULL DEFAULT '🪑',
    description TEXT,
    rarity TEXT NOT NULL DEFAULT 'common'
  );

  -- Child's owned & placed decorations
  CREATE TABLE IF NOT EXISTS house_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    decoration_id TEXT NOT NULL,
    placed INTEGER NOT NULL DEFAULT 0,
    slot TEXT,
    purchased_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Notifications
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

  -- Pokemon letters (AI generated)
  CREATE TABLE IF NOT EXISTS pokemon_letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    week_start TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Weekend challenges
  CREATE TABLE IF NOT EXISTS weekend_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    task_id INTEGER,
    challenge_type TEXT NOT NULL,
    bonus_multiplier REAL NOT NULL DEFAULT 1.5,
    weekend_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Anti-addiction sessions
  CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0
  );

  -- Family honor records
  CREATE TABLE IF NOT EXISTS honor_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    period TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Onboarding progress
  CREATE TABLE IF NOT EXISTS onboarding (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    completed INTEGER NOT NULL DEFAULT 0,
    current_step INTEGER NOT NULL DEFAULT 0,
    data TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Family settings (anti-addiction config etc.)
  CREATE TABLE IF NOT EXISTS family_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL UNIQUE,
    curfew_start INTEGER NOT NULL DEFAULT 21,
    curfew_end INTEGER NOT NULL DEFAULT 7,
    warning_minutes INTEGER NOT NULL DEFAULT 20,
    limit_minutes INTEGER NOT NULL DEFAULT 30,
    quiz_display_mode TEXT NOT NULL DEFAULT 'normal',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Discovered species (pokedex)
  CREATE TABLE IF NOT EXISTS discovered_species (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    species_id INTEGER NOT NULL,
    discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(child_id, species_id)
  );

  -- Evolution history
  CREATE TABLE IF NOT EXISTS evolution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    from_species_id INTEGER NOT NULL,
    to_species_id INTEGER NOT NULL,
    from_stage INTEGER NOT NULL,
    to_stage INTEGER NOT NULL,
    evolved_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Daily planner schedules
  CREATE TABLE IF NOT EXISTS daily_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    plan_date TEXT NOT NULL,
    slot TEXT NOT NULL,
    task_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(child_id, plan_date, slot, task_id)
  );

  -- ── Battle System Tables ──────────────────────────────────────────────────

  -- Species catalog (55 Pokemon with battle stats)
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
    emoji TEXT NOT NULL DEFAULT '❓',
    skill1 TEXT,
    skill2 TEXT,
    skill3 TEXT,
    skill4 TEXT
  );

  -- Skills catalog
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

  -- Pokemon learned skills
  CREATE TABLE IF NOT EXISTS pokemon_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pokemon_id INTEGER NOT NULL,
    skill_id TEXT NOT NULL,
    slot INTEGER NOT NULL DEFAULT 1,
    current_pp INTEGER NOT NULL DEFAULT 20,
    UNIQUE(pokemon_id, slot)
  );

  -- Battle logs
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

  -- Battle energy
  CREATE TABLE IF NOT EXISTS battle_energy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL UNIQUE,
    current_energy INTEGER NOT NULL DEFAULT 5,
    max_energy INTEGER NOT NULL DEFAULT 5,
    last_refill_date TEXT NOT NULL DEFAULT (date('now')),
    total_wins INTEGER NOT NULL DEFAULT 0,
    total_battles INTEGER NOT NULL DEFAULT 0
  );

  -- Region unlocks
  CREATE TABLE IF NOT EXISTS region_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    region INTEGER NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    boss_defeated INTEGER NOT NULL DEFAULT 0,
    elite_defeated INTEGER NOT NULL DEFAULT 0,
    UNIQUE(child_id, region)
  );

  -- Task templates (custom + builtin)
  CREATE TABLE IF NOT EXISTS task_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER NOT NULL DEFAULT 3,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Quiz questions for battle knowledge system
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    grade_min INTEGER NOT NULL DEFAULT 3,
    grade_max INTEGER NOT NULL DEFAULT 6,
    difficulty INTEGER NOT NULL DEFAULT 1,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    time_limit INTEGER NOT NULL DEFAULT 10,
    category TEXT
  );

  -- Battle quiz stats per child
  CREATE TABLE IF NOT EXISTS battle_quiz_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    total_answered INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    max_combo INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(child_id)
  );

  -- Quiz answer history (for dedup + wrong answer tracking)
  CREATE TABLE IF NOT EXISTS quiz_answer_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_index INTEGER NOT NULL,
    correct INTEGER NOT NULL DEFAULT 0,
    time_spent_sec REAL NOT NULL DEFAULT 0,
    answered_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Index for fast dedup query (recent questions by child)
  CREATE INDEX IF NOT EXISTS idx_quiz_history_child_time ON quiz_answer_history(child_id, answered_at DESC);
  -- Index for wrong answer queries
  CREATE INDEX IF NOT EXISTS idx_quiz_history_wrong ON quiz_answer_history(child_id, correct);
`)
}

// Run migrations for existing DBs
// Helper to safely add column (ignores "duplicate column name" errors from race conditions)
const safeAddColumn = (table: string, col: string, def: string) => {
  try { getSqlite().exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`) } catch {}
}

const runMigrations = () => {
  const sqlite = getSqlite()
  // tasks: add last_updated
  const taskCols = (sqlite.prepare(`PRAGMA table_info(tasks)`).all() as {name:string}[]).map(c => c.name)
  if (!taskCols.includes('last_updated')) {
    safeAddColumn('tasks', 'last_updated', "TEXT NOT NULL DEFAULT '2024-01-01T00:00:00.000Z'")
    try { sqlite.exec(`UPDATE tasks SET last_updated = created_at WHERE last_updated = '2024-01-01T00:00:00.000Z'`) } catch {}
  }
  if (!taskCols.includes('is_weekend_challenge')) {
    safeAddColumn('tasks', 'is_weekend_challenge', 'INTEGER NOT NULL DEFAULT 0')
  }
  if (!taskCols.includes('task_type')) {
    safeAddColumn('tasks', 'task_type', "TEXT NOT NULL DEFAULT 'regular'")
  }

  // pokemons: add streak_days, last_checkin_date, evolution_stage
  const pokeCols = (sqlite.prepare(`PRAGMA table_info(pokemons)`).all() as {name:string}[]).map(c => c.name)
  if (!pokeCols.includes('streak_days')) {
    safeAddColumn('pokemons', 'streak_days', 'INTEGER NOT NULL DEFAULT 0')
  }
  if (!pokeCols.includes('last_checkin_date')) {
    safeAddColumn('pokemons', 'last_checkin_date', 'TEXT')
  }
  if (!pokeCols.includes('evolution_stage')) {
    safeAddColumn('pokemons', 'evolution_stage', 'INTEGER NOT NULL DEFAULT 1')
  }
  if (!pokeCols.includes('max_streak')) {
    safeAddColumn('pokemons', 'max_streak', 'INTEGER NOT NULL DEFAULT 0')
  }

  // users: add password_hash, email, phone, avatar
  const userCols = (sqlite.prepare(`PRAGMA table_info(users)`).all() as {name:string}[]).map(c => c.name)
  if (!userCols.includes('password_hash')) {
    safeAddColumn('users', 'password_hash', 'TEXT')
  }
  if (!userCols.includes('avatar')) {
    safeAddColumn('users', 'avatar', 'TEXT')
  }

  // pokemons: add battle columns
  if (!pokeCols.includes('battle_power')) {
    safeAddColumn('pokemons', 'battle_power', 'REAL NOT NULL DEFAULT 0')
  }
  if (!pokeCols.includes('defense')) {
    safeAddColumn('pokemons', 'defense', 'REAL NOT NULL DEFAULT 0')
  }
  if (!pokeCols.includes('hp')) {
    safeAddColumn('pokemons', 'hp', 'REAL NOT NULL DEFAULT 0')
  }
  if (!pokeCols.includes('speed')) {
    safeAddColumn('pokemons', 'speed', 'INTEGER NOT NULL DEFAULT 50')
  }
  if (!pokeCols.includes('battle_exp')) {
    safeAddColumn('pokemons', 'battle_exp', 'INTEGER NOT NULL DEFAULT 0')
  }
  if (!pokeCols.includes('battle_level')) {
    safeAddColumn('pokemons', 'battle_level', 'INTEGER NOT NULL DEFAULT 1')
  }
  if (!pokeCols.includes('is_active')) {
    safeAddColumn('pokemons', 'is_active', 'INTEGER NOT NULL DEFAULT 0')
  }
  if (!pokeCols.includes('source')) {
    safeAddColumn('pokemons', 'source', "TEXT NOT NULL DEFAULT 'starter'")
  }

  // Seed achievements if empty
  const achCount = (sqlite.prepare('SELECT COUNT(*) as c FROM achievements').get() as {c:number}).c
  if (achCount === 0) {
    seedAchievements(sqlite)
  }

  // Seed decorations if empty
  const decCount = (sqlite.prepare('SELECT COUNT(*) as c FROM decorations').get() as {c:number}).c
  if (decCount === 0) {
    seedDecorations(sqlite)
  }

  // Seed species catalog if empty
  const speciesCount = (sqlite.prepare('SELECT COUNT(*) as c FROM species_catalog').get() as {c:number}).c
  if (speciesCount === 0) {
    seedSpeciesCatalog(sqlite)
  }

  // Seed skills if empty
  const skillCount = (sqlite.prepare('SELECT COUNT(*) as c FROM skills').get() as {c:number}).c
  if (skillCount === 0) {
    seedSkills(sqlite)
  }

  // Seed task templates if empty
  const tmplCount = (sqlite.prepare('SELECT COUNT(*) as c FROM task_templates').get() as {c:number}).c
  if (tmplCount === 0) {
    seedTaskTemplates(sqlite)
  }

  // Seed quiz questions if empty
  const quizCount = (sqlite.prepare('SELECT COUNT(*) as c FROM quiz_questions').get() as {c:number}).c
  if (quizCount === 0) {
    seedQuizQuestions(sqlite)
  }

  // Initialize battle energy for existing children
  const children = sqlite.prepare(`SELECT id FROM users WHERE role = 'child'`).all() as {id:number}[]
  for (const child of children) {
    sqlite.prepare('INSERT OR IGNORE INTO battle_energy (child_id) VALUES (?)').run(child.id)
    sqlite.prepare('INSERT OR IGNORE INTO region_unlocks (child_id, region) VALUES (?, 1)').run(child.id)
    // Set first pokemon as active if none set
    const hasActive = sqlite.prepare('SELECT id FROM pokemons WHERE child_id = ? AND is_active = 1').get(child.id)
    if (!hasActive) {
      const first = sqlite.prepare('SELECT id FROM pokemons WHERE child_id = ? ORDER BY id LIMIT 1').get(child.id) as {id:number} | undefined
      if (first) {
        sqlite.prepare('UPDATE pokemons SET is_active = 1 WHERE id = ?').run(first.id)
      }
    }
    // Initialize battle stats for existing pokemon that have 0 battle_power
    const zeroBP = sqlite.prepare('SELECT p.id, p.species_id, p.battle_level FROM pokemons p WHERE p.child_id = ? AND p.battle_power = 0').all(child.id) as {id:number, species_id:number, battle_level:number}[]
    for (const poke of zeroBP) {
      const species = sqlite.prepare('SELECT base_power, base_speed, skill1 FROM species_catalog WHERE id = ?').get(poke.species_id) as {base_power:number, base_speed:number, skill1:string} | undefined
      if (species) {
        const bl = poke.battle_level || 1
        const bp = species.base_power * (1 + (bl - 1) * 0.08)
        const def = species.base_power * 0.8 * (1 + (bl - 1) * 0.06)
        const hp = species.base_power * 3 * (1 + (bl - 1) * 0.1)
        sqlite.prepare('UPDATE pokemons SET battle_power = ?, defense = ?, hp = ?, speed = ? WHERE id = ?')
          .run(Math.round(bp * 10) / 10, Math.round(def * 10) / 10, Math.round(hp * 10) / 10, species.base_speed, poke.id)
        // Assign initial skill
        if (species.skill1) {
          sqlite.prepare('INSERT OR IGNORE INTO pokemon_skills (pokemon_id, skill_id, slot) VALUES (?, ?, 1)').run(poke.id, species.skill1)
        }
      }
    }
  }

  // family_settings: add quiz_display_mode
  const fsCols = (sqlite.prepare(`PRAGMA table_info(family_settings)`).all() as {name:string}[]).map(c => c.name)
  if (!fsCols.includes('quiz_display_mode')) {
    safeAddColumn('family_settings', 'quiz_display_mode', "TEXT NOT NULL DEFAULT 'normal'")
  }
}

function seedAchievements(s: any) {
  const achievements = [
    // ── 学习习惯类（12个）────────────────────────────────────────────────────
    { id: 'H-01', title: '迈出第一步', description: '完成第1个学习任务', category: 'habit', icon: '🐾', tier: 1, condition_type: 'total_tasks', condition_value: 1 },
    { id: 'H-02', title: '三天之功', description: '连续打卡学习3天', category: 'habit', icon: '🌱', tier: 1, condition_type: 'streak', condition_value: 3 },
    { id: 'H-03', title: '一周战士', description: '连续打卡学习7天', category: 'habit', icon: '⚡', tier: 1, condition_type: 'streak', condition_value: 7 },
    { id: 'H-04', title: '完美收官', description: '单日所有任务全部完成（≥3个）', category: 'habit', icon: '✅', tier: 1, condition_type: 'perfect_day', condition_value: 3 },
    { id: 'H-05', title: '半月坚守', description: '连续打卡学习14天', category: 'habit', icon: '🔥', tier: 2, condition_type: 'streak', condition_value: 14 },
    { id: 'H-06', title: '月度长跑', description: '连续打卡学习30天', category: 'habit', icon: '🌙', tier: 2, condition_type: 'streak', condition_value: 30 },
    { id: 'H-07', title: '品质优先', description: '连续7天每日完成率≥90%', category: 'habit', icon: '💎', tier: 2, condition_type: 'quality_streak', condition_value: 7 },
    { id: 'H-08', title: '百日修行', description: '累计打卡学习100天', category: 'habit', icon: '🏆', tier: 3, condition_type: 'total_checkin_days', condition_value: 100 },
    { id: 'H-09', title: '三月不辍', description: '连续打卡学习90天', category: 'habit', icon: '🌸', tier: 3, condition_type: 'streak', condition_value: 90 },
    { id: 'H-10', title: '全勤学者', description: '单月每天均完成任务', category: 'habit', icon: '📅', tier: 3, condition_type: 'monthly_perfect', condition_value: 1 },
    { id: 'H-11', title: '清晨的约定', description: '连续21天在早上8点前开始任务', category: 'habit', icon: '🌅', tier: 4, condition_type: 'early_bird_streak', condition_value: 21 },
    { id: 'H-12', title: '永不言弃', description: '累计打卡学习365天', category: 'habit', icon: '🏅', tier: 4, condition_type: 'total_checkin_days', condition_value: 365 },

    // ── 学科均衡类（10个）────────────────────────────────────────────────────
    { id: 'S-01', title: '全科出击', description: '1周内完成3个不同学科任务', category: 'subject', icon: '📚', tier: 1, condition_type: 'weekly_subjects', condition_value: 3 },
    { id: 'S-02', title: '语文小达人', description: '累计完成20个语文任务', category: 'subject', icon: '📖', tier: 1, condition_type: 'subject_chinese', condition_value: 20 },
    { id: 'S-03', title: '数学探险家', description: '累计完成20个数学任务', category: 'subject', icon: '🔢', tier: 1, condition_type: 'subject_math', condition_value: 20 },
    { id: 'S-04', title: '科学小能手', description: '累计完成30个科学任务', category: 'subject', icon: '🔬', tier: 2, condition_type: 'subject_science', condition_value: 30 },
    { id: 'S-05', title: '满分时刻', description: '连续3次获得家长满分评价', category: 'subject', icon: '⭐', tier: 2, condition_type: 'perfect_streak', condition_value: 3 },
    { id: 'S-06', title: '文理兼修', description: '单周语数英三科均有任务完成', category: 'subject', icon: '⚖️', tier: 2, condition_type: 'all_subjects_3', condition_value: 3 },
    { id: 'S-07', title: '五科全才', description: '五个学科各完成≥10个任务', category: 'subject', icon: '🌈', tier: 3, condition_type: 'all_subjects_10', condition_value: 10 },
    { id: 'S-08', title: '完美周', description: '连续7天每日≥2科任务均通过', category: 'subject', icon: '🌟', tier: 3, condition_type: 'perfect_week', condition_value: 7 },
    { id: 'S-09', title: '攻无不克', description: '连续5次退回任务重做后全部通过', category: 'subject', icon: '🔥', tier: 3, condition_type: 'retry_success', condition_value: 5 },
    { id: 'S-10', title: '学海无涯', description: '累计完成≥200个不同学科任务', category: 'subject', icon: '🏛️', tier: 4, condition_type: 'total_tasks', condition_value: 200 },

    // ── 宝可梦养成类（12个）──────────────────────────────────────────────────
    { id: 'P-01', title: '新手训练家', description: '选择并激活第一只宝可梦', category: 'pokemon', icon: '🎯', tier: 1, condition_type: 'total_tasks', condition_value: 1 },
    { id: 'P-02', title: '第一次蜕变', description: '宝可梦完成第一次进化', category: 'pokemon', icon: '✨', tier: 1, condition_type: 'evolution', condition_value: 1 },
    { id: 'P-03', title: '最佳状态', description: '宝可梦连续3天保持最佳状态', category: 'pokemon', icon: '💪', tier: 1, condition_type: 'status_streak', condition_value: 3 },
    { id: 'P-04', title: '道具收藏家', description: '累计使用5种不同道具', category: 'pokemon', icon: '🎒', tier: 1, condition_type: 'item_variety', condition_value: 5 },
    { id: 'P-05', title: '亲密无间', description: '宝可梦亲密度达到80', category: 'pokemon', icon: '💕', tier: 2, condition_type: 'max_affection', condition_value: 80 },
    { id: 'P-06', title: '二次蜕变', description: '宝可梦完成第二次进化', category: 'pokemon', icon: '🌟', tier: 2, condition_type: 'evolution', condition_value: 2 },
    { id: 'P-07', title: '伊布的选择', description: '伊布完成任意分支进化', category: 'pokemon', icon: '🦊', tier: 2, condition_type: 'eevee_evolution', condition_value: 1 },
    { id: 'P-08', title: '进化石大师', description: '累计使用5块进化石', category: 'pokemon', icon: '💎', tier: 2, condition_type: 'stones_used', condition_value: 5 },
    { id: 'P-09', title: '宝可梦伙伴', description: '三项属性同时达到90以上', category: 'pokemon', icon: '🤝', tier: 3, condition_type: 'all_stats_90', condition_value: 90 },
    { id: 'P-10', title: '图鉴研究员', description: '解锁全部宝可梦图鉴词条', category: 'pokemon', icon: '📋', tier: 3, condition_type: 'pokedex_complete', condition_value: 18 },
    { id: 'P-11', title: '道具炼金师', description: '累计获得100个道具', category: 'pokemon', icon: '⚗️', tier: 3, condition_type: 'total_items', condition_value: 100 },
    { id: 'P-12', title: '全员进化', description: '所有初始宝可梦均达到最终进化', category: 'pokemon', icon: '👑', tier: 4, condition_type: 'all_evolved', condition_value: 6 },

    // ── 时间管理类（8个）─────────────────────────────────────────────────────
    { id: 'T-01', title: '小小规划师', description: '首次使用时间规划器排布当天任务', category: 'time', icon: '🗓️', tier: 1, condition_type: 'plan_count', condition_value: 1 },
    { id: 'T-02', title: '言出必行', description: '按计划时间完成任务连续3次', category: 'time', icon: '⏱️', tier: 1, condition_type: 'on_time_streak', condition_value: 3 },
    { id: 'T-03', title: '早鸟优势', description: '提前30分钟完成任务共5次', category: 'time', icon: '🐦', tier: 1, condition_type: 'early_complete', condition_value: 5 },
    { id: 'T-04', title: '黄金时刻', description: '连续5天按规划完成全部任务', category: 'time', icon: '⏳', tier: 2, condition_type: 'plan_streak', condition_value: 5 },
    { id: 'T-05', title: '时间掌控者', description: '单周任务完成偏差均在±20分钟', category: 'time', icon: '🎯', tier: 2, condition_type: 'time_accuracy', condition_value: 7 },
    { id: 'T-06', title: '提前达阵', description: '连续10天提前完成全部计划任务', category: 'time', icon: '🏃', tier: 3, condition_type: 'early_complete_streak', condition_value: 10 },
    { id: 'T-07', title: '计划完美执行', description: '连续30天使用规划器且完成率≥95%', category: 'time', icon: '📊', tier: 3, condition_type: 'plan_streak', condition_value: 30 },
    { id: 'T-08', title: '时间大魔法师', description: '累计100天完整使用规划器且完成率100%', category: 'time', icon: '🧙', tier: 4, condition_type: 'perfect_plan_days', condition_value: 100 },

    // ── 亲子互动类（8个）─────────────────────────────────────────────────────
    { id: 'F-01', title: '第一封信', description: '收到家长的第一条评语留言', category: 'family', icon: '💌', tier: 1, condition_type: 'parent_comments', condition_value: 1 },
    { id: 'F-02', title: '惊喜收到了', description: '首次收到家长手动奖励', category: 'family', icon: '🎁', tier: 1, condition_type: 'manual_rewards', condition_value: 1 },
    { id: 'F-03', title: '爸妈看见我', description: '累计收到家长留言10条', category: 'family', icon: '👀', tier: 1, condition_type: 'parent_comments', condition_value: 10 },
    { id: 'F-04', title: '家长的期待', description: '收到留言后下一个同类任务获得通过', category: 'family', icon: '🏁', tier: 2, condition_type: 'comment_response', condition_value: 1 },
    { id: 'F-05', title: '温暖家园', description: '同一周收到≥5条留言且完成≥3个任务', category: 'family', icon: '🏠', tier: 2, condition_type: 'warm_week', condition_value: 1 },
    { id: 'F-06', title: '共同进步', description: '连续4周有留言互动且完成率≥80%', category: 'family', icon: '🤝', tier: 3, condition_type: 'family_streak', condition_value: 4 },
    { id: 'F-07', title: '爱的里程碑', description: '累计收到家长留言50条且完成任务≥100个', category: 'family', icon: '📸', tier: 3, condition_type: 'love_milestone', condition_value: 50 },
    { id: 'F-08', title: '永远在一起', description: '使用满1年，家长互动≥100次，打卡≥300天', category: 'family', icon: '💖', tier: 4, condition_type: 'forever_together', condition_value: 365 },

    // ── 战斗系统类（8个）────────────────────────────────────────────────────
    { id: 'B-01', title: '初次战斗', description: '完成第1场战斗', category: 'battle', icon: '⚔️', tier: 1, condition_type: 'total_battles', condition_value: 1 },
    { id: 'B-02', title: '十胜将军', description: '累计胜利10场', category: 'battle', icon: '🏆', tier: 1, condition_type: 'total_wins', condition_value: 10 },
    { id: 'B-03', title: '收服大师', description: '收服10种不同宝可梦', category: 'battle', icon: '🎯', tier: 2, condition_type: 'captured_species', condition_value: 10 },
    { id: 'B-04', title: '属性克星', description: '使用属性克制赢得5场战斗', category: 'battle', icon: '💥', tier: 2, condition_type: 'super_effective_wins', condition_value: 5 },
    { id: 'B-05', title: '区域征服者', description: '击败所有6个区域BOSS', category: 'battle', icon: '🗺️', tier: 3, condition_type: 'boss_defeated', condition_value: 6 },
    { id: 'B-06', title: '传说训练家', description: '收服1只传说级宝可梦', category: 'battle', icon: '⭐', tier: 3, condition_type: 'legendary_captured', condition_value: 1 },
    { id: 'B-07', title: '图鉴完成者', description: '发现全部55种宝可梦', category: 'battle', icon: '📖', tier: 4, condition_type: 'pokedex_complete', condition_value: 55 },
    { id: 'B-08', title: '超梦猎人', description: '击败隐藏BOSS超梦', category: 'battle', icon: '🧬', tier: 4, condition_type: 'mewtwo_defeated', condition_value: 1 },
  ]
  const stmt = s.prepare('INSERT OR IGNORE INTO achievements (id,title,description,category,icon,tier,condition_type,condition_value) VALUES (?,?,?,?,?,?,?,?)')
  for (const a of achievements) {
    stmt.run(a.id, a.title, a.description, a.category, a.icon, a.tier, a.condition_type, a.condition_value)
  }
}

function seedDecorations(s: any) {
  const decorations = [
    // ── CAT-01 家具类 ──────────────────────────────────────────────────────
    { id: 'F-01', name: '木质小圆桌', category: 'furniture', price: 40, icon: '🪑', description: '浅棕色木质圆桌，带两把小椅子', rarity: 'common' },
    { id: 'F-02', name: '毛茸茸懒人沙发', category: 'furniture', price: 80, icon: '🛋️', description: '粉色毛绒大圆形沙发', rarity: 'common' },
    { id: 'F-03', name: '书架（小）', category: 'furniture', price: 60, icon: '📚', description: '三层木质书架，摆放迷你书本', rarity: 'common' },
    { id: 'F-04', name: '皮卡丘台灯', category: 'furniture', price: 120, icon: '💡', description: '皮卡丘造型夜灯，发出温暖橙光', rarity: 'uncommon' },
    { id: 'F-05', name: '宝可梦图案地毯', category: 'furniture', price: 50, icon: '🔴', description: '圆形地毯，精灵球图案', rarity: 'common' },
    { id: 'F-06', name: '贝壳形摇椅', category: 'furniture', price: 150, icon: '🪑', description: '白色贝壳造型的摇椅', rarity: 'rare' },
    { id: 'F-07', name: '星空吊床', category: 'furniture', price: 180, icon: '🌙', description: '深蓝色带星星图案的小吊床', rarity: 'rare' },
    { id: 'F-08', name: '水晶玻璃展示柜', category: 'furniture', price: 220, icon: '🔮', description: '透明展示柜，可陈列徽章道具', rarity: 'rare' },
    { id: 'F-09', name: '豪华双人大沙发', category: 'furniture', price: 300, icon: '🛋️', description: '深绿色布艺长沙发，带两个靠垫', rarity: 'epic' },
    { id: 'F-10', name: '魔法音乐盒', category: 'furniture', price: 350, icon: '🎵', description: '旋转音乐盒，播放游戏BGM片段', rarity: 'epic' },
    { id: 'F-11', name: '宝可梦中心接待台', category: 'furniture', price: 500, icon: '🏥', description: '红白色宝可梦中心风格接待台', rarity: 'epic' },
    { id: 'F-12', name: '冠军宝座', category: 'furniture', price: 600, icon: '👑', description: '金色豪华宝座，有宝可梦联盟徽章', rarity: 'legendary' },

    // ── CAT-02 地板类 ──────────────────────────────────────────────────────
    { id: 'G-01', name: '原木地板', category: 'floor', price: 30, icon: '🟫', description: '浅色木纹地板，简约温馨', rarity: 'common' },
    { id: 'G-02', name: '草坪地毯', category: 'floor', price: 45, icon: '🟩', description: '翠绿色仿草坪地板', rarity: 'common' },
    { id: 'G-03', name: '海洋瓷砖', category: 'floor', price: 60, icon: '🌊', description: '蓝白相间海浪纹瓷砖', rarity: 'common' },
    { id: 'G-04', name: '棋盘格地板', category: 'floor', price: 50, icon: '♟️', description: '黑白棋盘格经典地板', rarity: 'common' },
    { id: 'G-05', name: '星空地板', category: 'floor', price: 160, icon: '🌌', description: '深蓝色地板嵌入发光小星星', rarity: 'rare' },
    { id: 'G-06', name: '云朵地板', category: 'floor', price: 130, icon: '☁️', description: '白色云朵图案地板', rarity: 'rare' },
    { id: 'G-09', name: '彩虹地板', category: 'floor', price: 350, icon: '🌈', description: '七彩渐变地板，颜色缓慢变化', rarity: 'epic' },
    { id: 'G-10', name: '宝石镶嵌地板', category: 'floor', price: 500, icon: '💎', description: '仿宝石镶嵌的奢华地板', rarity: 'legendary' },

    // ── CAT-03 墙纸类 ──────────────────────────────────────────────────────
    { id: 'W-01', name: '奶油色温馨墙纸', category: 'wallpaper', price: 30, icon: '🖼️', description: '米白色底色，小花朵图案', rarity: 'common' },
    { id: 'W-02', name: '草原风景墙纸', category: 'wallpaper', price: 45, icon: '🖼️', description: '蓝天白云绿草的风景', rarity: 'common' },
    { id: 'W-03', name: '宝可梦涂鸦墙纸', category: 'wallpaper', price: 70, icon: '🎨', description: '各种宝可梦的卡通涂鸦', rarity: 'common' },
    { id: 'W-04', name: '海底世界墙纸', category: 'wallpaper', price: 80, icon: '🐠', description: '深蓝色海底，有珊瑚和小鱼', rarity: 'uncommon' },
    { id: 'W-05', name: '图书馆墙纸', category: 'wallpaper', price: 90, icon: '📚', description: '满墙书架图案，学术氛围', rarity: 'uncommon' },
    { id: 'W-06', name: '宇宙星系墙纸', category: 'wallpaper', price: 150, icon: '🌌', description: '星云和行星图案', rarity: 'rare' },
    { id: 'W-08', name: '赛后庆典墙纸', category: 'wallpaper', price: 200, icon: '🎉', description: '彩带飞扬、气球飞舞的庆典', rarity: 'rare' },
    { id: 'W-10', name: '冠军殿堂墙纸', category: 'wallpaper', price: 450, icon: '🏆', description: '金色宝可梦联盟殿堂壁画', rarity: 'legendary' },

    // ── CAT-04 户外景观类 ──────────────────────────────────────────────────
    { id: 'O-01', name: '向日葵花盆', category: 'outdoor', price: 25, icon: '🌻', description: '两株向日葵的彩色花盆', rarity: 'common' },
    { id: 'O-02', name: '小木栅栏', category: 'outdoor', price: 35, icon: '🏡', description: '白色木质矮栅栏', rarity: 'common' },
    { id: 'O-03', name: '石头小径', category: 'outdoor', price: 30, icon: '🪨', description: '圆形石头铺成的小路', rarity: 'common' },
    { id: 'O-04', name: '樱桃树盆栽', category: 'outdoor', price: 70, icon: '🌸', description: '开花结果的迷你樱桃树', rarity: 'uncommon' },
    { id: 'O-05', name: '蘑菇路灯', category: 'outdoor', price: 90, icon: '🍄', description: '红色大蘑菇造型小路灯', rarity: 'uncommon' },
    { id: 'O-06', name: '精灵球喷水池', category: 'outdoor', price: 150, icon: '⛲', description: '精灵球造型的迷你喷水池', rarity: 'rare' },
    { id: 'O-09', name: '宝可梦石像', category: 'outdoor', price: 200, icon: '🗿', description: '你的宝可梦石像', rarity: 'rare' },
    { id: 'O-10', name: '彩虹桥', category: 'outdoor', price: 280, icon: '🌈', description: '通往院子深处的彩虹拱形小桥', rarity: 'epic' },
    { id: 'O-11', name: '光之树', category: 'outdoor', price: 400, icon: '✨', description: '全身发光的神秘白色大树', rarity: 'epic' },
    { id: 'O-12', name: '胜利旗杆', category: 'outdoor', price: 350, icon: '🚩', description: '带有你名字旗帜的旗杆', rarity: 'epic' },

    // ── CAT-05 宝可梦玩具类 ────────────────────────────────────────────────
    { id: 'T-01', name: '毛线球', category: 'toy', price: 20, icon: '🧶', description: '五彩毛线球', rarity: 'common' },
    { id: 'T-02', name: '精灵球玩具', category: 'toy', price: 35, icon: '🔴', description: '大号软质精灵球', rarity: 'common' },
    { id: 'T-03', name: '旋转风车', category: 'toy', price: 30, icon: '🎡', description: '彩色塑料风车', rarity: 'common' },
    { id: 'T-04', name: '积木套装', category: 'toy', price: 60, icon: '🧱', description: '彩色木质积木，可堆叠', rarity: 'uncommon' },
    { id: 'T-05', name: '宝可梦拼图', category: 'toy', price: 80, icon: '🧩', description: '宝可梦图案的大块拼图', rarity: 'uncommon' },
    { id: 'T-06', name: '弹跳蹦床', category: 'toy', price: 120, icon: '🤸', description: '圆形迷你蹦床', rarity: 'uncommon' },
    { id: 'T-07', name: '魔法水晶球', category: 'toy', price: 150, icon: '🔮', description: '发光的球，内有雪花飘落', rarity: 'rare' },
    { id: 'T-08', name: '迷你滑梯', category: 'toy', price: 180, icon: '🛝', description: '彩色小滑梯', rarity: 'rare' },
    { id: 'T-09', name: '宝可梦乐器套装', category: 'toy', price: 250, icon: '🎸', description: '小鼓/小吉他/木琴三件套', rarity: 'epic' },
    { id: 'T-10', name: '时光胶囊', category: 'toy', price: 400, icon: '💊', description: '可以存入记忆的发光胶囊', rarity: 'epic' },

    // ── CAT-06 功能性装饰类 ────────────────────────────────────────────────
    { id: 'FN-01', name: '心愿便利贴板', category: 'functional', price: 50, icon: '📌', description: '可写愿望的软木板', rarity: 'common' },
    { id: 'FN-03', name: '宝可梦日历', category: 'functional', price: 60, icon: '📅', description: '宝可梦图案翻页日历', rarity: 'common' },
    { id: 'FN-06', name: '时间沙漏', category: 'functional', price: 150, icon: '⏳', description: '大型金色沙漏摆件', rarity: 'rare' },
    { id: 'FN-07', name: '荣誉奖杯柜', category: 'functional', price: 200, icon: '🏆', description: '展示奖杯奖牌的玻璃柜', rarity: 'rare' },
    { id: 'FN-08', name: '成长树', category: 'functional', price: 300, icon: '🌲', description: '随打卡天数生长的小树', rarity: 'epic' },

    // ── CAT-07 门口装饰类 ──────────────────────────────────────────────────
    { id: 'D-01', name: '彩色门垫', category: 'door', price: 20, icon: '🚪', description: '彩虹颜色的欢迎门垫', rarity: 'common' },
    { id: 'D-02', name: '精灵球门牌', category: 'door', price: 45, icon: '🔴', description: '刻有你名字的精灵球门牌', rarity: 'common' },
    { id: 'D-03', name: '植物门帘', category: 'door', price: 35, icon: '🌿', description: '绿色常青藤门帘', rarity: 'common' },
    { id: 'D-06', name: '星星风铃', category: 'door', price: 100, icon: '🎐', description: '金色星星串联的风铃', rarity: 'uncommon' },

    // ── CAT-08 宝可梦专属寝具类 ────────────────────────────────────────────
    { id: 'B-01', name: '草编小窝', category: 'bed', price: 30, icon: '🛏️', description: '圆形草编宝可梦睡窝', rarity: 'common' },
    { id: 'B-02', name: '云朵床', category: 'bed', price: 60, icon: '☁️', description: '棉花糖造型的白色软床', rarity: 'common' },
    { id: 'B-03', name: '星星睡袋', category: 'bed', price: 75, icon: '🌟', description: '深蓝色带星星图案的睡袋', rarity: 'uncommon' },
    { id: 'B-07', name: '皇家四柱床', category: 'bed', price: 250, icon: '👑', description: '带帷幔的豪华四柱小床', rarity: 'epic' },
    { id: 'B-08', name: '梦境发生器', category: 'bed', price: 450, icon: '💤', description: '科幻风格的睡眠舱', rarity: 'legendary' },
  ]
  const stmt = s.prepare('INSERT OR IGNORE INTO decorations (id,name,category,price,icon,description,rarity) VALUES (?,?,?,?,?,?,?)')
  for (const d of decorations) {
    stmt.run(d.id, d.name, d.category, d.price, d.icon, d.description, d.rarity)
  }
}

function seedSkills(s: any) {
  const skills = [
    // Tier 1 - Basic (unlock_level 1)
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
    // Tier 2 - Mid (unlock_level 3)
    { id: 'S12', name: '喷射火焰', type: 'fire', power: 65, accuracy: 95, pp: 15, effect: '{"type":"burn","chance":10}', unlock_level: 3 },
    { id: 'S13', name: '水之波动', type: 'water', power: 60, accuracy: 100, pp: 15, effect: null, unlock_level: 3 },
    { id: 'S14', name: '飞叶快刀', type: 'grass', power: 60, accuracy: 95, pp: 15, effect: null, unlock_level: 3 },
    { id: 'S15', name: '十万伏特', type: 'electric', power: 65, accuracy: 95, pp: 15, effect: '{"type":"paralyze","chance":10}', unlock_level: 3 },
    { id: 'S16', name: '地震', type: 'ground', power: 70, accuracy: 100, pp: 10, effect: null, unlock_level: 3 },
    { id: 'S17', name: '冰冻光线', type: 'ice', power: 65, accuracy: 95, pp: 15, effect: '{"type":"freeze","chance":10}', unlock_level: 3 },
    { id: 'S18', name: '空气斩', type: 'flying', power: 60, accuracy: 95, pp: 15, effect: null, unlock_level: 3 },
    { id: 'S19', name: '信号光束', type: 'bug', power: 60, accuracy: 100, pp: 15, effect: null, unlock_level: 3 },
    // Tier 3 - Support (unlock_level 8)
    { id: 'S20', name: '光墙', type: 'normal', power: 0, accuracy: 100, pp: 10, effect: '{"type":"defense_up","amount":0.5,"duration":3}', unlock_level: 8 },
    { id: 'S21', name: '剑舞', type: 'normal', power: 0, accuracy: 100, pp: 10, effect: '{"type":"attack_up","amount":0.5,"duration":3}', unlock_level: 8 },
    { id: 'S22', name: '催眠术', type: 'normal', power: 0, accuracy: 60, pp: 5, effect: '{"type":"sleep","duration":2}', unlock_level: 8 },
    { id: 'S23', name: '治愈之愿', type: 'normal', power: 0, accuracy: 100, pp: 5, effect: '{"type":"heal","amount":0.3}', unlock_level: 8 },
    // Tier 4 - Ultimate (unlock_level 15)
    { id: 'S24', name: '大字爆炎', type: 'fire', power: 90, accuracy: 85, pp: 5, effect: '{"type":"burn","chance":20}', unlock_level: 15 },
    { id: 'S25', name: '水炮', type: 'water', power: 90, accuracy: 85, pp: 5, effect: null, unlock_level: 15 },
    { id: 'S26', name: '日光束', type: 'grass', power: 95, accuracy: 90, pp: 5, effect: '{"type":"charge","turns":1}', unlock_level: 15 },
    { id: 'S27', name: '雷霆', type: 'electric', power: 90, accuracy: 85, pp: 5, effect: '{"type":"paralyze","chance":20}', unlock_level: 15 },
    { id: 'S28', name: '暴风雪', type: 'ice', power: 90, accuracy: 85, pp: 5, effect: '{"type":"freeze","chance":20}', unlock_level: 15 },
    { id: 'S29', name: '破坏光线', type: 'normal', power: 100, accuracy: 90, pp: 3, effect: '{"type":"recharge","turns":1}', unlock_level: 15 },
  ]
  const stmt = s.prepare('INSERT OR IGNORE INTO skills (id,name,type,power,accuracy,pp,effect,unlock_level) VALUES (?,?,?,?,?,?,?,?)')
  for (const sk of skills) {
    stmt.run(sk.id, sk.name, sk.type, sk.power, sk.accuracy, sk.pp, sk.effect, sk.unlock_level)
  }
}

function seedSpeciesCatalog(s: any) {
  const species = [
    // Region 1 - 翠绿森林 (Grass/Bug)
    { id: 1, name: '妙蛙种子', type1: 'grass', type2: null, base_power: 45, base_speed: 45, rarity: 2, region: 1, evolves_from: null, evolves_to: '[2]', evolution_level: 5, emoji: '🌿', skill1: 'S05', skill2: 'S14', skill3: 'S23', skill4: 'S26' },
    { id: 2, name: '妙蛙草', type1: 'grass', type2: null, base_power: 65, base_speed: 50, rarity: 3, region: 1, evolves_from: 1, evolves_to: '[3]', evolution_level: 12, emoji: '🌿', skill1: 'S05', skill2: 'S14', skill3: 'S23', skill4: 'S26' },
    { id: 3, name: '妙蛙花', type1: 'grass', type2: null, base_power: 90, base_speed: 55, rarity: 4, region: 1, evolves_from: 2, evolves_to: null, evolution_level: null, emoji: '🌿', skill1: 'S05', skill2: 'S14', skill3: 'S23', skill4: 'S26' },
    { id: 10, name: '绿毛虫', type1: 'bug', type2: null, base_power: 25, base_speed: 30, rarity: 1, region: 1, evolves_from: null, evolves_to: '[11]', evolution_level: 3, emoji: '🐛', skill1: 'S10', skill2: 'S19', skill3: 'S20', skill4: 'S29' },
    { id: 11, name: '铁甲蛹', type1: 'bug', type2: null, base_power: 35, base_speed: 25, rarity: 1, region: 1, evolves_from: 10, evolves_to: '[12]', evolution_level: 7, emoji: '🐛', skill1: 'S10', skill2: 'S19', skill3: 'S20', skill4: 'S29' },
    { id: 12, name: '巴大蝶', type1: 'bug', type2: 'flying', base_power: 60, base_speed: 55, rarity: 2, region: 1, evolves_from: 11, evolves_to: null, evolution_level: null, emoji: '🦋', skill1: 'S10', skill2: 'S18', skill3: 'S22', skill4: 'S29' },
    { id: 43, name: '走路草', type1: 'grass', type2: null, base_power: 40, base_speed: 35, rarity: 1, region: 1, evolves_from: null, evolves_to: '[44]', evolution_level: 6, emoji: '🌿', skill1: 'S05', skill2: 'S14', skill3: 'S22', skill4: 'S26' },
    { id: 44, name: '臭臭花', type1: 'grass', type2: null, base_power: 60, base_speed: 40, rarity: 2, region: 1, evolves_from: 43, evolves_to: '[45]', evolution_level: 14, emoji: '🌸', skill1: 'S05', skill2: 'S14', skill3: 'S22', skill4: 'S26' },
    { id: 45, name: '霸王花', type1: 'grass', type2: null, base_power: 85, base_speed: 45, rarity: 3, region: 1, evolves_from: 44, evolves_to: null, evolution_level: null, emoji: '🌺', skill1: 'S05', skill2: 'S14', skill3: 'S22', skill4: 'S26' },
    { id: 69, name: '喇叭芽', type1: 'grass', type2: null, base_power: 38, base_speed: 35, rarity: 1, region: 1, evolves_from: null, evolves_to: '[70]', evolution_level: 6, emoji: '🌱', skill1: 'S05', skill2: 'S14', skill3: 'S21', skill4: 'S26' },
    { id: 70, name: '口呆花', type1: 'grass', type2: null, base_power: 58, base_speed: 40, rarity: 2, region: 1, evolves_from: 69, evolves_to: '[71]', evolution_level: 14, emoji: '🌱', skill1: 'S05', skill2: 'S14', skill3: 'S21', skill4: 'S26' },
    { id: 71, name: '大食花', type1: 'grass', type2: null, base_power: 82, base_speed: 45, rarity: 3, region: 1, evolves_from: 70, evolves_to: null, evolution_level: null, emoji: '🌱', skill1: 'S05', skill2: 'S14', skill3: 'S21', skill4: 'S26' },

    // Region 2 - 火山熔岩 (Fire)
    { id: 4, name: '小火龙', type1: 'fire', type2: null, base_power: 48, base_speed: 55, rarity: 2, region: 2, evolves_from: null, evolves_to: '[5]', evolution_level: 5, emoji: '🔥', skill1: 'S03', skill2: 'S12', skill3: 'S21', skill4: 'S24' },
    { id: 5, name: '火恐龙', type1: 'fire', type2: null, base_power: 68, base_speed: 60, rarity: 3, region: 2, evolves_from: 4, evolves_to: '[6]', evolution_level: 12, emoji: '🔥', skill1: 'S03', skill2: 'S12', skill3: 'S21', skill4: 'S24' },
    { id: 6, name: '喷火龙', type1: 'fire', type2: 'flying', base_power: 95, base_speed: 70, rarity: 4, region: 2, evolves_from: 5, evolves_to: null, evolution_level: null, emoji: '🔥', skill1: 'S03', skill2: 'S12', skill3: 'S09', skill4: 'S24' },
    { id: 37, name: '六尾', type1: 'fire', type2: null, base_power: 42, base_speed: 55, rarity: 2, region: 2, evolves_from: null, evolves_to: '[38]', evolution_level: 8, emoji: '🦊', skill1: 'S03', skill2: 'S12', skill3: 'S22', skill4: 'S24' },
    { id: 38, name: '九尾', type1: 'fire', type2: null, base_power: 78, base_speed: 65, rarity: 3, region: 2, evolves_from: 37, evolves_to: null, evolution_level: null, emoji: '🦊', skill1: 'S03', skill2: 'S12', skill3: 'S22', skill4: 'S24' },
    { id: 58, name: '卡蒂狗', type1: 'fire', type2: null, base_power: 55, base_speed: 55, rarity: 2, region: 2, evolves_from: null, evolves_to: '[59]', evolution_level: 10, emoji: '🐕', skill1: 'S03', skill2: 'S12', skill3: 'S21', skill4: 'S24' },
    { id: 59, name: '风速狗', type1: 'fire', type2: null, base_power: 88, base_speed: 75, rarity: 4, region: 2, evolves_from: 58, evolves_to: null, evolution_level: null, emoji: '🐕', skill1: 'S03', skill2: 'S12', skill3: 'S21', skill4: 'S24' },
    { id: 77, name: '小火马', type1: 'fire', type2: null, base_power: 50, base_speed: 65, rarity: 2, region: 2, evolves_from: null, evolves_to: '[78]', evolution_level: 10, emoji: '🐴', skill1: 'S03', skill2: 'S12', skill3: 'S01', skill4: 'S24' },
    { id: 78, name: '烈焰马', type1: 'fire', type2: null, base_power: 80, base_speed: 75, rarity: 3, region: 2, evolves_from: 77, evolves_to: null, evolution_level: null, emoji: '🐴', skill1: 'S03', skill2: 'S12', skill3: 'S01', skill4: 'S24' },

    // Region 3 - 深蓝湖畔 (Water)
    { id: 7, name: '杰尼龟', type1: 'water', type2: null, base_power: 46, base_speed: 43, rarity: 2, region: 3, evolves_from: null, evolves_to: '[8]', evolution_level: 5, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S20', skill4: 'S25' },
    { id: 8, name: '卡咪龟', type1: 'water', type2: null, base_power: 66, base_speed: 50, rarity: 3, region: 3, evolves_from: 7, evolves_to: '[9]', evolution_level: 12, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S20', skill4: 'S25' },
    { id: 9, name: '水箭龟', type1: 'water', type2: null, base_power: 92, base_speed: 58, rarity: 4, region: 3, evolves_from: 8, evolves_to: null, evolution_level: null, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S20', skill4: 'S25' },
    { id: 54, name: '可达鸭', type1: 'water', type2: null, base_power: 44, base_speed: 45, rarity: 1, region: 3, evolves_from: null, evolves_to: '[55]', evolution_level: 8, emoji: '🦆', skill1: 'S04', skill2: 'S13', skill3: 'S22', skill4: 'S25' },
    { id: 55, name: '哥达鸭', type1: 'water', type2: null, base_power: 75, base_speed: 60, rarity: 3, region: 3, evolves_from: 54, evolves_to: null, evolution_level: null, emoji: '🦆', skill1: 'S04', skill2: 'S13', skill3: 'S22', skill4: 'S25' },
    { id: 60, name: '蚊香蝌蚪', type1: 'water', type2: null, base_power: 35, base_speed: 40, rarity: 1, region: 3, evolves_from: null, evolves_to: '[61]', evolution_level: 5, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S23', skill4: 'S25' },
    { id: 61, name: '蚊香君', type1: 'water', type2: null, base_power: 55, base_speed: 50, rarity: 2, region: 3, evolves_from: 60, evolves_to: '[62]', evolution_level: 12, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S23', skill4: 'S25' },
    { id: 62, name: '蚊香泳士', type1: 'water', type2: null, base_power: 80, base_speed: 55, rarity: 3, region: 3, evolves_from: 61, evolves_to: null, evolution_level: null, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S21', skill4: 'S25' },
    { id: 120, name: '海星星', type1: 'water', type2: null, base_power: 48, base_speed: 50, rarity: 2, region: 3, evolves_from: null, evolves_to: '[121]', evolution_level: 10, emoji: '⭐', skill1: 'S04', skill2: 'S13', skill3: 'S23', skill4: 'S25' },
    { id: 121, name: '宝石海星', type1: 'water', type2: null, base_power: 78, base_speed: 65, rarity: 3, region: 3, evolves_from: 120, evolves_to: null, evolution_level: null, emoji: '💎', skill1: 'S04', skill2: 'S13', skill3: 'S23', skill4: 'S25' },

    // Region 4 - 雷鸣平原 (Electric/Fairy)
    { id: 25, name: '皮卡丘', type1: 'electric', type2: null, base_power: 50, base_speed: 70, rarity: 2, region: 4, evolves_from: null, evolves_to: '[26]', evolution_level: 8, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S21', skill4: 'S27' },
    { id: 26, name: '雷丘', type1: 'electric', type2: null, base_power: 80, base_speed: 75, rarity: 3, region: 4, evolves_from: 25, evolves_to: null, evolution_level: null, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S21', skill4: 'S27' },
    { id: 81, name: '小磁怪', type1: 'electric', type2: null, base_power: 40, base_speed: 35, rarity: 1, region: 4, evolves_from: null, evolves_to: '[82]', evolution_level: 10, emoji: '🧲', skill1: 'S06', skill2: 'S15', skill3: 'S20', skill4: 'S27' },
    { id: 82, name: '三合一磁怪', type1: 'electric', type2: null, base_power: 72, base_speed: 45, rarity: 3, region: 4, evolves_from: 81, evolves_to: null, evolution_level: null, emoji: '🧲', skill1: 'S06', skill2: 'S15', skill3: 'S20', skill4: 'S27' },
    { id: 100, name: '霹雳电球', type1: 'electric', type2: null, base_power: 38, base_speed: 75, rarity: 1, region: 4, evolves_from: null, evolves_to: '[101]', evolution_level: 8, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S01', skill4: 'S27' },
    { id: 101, name: '顽皮雷弹', type1: 'electric', type2: null, base_power: 68, base_speed: 80, rarity: 2, region: 4, evolves_from: 100, evolves_to: null, evolution_level: null, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S01', skill4: 'S27' },
    { id: 125, name: '电击兽', type1: 'electric', type2: null, base_power: 72, base_speed: 65, rarity: 3, region: 4, evolves_from: null, evolves_to: null, evolution_level: null, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S21', skill4: 'S27' },
    { id: 39, name: '胖丁', type1: 'fairy', type2: null, base_power: 42, base_speed: 30, rarity: 1, region: 4, evolves_from: null, evolves_to: '[40]', evolution_level: 8, emoji: '🎤', skill1: 'S11', skill2: 'S01', skill3: 'S22', skill4: 'S29' },
    { id: 40, name: '胖可丁', type1: 'fairy', type2: null, base_power: 68, base_speed: 35, rarity: 2, region: 4, evolves_from: 39, evolves_to: null, evolution_level: null, emoji: '🎤', skill1: 'S11', skill2: 'S01', skill3: 'S22', skill4: 'S29' },
    { id: 35, name: '皮皮', type1: 'fairy', type2: null, base_power: 40, base_speed: 35, rarity: 1, region: 4, evolves_from: null, evolves_to: '[36]', evolution_level: 8, emoji: '🧚', skill1: 'S11', skill2: 'S01', skill3: 'S23', skill4: 'S29' },
    { id: 36, name: '皮可西', type1: 'fairy', type2: null, base_power: 72, base_speed: 40, rarity: 3, region: 4, evolves_from: 35, evolves_to: null, evolution_level: null, emoji: '🧚', skill1: 'S11', skill2: 'S01', skill3: 'S23', skill4: 'S29' },

    // Region 5 - 冰雪山脉 (Ground/Ice)
    { id: 27, name: '穿山鼠', type1: 'ground', type2: null, base_power: 42, base_speed: 55, rarity: 1, region: 5, evolves_from: null, evolves_to: '[28]', evolution_level: 8, emoji: '🌍', skill1: 'S07', skill2: 'S16', skill3: 'S21', skill4: 'S29' },
    { id: 28, name: '穿山王', type1: 'ground', type2: null, base_power: 72, base_speed: 60, rarity: 2, region: 5, evolves_from: 27, evolves_to: null, evolution_level: null, emoji: '🌍', skill1: 'S07', skill2: 'S16', skill3: 'S21', skill4: 'S29' },
    { id: 50, name: '地鼠', type1: 'ground', type2: null, base_power: 35, base_speed: 70, rarity: 1, region: 5, evolves_from: null, evolves_to: '[51]', evolution_level: 6, emoji: '🌍', skill1: 'S07', skill2: 'S16', skill3: 'S02', skill4: 'S29' },
    { id: 51, name: '三地鼠', type1: 'ground', type2: null, base_power: 65, base_speed: 80, rarity: 2, region: 5, evolves_from: 50, evolves_to: null, evolution_level: null, emoji: '🌍', skill1: 'S07', skill2: 'S16', skill3: 'S02', skill4: 'S29' },
    { id: 74, name: '小拳石', type1: 'ground', type2: null, base_power: 42, base_speed: 20, rarity: 1, region: 5, evolves_from: null, evolves_to: '[75]', evolution_level: 6, emoji: '🪨', skill1: 'S07', skill2: 'S16', skill3: 'S20', skill4: 'S29' },
    { id: 75, name: '隆隆石', type1: 'ground', type2: null, base_power: 62, base_speed: 25, rarity: 2, region: 5, evolves_from: 74, evolves_to: '[76]', evolution_level: 14, emoji: '🪨', skill1: 'S07', skill2: 'S16', skill3: 'S20', skill4: 'S29' },
    { id: 76, name: '隆隆岩', type1: 'ground', type2: null, base_power: 85, base_speed: 30, rarity: 3, region: 5, evolves_from: 75, evolves_to: null, evolution_level: null, emoji: '🪨', skill1: 'S07', skill2: 'S16', skill3: 'S20', skill4: 'S29' },
    { id: 86, name: '小海狮', type1: 'water', type2: null, base_power: 48, base_speed: 40, rarity: 2, region: 5, evolves_from: null, evolves_to: '[87]', evolution_level: 10, emoji: '🦭', skill1: 'S04', skill2: 'S17', skill3: 'S23', skill4: 'S28' },
    { id: 87, name: '白海狮', type1: 'water', type2: 'ice', base_power: 75, base_speed: 45, rarity: 3, region: 5, evolves_from: 86, evolves_to: null, evolution_level: null, emoji: '🦭', skill1: 'S04', skill2: 'S17', skill3: 'S23', skill4: 'S28' },
    { id: 131, name: '拉普拉斯', type1: 'water', type2: 'ice', base_power: 88, base_speed: 50, rarity: 4, region: 5, evolves_from: null, evolves_to: null, evolution_level: null, emoji: '🐉', skill1: 'S04', skill2: 'S17', skill3: 'S23', skill4: 'S28' },
    { id: 144, name: '急冻鸟', type1: 'ice', type2: 'flying', base_power: 95, base_speed: 60, rarity: 5, region: 5, evolves_from: null, evolves_to: null, evolution_level: null, emoji: '❄️', skill1: 'S08', skill2: 'S17', skill3: 'S18', skill4: 'S28' },

    // Region 6 - 冠军之路 (Mixed/Legendary)
    { id: 133, name: '伊布', type1: 'normal', type2: null, base_power: 46, base_speed: 55, rarity: 2, region: 6, evolves_from: null, evolves_to: '[134,135,136,471]', evolution_level: 8, emoji: '🦊', skill1: 'S01', skill2: 'S02', skill3: 'S21', skill4: 'S29' },
    { id: 134, name: '水伊布', type1: 'water', type2: null, base_power: 78, base_speed: 55, rarity: 3, region: 6, evolves_from: 133, evolves_to: null, evolution_level: null, emoji: '💧', skill1: 'S04', skill2: 'S13', skill3: 'S21', skill4: 'S25' },
    { id: 135, name: '雷伊布', type1: 'electric', type2: null, base_power: 78, base_speed: 70, rarity: 3, region: 6, evolves_from: 133, evolves_to: null, evolution_level: null, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S21', skill4: 'S27' },
    { id: 136, name: '火伊布', type1: 'fire', type2: null, base_power: 78, base_speed: 55, rarity: 3, region: 6, evolves_from: 133, evolves_to: null, evolution_level: null, emoji: '🔥', skill1: 'S03', skill2: 'S12', skill3: 'S21', skill4: 'S24' },
    { id: 471, name: '冰伊布', type1: 'ice', type2: null, base_power: 78, base_speed: 55, rarity: 3, region: 6, evolves_from: 133, evolves_to: null, evolution_level: null, emoji: '❄️', skill1: 'S08', skill2: 'S17', skill3: 'S21', skill4: 'S28' },
    { id: 143, name: '卡比兽', type1: 'normal', type2: null, base_power: 88, base_speed: 20, rarity: 4, region: 6, evolves_from: null, evolves_to: null, evolution_level: null, emoji: '😴', skill1: 'S01', skill2: 'S02', skill3: 'S23', skill4: 'S29' },
    { id: 145, name: '闪电鸟', type1: 'electric', type2: 'flying', base_power: 95, base_speed: 75, rarity: 5, region: 6, evolves_from: null, evolves_to: null, evolution_level: null, emoji: '⚡', skill1: 'S06', skill2: 'S15', skill3: 'S09', skill4: 'S27' },
    { id: 146, name: '火焰鸟', type1: 'fire', type2: 'flying', base_power: 95, base_speed: 70, rarity: 5, region: 6, evolves_from: null, evolves_to: null, evolution_level: null, emoji: '🔥', skill1: 'S03', skill2: 'S12', skill3: 'S09', skill4: 'S24' },
    { id: 147, name: '迷你龙', type1: 'flying', type2: null, base_power: 50, base_speed: 45, rarity: 3, region: 6, evolves_from: null, evolves_to: '[148]', evolution_level: 10, emoji: '🐉', skill1: 'S09', skill2: 'S18', skill3: 'S21', skill4: 'S29' },
    { id: 148, name: '哈克龙', type1: 'flying', type2: null, base_power: 75, base_speed: 55, rarity: 4, region: 6, evolves_from: 147, evolves_to: '[149]', evolution_level: 18, emoji: '🐉', skill1: 'S09', skill2: 'S18', skill3: 'S21', skill4: 'S29' },
    { id: 149, name: '快龙', type1: 'flying', type2: null, base_power: 98, base_speed: 65, rarity: 5, region: 6, evolves_from: 148, evolves_to: null, evolution_level: null, emoji: '🐉', skill1: 'S09', skill2: 'S18', skill3: 'S21', skill4: 'S29' },
    { id: 150, name: '超梦', type1: 'normal', type2: null, base_power: 100, base_speed: 80, rarity: 5, region: 6, evolves_from: null, evolves_to: null, evolution_level: null, emoji: '🧬', skill1: 'S01', skill2: 'S22', skill3: 'S21', skill4: 'S29' },
  ]
  const stmt = s.prepare(
    'INSERT OR IGNORE INTO species_catalog (id,name,type1,type2,base_power,base_speed,rarity,region,evolves_from,evolves_to,evolution_level,emoji,skill1,skill2,skill3,skill4) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  )
  for (const sp of species) {
    stmt.run(sp.id, sp.name, sp.type1, sp.type2, sp.base_power, sp.base_speed, sp.rarity, sp.region, sp.evolves_from, sp.evolves_to, sp.evolution_level, sp.emoji, sp.skill1, sp.skill2, sp.skill3, sp.skill4)
  }
}

function seedTaskTemplates(s: any) {
  const templates = [
    { title: '语文生字抄写', subject: '语文', description: '抄写本课生字，每字写3遍，注意笔顺', difficulty: 2, minutes: 20 },
    { title: '课文朗读背诵', subject: '语文', description: '朗读课文3遍，尝试背诵重点段落', difficulty: 2, minutes: 15 },
    { title: '阅读理解练习', subject: '语文', description: '完成阅读理解题，注意答题格式', difficulty: 3, minutes: 30 },
    { title: '日记写作', subject: '语文', description: '写一篇日记，不少于100字', difficulty: 3, minutes: 30 },
    { title: '数学口算练习', subject: '数学', description: '完成口算练习题，计时完成', difficulty: 2, minutes: 15 },
    { title: '数学练习册', subject: '数学', description: '完成练习册指定页，检查答案', difficulty: 3, minutes: 30 },
    { title: '数学思维题', subject: '数学', description: '完成2道思维拓展题，写出解题过程', difficulty: 4, minutes: 45 },
    { title: '英语单词抄写', subject: '英语', description: '抄写本单元单词，每个写3遍并中文释义', difficulty: 2, minutes: 20 },
    { title: '英语课文朗读', subject: '英语', description: '朗读课文3遍，注意语音语调', difficulty: 2, minutes: 15 },
    { title: '英语听写练习', subject: '英语', description: '完成单词听写，对照订正', difficulty: 3, minutes: 20 },
    { title: '英语造句练习', subject: '英语', description: '用本单元单词造5个句子', difficulty: 3, minutes: 25 },
    { title: '科学实验记录', subject: '科学', description: '完成科学实验并填写观察记录表', difficulty: 3, minutes: 30 },
    { title: '科学概念复习', subject: '科学', description: '复习本章重要概念，整理笔记', difficulty: 2, minutes: 20 },
    { title: '数学应用题', subject: '数学', description: '完成5道应用题，要求写出算式和答句', difficulty: 4, minutes: 40 },
    { title: '语文造句练习', subject: '语文', description: '用指定词语造句，每个词语造2个句子', difficulty: 2, minutes: 15 },
    { title: '英语绘本阅读', subject: '英语', description: '阅读一本英语绘本，说出大意', difficulty: 2, minutes: 20 },
    { title: '数学图形练习', subject: '数学', description: '完成图形与几何相关练习', difficulty: 3, minutes: 25 },
    { title: '语文古诗背诵', subject: '语文', description: '背诵指定古诗，能默写', difficulty: 3, minutes: 20 },
    { title: '综合复习', subject: '其他', description: '复习本周所有科目重点内容', difficulty: 3, minutes: 45 },
    { title: '课外阅读', subject: '其他', description: '阅读课外书30分钟，记录好词好句', difficulty: 2, minutes: 30 },
  ]
  const stmt = s.prepare(
    'INSERT INTO task_templates (family_id, title, subject, description, difficulty, estimated_minutes, is_builtin, sort_order) VALUES (0, ?, ?, ?, ?, ?, 1, ?)'
  )
  templates.forEach((t, i) => {
    stmt.run(t.title, t.subject, t.description, t.difficulty, t.minutes, i)
  })
}

function seedQuizQuestions(s: any) {
  const jsonPath = path.join(process.cwd(), 'lib', 'quiz-questions.json')
  const quizQuestions: { subject: string; gmin: number; gmax: number; diff: number; q: string; a: string; b: string; c: string; d: string; correct: number; time: number; cat: string }[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const stmt = s.prepare(
    'INSERT INTO quiz_questions (subject, grade_min, grade_max, difficulty, question, option_a, option_b, option_c, option_d, correct_index, time_limit, category) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  )
  for (const q of quizQuestions) {
    stmt.run(q.subject, q.gmin, q.gmax, q.diff, q.q, q.a, q.b, q.c, q.d, q.correct, q.time, q.cat)
  }
}
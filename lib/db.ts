import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import * as schema from './schema'

const DB_PATH = path.join(process.cwd(), 'pokemon.db')

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('busy_timeout = 5000')

export const db = drizzle(sqlite, { schema })

// Initialize tables on first import
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

// ── New tables for full feature set ──────────────────────────────────────────

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
`)

// Run migrations for existing DBs
// Helper to safely add column (ignores "duplicate column name" errors from race conditions)
const safeAddColumn = (table: string, col: string, def: string) => {
  try { sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`) } catch {}
}

const runMigrations = () => {
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
  const questions = [
    // ══════════════════════════════════════════════════════════
    // ── 数学奥数 3-4年级 难度2（奥数入门）──────────────────────
    // ══════════════════════════════════════════════════════════
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '找规律：2, 6, 12, 20, ?, 42', a: '30', b: '28', c: '32', d: '26', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '用1、2、3、4四个数字组成最大的四位数减去最小的四位数等于？', a: '3087', b: '3078', c: '3333', d: '2222', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '一根绳子对折3次后剪一刀，能剪成几段？', a: '9段', b: '8段', c: '7段', d: '6段', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '鸡兔同笼：共10个头，26条腿，兔有几只？', a: '3', b: '4', c: '5', d: '6', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '一个数除以5余3，除以7余2，这个数最小是多少？', a: '23', b: '18', c: '33', d: '28', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '3个人3天修3米路，9个人9天修多少米路？', a: '27米', b: '9米', c: '81米', d: '18米', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '小明比爸爸小28岁，5年后爸爸的年龄是小明的3倍，小明今年几岁？', a: '9岁', b: '10岁', c: '8岁', d: '11岁', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '一只蜗牛从10米深的井底往上爬，白天爬3米，晚上滑2米，几天能出井？', a: '8天', b: '10天', c: '9天', d: '7天', correct: 0, time: 18, cat: '奥数' },
    // 新增 3-4年级 奥数
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '时钟3点整时，时针和分针成多少度角？', a: '90度', b: '60度', c: '120度', d: '180度', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '一个三角形三个内角之和是多少度？', a: '180度', b: '360度', c: '90度', d: '270度', correct: 0, time: 10, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '甲有36块糖，乙有12块糖，甲给乙多少块两人一样多？', a: '12块', b: '24块', c: '18块', d: '6块', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '把一张纸对折再对折，打开后有几个折痕？', a: '3个', b: '2个', c: '4个', d: '1个', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '10个小朋友站成一排，从左往右数小红排第4，从右往左数小红排第几？', a: '第7', b: '第6', c: '第8', d: '第5', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '一根铁丝围成正方形边长6cm，如果围成等边三角形边长是多少？', a: '8cm', b: '6cm', c: '10cm', d: '12cm', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '找规律：1, 1, 2, 3, 5, 8, ?', a: '13', b: '11', c: '12', d: '10', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '5只猫5分钟抓5只老鼠，100只猫100分钟抓多少只老鼠？', a: '2000只', b: '100只', c: '500只', d: '10000只', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '一个笼子里有若干只鸡和兔，共35个头，94条腿，兔有几只？', a: '12只', b: '23只', c: '15只', d: '10只', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 2, q: '把20分成两个数的和，使它们的积最大，这两个数分别是？', a: '10和10', b: '15和5', c: '12和8', d: '11和9', correct: 0, time: 15, cat: '奥数' },

    // ── 数学奥数 3-4年级 难度3（奥数进阶）──────────────────────
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '一个四位数ABAB能被7整除也能被13整除，这个四位数最小是？', a: '1001', b: '1313', c: '2002', d: '1414', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '有1分、2分、5分硬币共20枚合计40分，5分硬币最多有几枚？', a: '4枚', b: '6枚', c: '5枚', d: '3枚', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '甲乙丙三人年龄之和是42，甲比乙大4岁，乙比丙大2岁，丙几岁？', a: '12岁', b: '14岁', c: '10岁', d: '16岁', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '将1~10这10个数填入○中使等式成立：○+○+○+○+○=○+○+○+○+○，每边之和是？', a: '27.5', b: '27', c: '28', d: '25', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '一楼到五楼要走80级台阶，那一楼到十楼要走多少级？', a: '180级', b: '160级', c: '200级', d: '140级', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '甲乙二人分别从AB两地同时出发相向而行，第一次相遇时甲走了全程的2/5，两人各到对方出发点后返回，第二次相遇时甲又走了多少全程？', a: '4/5', b: '3/5', c: '1/2', d: '2/3', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '数列：3, 7, 15, 31, 63, 下一个数是？', a: '127', b: '95', c: '125', d: '100', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 3, gmax: 4, diff: 3, q: '一次考试共20题，做对一题得5分，做错一题扣2分，小明得了58分，他做对了几题？', a: '14题', b: '12题', c: '16题', d: '15题', correct: 0, time: 18, cat: '奥数' },

    // ══════════════════════════════════════════════════════════
    // ── 数学奥数 5-6年级 难度2（奥数基础）──────────────────────
    // ══════════════════════════════════════════════════════════
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '1+2+3+...+100 = ?', a: '5050', b: '5000', c: '5100', d: '4950', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '一个两位数，十位上的数是个位上的2倍，两数之和为9，这个数是？', a: '63', b: '42', c: '84', d: '36', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '甲比乙多25%，那乙比甲少百分之几？', a: '20%', b: '25%', c: '15%', d: '30%', correct: 0, time: 15, cat: '奥数' },
    // 新增 5-6年级 难度2 奥数
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '一个数除以3余1，除以5余2，除以7余3，这个数最小是？', a: '52', b: '37', c: '22', d: '67', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '三个连续偶数之和为78，中间那个数是？', a: '26', b: '24', c: '28', d: '30', correct: 0, time: 12, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '100以内所有3的倍数之和是多少？', a: '1683', b: '1650', c: '1700', d: '1600', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '一个长方形周长48cm，长是宽的2倍，面积是多少？', a: '128cm²', b: '96cm²', c: '144cm²', d: '64cm²', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '甲乙两人共有180元，甲给乙30元后两人一样多，甲原来有多少元？', a: '120元', b: '90元', c: '150元', d: '100元', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '从1到100的自然数中，数字"1"一共出现了多少次？', a: '21次', b: '20次', c: '19次', d: '11次', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '一批货物，第一天运走1/3，第二天运走余下的1/2，还剩全部的几分之几？', a: '1/3', b: '1/6', c: '1/4', d: '1/2', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 2, q: '一个正方体展开图有几个面？', a: '6个', b: '4个', c: '8个', d: '12个', correct: 0, time: 10, cat: '奥数' },

    // ── 数学奥数 5-6年级 难度3（奥数挑战）──────────────────────
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一列火车通过400米大桥用25秒，通过100米隧道用10秒，火车速度和车长？', a: '车长100米，速度20m/s', b: '车长50米，速度18m/s', c: '车长200米，速度25m/s', d: '车长150米，速度22m/s', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '甲乙两地相距360km，快车3小时到，慢车6小时到，相向而行几小时相遇？', a: '2小时', b: '3小时', c: '1.5小时', d: '4小时', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一个水池有进水管和排水管。单开进水管5小时灌满，单开排水管8小时排完。同时打开几小时灌满？', a: '40/3小时', b: '13小时', c: '10小时', d: '6.5小时', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '把1~9填入九宫格使每行每列对角线之和为15，中间那个数是？', a: '5', b: '4', c: '6', d: '3', correct: 0, time: 12, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '用6根火柴最多能摆成几个等边三角形？', a: '4个', b: '2个', c: '3个', d: '6个', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一堆苹果，第一天卖一半多1个，第二天卖余下一半多1个，还剩1个，原来多少个？', a: '10个', b: '8个', c: '12个', d: '9个', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一根木头锯成5段需要20分钟，锯成10段需要多少分钟？', a: '45分钟', b: '40分钟', c: '50分钟', d: '35分钟', correct: 0, time: 15, cat: '奥数' },
    // 新增 5-6年级 难度3 奥数
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一个数的3倍减去5等于这个数的2倍加上7，这个数是？', a: '12', b: '8', c: '10', d: '6', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '甲乙丙三人赛跑，甲跑100米的时间乙跑90米，乙跑100米的时间丙跑80米，甲跑100米时丙跑了多少米？', a: '72米', b: '70米', c: '80米', d: '75米', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '在100到999之间，各位数字之和为5的三位数有几个？', a: '15个', b: '10个', c: '12个', d: '20个', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一件工作甲单独做要10天，乙单独做要15天，两人合做几天完成？', a: '6天', b: '5天', c: '8天', d: '7天', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '把一个分数的分子加上3，分数值等于1/2；分母减去5，分数值等于1/3。原来的分数是？', a: '2/13', b: '3/10', c: '1/8', d: '4/15', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '有5个数的平均数是8，去掉一个数后平均数变为7，去掉的数是？', a: '12', b: '10', c: '11', d: '9', correct: 0, time: 15, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一个两位数，交换个位和十位上的数字后得到的新数比原数大27，原数个位与十位的差是？', a: '3', b: '2', c: '4', d: '5', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '在自然数1~100中，能被2或3整除但不能被6整除的数有几个？', a: '50个', b: '33个', c: '67个', d: '17个', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '甲乙两个水管同时开，6小时灌满水池。甲管单独开10小时灌满，乙管单独开几小时灌满？', a: '15小时', b: '12小时', c: '20小时', d: '18小时', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一列数：1/2, 2/3, 3/5, 5/8, 8/13, 下一个数是？', a: '13/21', b: '11/18', c: '10/15', d: '13/20', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '小明走一段路，去时速度4km/h，回来时速度6km/h，来回平均速度是多少？', a: '4.8km/h', b: '5km/h', c: '5.5km/h', d: '4.5km/h', correct: 0, time: 18, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一个圆形跑道周长400米，甲乙同时同地同向出发，甲速度5m/s，乙速度3m/s，几秒后第一次相遇？', a: '200秒', b: '100秒', c: '400秒', d: '133秒', correct: 0, time: 20, cat: '奥数' },
    { subject: '数学', gmin: 5, gmax: 6, diff: 3, q: '一个长方体，如果高增加2cm，就变成正方体，表面积增加了56cm²，原来长方体的表面积是？', a: '142cm²', b: '150cm²', c: '120cm²', d: '168cm²', correct: 0, time: 20, cat: '奥数' },

    // ══════════════════════════════════════════════════════════
    // ── 语文 3-4年级 难度1 ──────────────────────────────────
    // ══════════════════════════════════════════════════════════
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"守株待兔"这个成语的意思是？', a: '比喻不劳而获、心存侥幸', b: '守护兔子', c: '等待好运', d: '坚持不懈', correct: 0, time: 10, cat: '成语' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"春眠不觉晓"的下一句是？', a: '处处闻啼鸟', b: '花落知多少', c: '夜来风雨声', d: '春去花还在', correct: 0, time: 8, cat: '古诗' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"欲穷千里目"的下一句是？', a: '更上一层楼', b: '一览众山小', c: '白日依山尽', d: '黄河入海流', correct: 0, time: 8, cat: '古诗' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"画蛇添足"比喻什么？', a: '做了多余的事反而不好', b: '画画技术高超', c: '小心翼翼', d: '锦上添花', correct: 0, time: 10, cat: '成语' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"海"字的部首是什么？', a: '氵（三点水）', b: '每', c: '母', d: '亻', correct: 0, time: 8, cat: '汉字' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"举头望明月"的下一句是？', a: '低头思故乡', b: '疑是地上霜', c: '床前明月光', d: '遍插茱萸少一人', correct: 0, time: 8, cat: '古诗' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"望梅止渴"中的主人公是谁？', a: '曹操', b: '刘备', c: '诸葛亮', d: '孙权', correct: 0, time: 10, cat: '成语' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"千里之行"的下一句是？', a: '始于足下', b: '不积小流', c: '功在不舍', d: '在于坚持', correct: 0, time: 8, cat: '成语' },

    // ── 语文 3-4年级 难度2（阅读理解）──────────────────────────
    { subject: '语文', gmin: 3, gmax: 4, diff: 2, q: '"塞翁失马"的故事告诉我们什么道理？', a: '祸福可以互相转化', b: '丢了马很可惜', c: '要珍惜财物', d: '不要养马', correct: 0, time: 12, cat: '阅读理解' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 2, q: '"此地无银三百两"隐含的意思是？', a: '想隐瞒反而暴露了', b: '这里没有银子', c: '银子只有三百两', d: '地下有宝藏', correct: 0, time: 12, cat: '阅读理解' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 2, q: '"纸上谈兵"的赵括为什么失败了？', a: '只懂理论不懂实战', b: '兵力不够', c: '武器不好', d: '天气原因', correct: 0, time: 12, cat: '阅读理解' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 2, q: '下列哪个不是鲁迅先生的作品？', a: '《骆驼祥子》', b: '《朝花夕拾》', c: '《呐喊》', d: '《故乡》', correct: 0, time: 12, cat: '文学' },

    // ── 语文 5-6年级 难度2 ──────────────────────────────────
    { subject: '语文', gmin: 5, gmax: 6, diff: 2, q: '"山重水复疑无路"的下一句是？', a: '柳暗花明又一村', b: '轻舟已过万重山', c: '一片孤城万仞山', d: '烟花三月下扬州', correct: 0, time: 8, cat: '古诗' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 2, q: '"沁园春·雪"的作者是？', a: '毛泽东', b: '苏轼', c: '辛弃疾', d: '李白', correct: 0, time: 8, cat: '文学' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 2, q: '"感时花溅泪，恨别鸟惊心"运用了什么修辞手法？', a: '拟人', b: '比喻', c: '夸张', d: '排比', correct: 0, time: 12, cat: '修辞' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 2, q: '"不入虎穴，焉得虎子"表达的意思是？', a: '不冒险就不能取得成功', b: '不能去危险的地方', c: '老虎很危险', d: '要保护虎子', correct: 0, time: 10, cat: '阅读理解' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 2, q: '《水浒传》中外号"智多星"的是？', a: '吴用', b: '宋江', c: '林冲', d: '武松', correct: 0, time: 10, cat: '文学' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 2, q: '下列句子中，"把"字句使用正确的是？', a: '他把作业做完了', b: '他把很高兴', c: '作业把他做', d: '把天气很好', correct: 0, time: 10, cat: '语法' },

    // ── 语文 5-6年级 难度3（深度阅读理解）──────────────────────
    { subject: '语文', gmin: 5, gmax: 6, diff: 3, q: '"世界上最远的距离，不是生与死，而是我站在你面前，你却不知道我爱你。"这句话运用了什么手法？', a: '对比/反衬', b: '比喻', c: '排比', d: '夸张', correct: 0, time: 15, cat: '阅读理解' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 3, q: '"出师未捷身先死，长使英雄泪满襟"写的是谁？', a: '诸葛亮', b: '关羽', c: '岳飞', d: '曹操', correct: 0, time: 12, cat: '古诗' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 3, q: '《西游记》中"三打白骨精"体现了孙悟空什么品质？', a: '明辨是非、坚持正义', b: '武功高强', c: '脾气暴躁', d: '不听师命', correct: 0, time: 15, cat: '阅读理解' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 3, q: '"横看成岭侧成峰"说明了什么哲理？', a: '看问题的角度不同结论不同', b: '山很高', c: '要多爬山', d: '庐山很美', correct: 0, time: 12, cat: '阅读理解' },

    // ── 科学 3-4年级 难度1 ──────────────────────────────────
    { subject: '科学', gmin: 3, gmax: 4, diff: 1, q: '水的三种状态是？', a: '固态、液态、气态', b: '冷、热、温', c: '干、湿、冰', d: '快、慢、停', correct: 0, time: 10, cat: '物理' },
    { subject: '科学', gmin: 3, gmax: 4, diff: 1, q: '植物通过什么进行光合作用？', a: '叶子', b: '根', c: '花', d: '果实', correct: 0, time: 8, cat: '生物' },
    { subject: '科学', gmin: 3, gmax: 4, diff: 1, q: '地球绕太阳公转一圈需要多长时间？', a: '一年', b: '一天', c: '一个月', d: '一周', correct: 0, time: 8, cat: '天文' },
    { subject: '科学', gmin: 3, gmax: 4, diff: 1, q: '磁铁同极相遇会怎样？', a: '互相排斥', b: '互相吸引', c: '没有反应', d: '消失', correct: 0, time: 8, cat: '物理' },
    { subject: '科学', gmin: 3, gmax: 4, diff: 1, q: '人体最大的器官是什么？', a: '皮肤', b: '心脏', c: '肝脏', d: '肺', correct: 0, time: 8, cat: '生物' },

    // ── 科学 5-6年级 难度2 ──────────────────────────────────
    { subject: '科学', gmin: 5, gmax: 6, diff: 2, q: '声音在哪种介质中传播最快？', a: '固体', b: '液体', c: '气体', d: '真空', correct: 0, time: 10, cat: '物理' },
    { subject: '科学', gmin: 5, gmax: 6, diff: 2, q: '月食发生时，地球在太阳和月球之间的什么位置？', a: '中间', b: '最远处', c: '旁边', d: '上方', correct: 0, time: 12, cat: '天文' },
    { subject: '科学', gmin: 5, gmax: 6, diff: 2, q: '以下哪种能源是可再生的？', a: '太阳能', b: '煤炭', c: '石油', d: '天然气', correct: 0, time: 10, cat: '常识' },
    { subject: '科学', gmin: 5, gmax: 6, diff: 2, q: '杠杆原理中，要省力应该把支点放在哪里？', a: '靠近重物', b: '靠近手', c: '中间', d: '最远处', correct: 0, time: 12, cat: '物理' },
    { subject: '科学', gmin: 5, gmax: 6, diff: 2, q: '人体血液循环的中心器官是？', a: '心脏', b: '大脑', c: '肝脏', d: '肺', correct: 0, time: 8, cat: '生物' },
    { subject: '科学', gmin: 5, gmax: 6, diff: 2, q: '彩虹是由什么现象形成的？', a: '光的折射和反射', b: '光的直线传播', c: '光的吸收', d: '光的衍射', correct: 0, time: 10, cat: '物理' },

    // ── 语文 补充题──────────────────────────────────
    { subject: '语文', gmin: 3, gmax: 6, diff: 1, q: '"日出江花红胜火"的下一句是？', a: '春来江水绿如蓝', b: '能不忆江南', c: '风景旧曾谙', d: '江南好', correct: 0, time: 8, cat: '古诗' },
    { subject: '语文', gmin: 3, gmax: 6, diff: 1, q: '"破釜沉舟"的主人公是谁？', a: '项羽', b: '刘邦', c: '韩信', d: '张良', correct: 0, time: 10, cat: '成语' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 2, q: '"但愿人长久，千里共婵娟"中"婵娟"指的是？', a: '月亮', b: '美女', c: '太阳', d: '星星', correct: 0, time: 10, cat: '古诗' },
    { subject: '语文', gmin: 5, gmax: 6, diff: 3, q: '鲁迅说"横眉冷对千夫指，俯首甘为孺子牛"，"孺子牛"体现了什么精神？', a: '甘愿为人民服务的精神', b: '耕牛精神', c: '反抗精神', d: '谦虚谨慎', correct: 0, time: 15, cat: '阅读理解' },
    { subject: '语文', gmin: 4, gmax: 6, diff: 2, q: '"刻舟求剑"讽刺的是什么人？', a: '不知变通的人', b: '爱护武器的人', c: '善于思考的人', d: '勤劳勇敢的人', correct: 0, time: 10, cat: '阅读理解' },
    { subject: '语文', gmin: 3, gmax: 4, diff: 1, q: '"两岸猿声啼不住"的下一句是？', a: '轻舟已过万重山', b: '千里江陵一日还', c: '朝辞白帝彩云间', d: '黄河之水天上来', correct: 0, time: 8, cat: '古诗' },
  ]

  const stmt = s.prepare(
    'INSERT INTO quiz_questions (subject, grade_min, grade_max, difficulty, question, option_a, option_b, option_c, option_d, correct_index, time_limit, category) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  )
  for (const q of questions) {
    stmt.run(q.subject, q.gmin, q.gmax, q.diff, q.q, q.a, q.b, q.c, q.d, q.correct, q.time, q.cat)
  }
}

runMigrations()

export default db

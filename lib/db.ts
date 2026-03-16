import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import * as schema from './schema'

const DB_PATH = path.join(process.cwd(), 'pokemon.db')

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

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
`)

// Run migrations for existing DBs
const runMigrations = () => {
  // tasks: add last_updated
  const taskCols = (sqlite.prepare(`PRAGMA table_info(tasks)`).all() as {name:string}[]).map(c => c.name)
  if (!taskCols.includes('last_updated')) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN last_updated TEXT NOT NULL DEFAULT '2024-01-01T00:00:00.000Z'`)
    sqlite.exec(`UPDATE tasks SET last_updated = created_at WHERE last_updated = '2024-01-01T00:00:00.000Z'`)
  }
  if (!taskCols.includes('is_weekend_challenge')) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN is_weekend_challenge INTEGER NOT NULL DEFAULT 0`)
  }
  if (!taskCols.includes('task_type')) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'regular'`)
  }

  // pokemons: add streak_days, last_checkin_date, evolution_stage
  const pokeCols = (sqlite.prepare(`PRAGMA table_info(pokemons)`).all() as {name:string}[]).map(c => c.name)
  if (!pokeCols.includes('streak_days')) {
    sqlite.exec(`ALTER TABLE pokemons ADD COLUMN streak_days INTEGER NOT NULL DEFAULT 0`)
  }
  if (!pokeCols.includes('last_checkin_date')) {
    sqlite.exec(`ALTER TABLE pokemons ADD COLUMN last_checkin_date TEXT`)
  }
  if (!pokeCols.includes('evolution_stage')) {
    sqlite.exec(`ALTER TABLE pokemons ADD COLUMN evolution_stage INTEGER NOT NULL DEFAULT 1`)
  }
  if (!pokeCols.includes('max_streak')) {
    sqlite.exec(`ALTER TABLE pokemons ADD COLUMN max_streak INTEGER NOT NULL DEFAULT 0`)
  }

  // users: add password_hash, email, phone, avatar
  const userCols = (sqlite.prepare(`PRAGMA table_info(users)`).all() as {name:string}[]).map(c => c.name)
  if (!userCols.includes('password_hash')) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`)
  }
  if (!userCols.includes('avatar')) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`)
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
}

function seedAchievements(s: any) {
  const achievements = [
    // 学习习惯类
    { id: 'streak_3', title: '初露锋芒', description: '连续打卡3天', category: 'habit', icon: '🔥', tier: 1, condition_type: 'streak', condition_value: 3 },
    { id: 'streak_7', title: '一周坚持', description: '连续打卡7天', category: 'habit', icon: '🔥', tier: 2, condition_type: 'streak', condition_value: 7 },
    { id: 'streak_14', title: '半月达人', description: '连续打卡14天', category: 'habit', icon: '🔥', tier: 2, condition_type: 'streak', condition_value: 14 },
    { id: 'streak_30', title: '月度之星', description: '连续打卡30天', category: 'habit', icon: '🌟', tier: 3, condition_type: 'streak', condition_value: 30 },
    { id: 'streak_60', title: '学习大师', description: '连续打卡60天', category: 'habit', icon: '👑', tier: 4, condition_type: 'streak', condition_value: 60 },
    { id: 'tasks_5', title: '小小学者', description: '累计完成5个任务', category: 'habit', icon: '📚', tier: 1, condition_type: 'total_tasks', condition_value: 5 },
    { id: 'tasks_20', title: '勤奋学子', description: '累计完成20个任务', category: 'habit', icon: '📚', tier: 2, condition_type: 'total_tasks', condition_value: 20 },
    { id: 'tasks_50', title: '知识达人', description: '累计完成50个任务', category: 'habit', icon: '📚', tier: 3, condition_type: 'total_tasks', condition_value: 50 },
    { id: 'tasks_100', title: '百题勇士', description: '累计完成100个任务', category: 'habit', icon: '🏆', tier: 4, condition_type: 'total_tasks', condition_value: 100 },
    { id: 'perfect_3', title: '三连优秀', description: '连续3次获得满分', category: 'habit', icon: '⭐', tier: 2, condition_type: 'perfect_streak', condition_value: 3 },
    { id: 'perfect_5', title: '五星学霸', description: '连续5次获得满分', category: 'habit', icon: '💫', tier: 3, condition_type: 'perfect_streak', condition_value: 5 },
    { id: 'early_bird', title: '早起的鸟儿', description: '在早上8点前完成任务', category: 'habit', icon: '🐦', tier: 1, condition_type: 'early_complete', condition_value: 1 },
    // 学科均衡类
    { id: 'chinese_10', title: '语文小达人', description: '完成10个语文任务', category: 'subject', icon: '📖', tier: 2, condition_type: 'subject_chinese', condition_value: 10 },
    { id: 'math_10', title: '数学小天才', description: '完成10个数学任务', category: 'subject', icon: '🔢', tier: 2, condition_type: 'subject_math', condition_value: 10 },
    { id: 'english_10', title: '英语小能手', description: '完成10个英语任务', category: 'subject', icon: '🔤', tier: 2, condition_type: 'subject_english', condition_value: 10 },
    { id: 'science_5', title: '科学探索家', description: '完成5个科学任务', category: 'subject', icon: '🔬', tier: 2, condition_type: 'subject_science', condition_value: 5 },
    { id: 'all_subjects', title: '全面发展', description: '每个科目至少完成3个任务', category: 'subject', icon: '🌈', tier: 3, condition_type: 'all_subjects_3', condition_value: 3 },
    { id: 'balance_master', title: '均衡大师', description: '单周内每科至少完成1个任务', category: 'subject', icon: '⚖️', tier: 3, condition_type: 'weekly_balance', condition_value: 1 },
    // 宝可梦养成类
    { id: 'first_evolution', title: '首次进化', description: '宝可梦第一次进化', category: 'pokemon', icon: '✨', tier: 2, condition_type: 'evolution', condition_value: 1 },
    { id: 'second_evolution', title: '终极形态', description: '宝可梦第二次进化', category: 'pokemon', icon: '🌟', tier: 4, condition_type: 'evolution', condition_value: 2 },
    { id: 'level_10', title: '初阶伙伴', description: '宝可梦达到10级', category: 'pokemon', icon: '⬆️', tier: 2, condition_type: 'level', condition_value: 10 },
    { id: 'level_20', title: '进阶伙伴', description: '宝可梦达到20级', category: 'pokemon', icon: '⬆️', tier: 3, condition_type: 'level', condition_value: 20 },
    { id: 'max_vitality', title: '体力满格', description: '体力值达到100', category: 'pokemon', icon: '❤️', tier: 2, condition_type: 'max_vitality', condition_value: 100 },
    { id: 'max_wisdom', title: '智慧满格', description: '智慧值达到100', category: 'pokemon', icon: '💡', tier: 2, condition_type: 'max_wisdom', condition_value: 100 },
    { id: 'max_affection', title: '亲密满格', description: '亲密度达到100', category: 'pokemon', icon: '💕', tier: 2, condition_type: 'max_affection', condition_value: 100 },
    { id: 'all_max', title: '完美状态', description: '三项属性同时满格', category: 'pokemon', icon: '👑', tier: 4, condition_type: 'all_max', condition_value: 100 },
    { id: 'feed_20', title: '贴心主人', description: '喂养宝可梦20次', category: 'pokemon', icon: '🍖', tier: 2, condition_type: 'feed_count', condition_value: 20 },
    { id: 'feed_50', title: '最佳伙伴', description: '喂养宝可梦50次', category: 'pokemon', icon: '🍖', tier: 3, condition_type: 'feed_count', condition_value: 50 },
    // 时间管理类
    { id: 'plan_first', title: '小小规划师', description: '第一次使用时间规划', category: 'time', icon: '🗓️', tier: 1, condition_type: 'plan_count', condition_value: 1 },
    { id: 'plan_7', title: '规划达人', description: '使用时间规划7天', category: 'time', icon: '🗓️', tier: 2, condition_type: 'plan_count', condition_value: 7 },
    { id: 'weekend_first', title: '周末勇士', description: '完成第一个周末挑战', category: 'time', icon: '🏔️', tier: 2, condition_type: 'weekend_challenge', condition_value: 1 },
    { id: 'weekend_4', title: '挑战达人', description: '完成4个周末挑战', category: 'time', icon: '🏔️', tier: 3, condition_type: 'weekend_challenge', condition_value: 4 },
    // 收集类
    { id: 'collect_items_50', title: '小收藏家', description: '累计获得50个道具', category: 'collect', icon: '🎒', tier: 1, condition_type: 'total_items', condition_value: 50 },
    { id: 'collect_items_200', title: '大收藏家', description: '累计获得200个道具', category: 'collect', icon: '🎒', tier: 3, condition_type: 'total_items', condition_value: 200 },
    { id: 'decorate_first', title: '小屋设计师', description: '第一次装饰小屋', category: 'collect', icon: '🏠', tier: 1, condition_type: 'decorate_count', condition_value: 1 },
    { id: 'decorate_10', title: '装饰大师', description: '购买10个装饰品', category: 'collect', icon: '🏠', tier: 3, condition_type: 'decorate_count', condition_value: 10 },
  ]
  const stmt = s.prepare('INSERT OR IGNORE INTO achievements (id,title,description,category,icon,tier,condition_type,condition_value) VALUES (?,?,?,?,?,?,?,?)')
  for (const a of achievements) {
    stmt.run(a.id, a.title, a.description, a.category, a.icon, a.tier, a.condition_type, a.condition_value)
  }
}

function seedDecorations(s: any) {
  const decorations = [
    // 家具
    { id: 'bed_basic', name: '基础小床', category: 'furniture', price: 5, icon: '🛏️', description: '一张温暖的小床', rarity: 'common' },
    { id: 'bed_fancy', name: '豪华大床', category: 'furniture', price: 20, icon: '🛏️', description: '宝可梦最爱的豪华床', rarity: 'rare' },
    { id: 'desk_study', name: '学习书桌', category: 'furniture', price: 10, icon: '📝', description: '一起学习的好地方', rarity: 'common' },
    { id: 'bookshelf', name: '知识书架', category: 'furniture', price: 15, icon: '📚', description: '装满知识的书架', rarity: 'uncommon' },
    { id: 'sofa_comfy', name: '舒适沙发', category: 'furniture', price: 12, icon: '🛋️', description: '休息时的好伙伴', rarity: 'common' },
    { id: 'lamp_star', name: '星星灯', category: 'furniture', price: 8, icon: '💡', description: '闪闪发光的星星灯', rarity: 'common' },
    { id: 'wardrobe', name: '大衣柜', category: 'furniture', price: 18, icon: '🚪', description: '收纳宝可梦的衣服', rarity: 'uncommon' },
    { id: 'piano', name: '小钢琴', category: 'furniture', price: 30, icon: '🎹', description: '可以弹奏美妙音乐', rarity: 'rare' },
    // 地板
    { id: 'floor_wood', name: '原木地板', category: 'floor', price: 8, icon: '🟫', description: '温暖的木质地板', rarity: 'common' },
    { id: 'floor_grass', name: '草地地板', category: 'floor', price: 10, icon: '🟩', description: '像户外一样的草地', rarity: 'common' },
    { id: 'floor_cloud', name: '云朵地板', category: 'floor', price: 25, icon: '☁️', description: '走在云端的感觉', rarity: 'rare' },
    { id: 'floor_star', name: '星空地板', category: 'floor', price: 35, icon: '🌌', description: '像走在星空中', rarity: 'epic' },
    // 墙壁装饰
    { id: 'poster_pikachu', name: '皮卡丘海报', category: 'wall', price: 5, icon: '🖼️', description: '可爱的皮卡丘海报', rarity: 'common' },
    { id: 'poster_badge', name: '徽章展示墙', category: 'wall', price: 15, icon: '🏅', description: '展示你的成就徽章', rarity: 'uncommon' },
    { id: 'clock_pokeball', name: '精灵球时钟', category: 'wall', price: 12, icon: '⏰', description: '精灵球造型的时钟', rarity: 'uncommon' },
    { id: 'window_garden', name: '花园窗户', category: 'wall', price: 20, icon: '🪟', description: '可以看到花园的窗户', rarity: 'rare' },
    // 玩具
    { id: 'toy_ball', name: '精灵球', category: 'toy', price: 3, icon: '🔴', description: '经典的精灵球', rarity: 'common' },
    { id: 'toy_doll', name: '宝可梦玩偶', category: 'toy', price: 8, icon: '🧸', description: '可爱的宝可梦玩偶', rarity: 'common' },
    { id: 'toy_puzzle', name: '智力拼图', category: 'toy', price: 10, icon: '🧩', description: '锻炼思维的拼图', rarity: 'uncommon' },
    { id: 'toy_telescope', name: '迷你望远镜', category: 'toy', price: 18, icon: '🔭', description: '可以看到很远的地方', rarity: 'rare' },
    // 植物
    { id: 'plant_flower', name: '小花盆', category: 'plant', price: 5, icon: '🌸', description: '美丽的小花', rarity: 'common' },
    { id: 'plant_tree', name: '迷你树', category: 'plant', price: 12, icon: '🌳', description: '一棵小小的树', rarity: 'uncommon' },
    { id: 'plant_cactus', name: '仙人掌', category: 'plant', price: 6, icon: '🌵', description: '坚韧的仙人掌', rarity: 'common' },
    { id: 'plant_bamboo', name: '幸运竹', category: 'plant', price: 15, icon: '🎋', description: '带来好运的竹子', rarity: 'uncommon' },
    // 室外
    { id: 'outdoor_swing', name: '秋千', category: 'outdoor', price: 20, icon: '🪢', description: '快乐的秋千', rarity: 'rare' },
    { id: 'outdoor_pool', name: '小水池', category: 'outdoor', price: 25, icon: '🏊', description: '可以玩水的小池', rarity: 'rare' },
    { id: 'outdoor_tent', name: '帐篷', category: 'outdoor', price: 15, icon: '⛺', description: '户外露营帐篷', rarity: 'uncommon' },
    { id: 'outdoor_fountain', name: '喷泉', category: 'outdoor', price: 40, icon: '⛲', description: '华丽的喷泉', rarity: 'epic' },
  ]
  const stmt = s.prepare('INSERT OR IGNORE INTO decorations (id,name,category,price,icon,description,rarity) VALUES (?,?,?,?,?,?,?)')
  for (const d of decorations) {
    stmt.run(d.id, d.name, d.category, d.price, d.icon, d.description, d.rarity)
  }
}

runMigrations()

export default db

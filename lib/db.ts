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

runMigrations()

export default db

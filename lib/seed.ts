import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'pokemon.db')
const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')

// Create tables
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

// Check if seed data already exists
const existingUsers = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
if (existingUsers.count === 0) {
  console.log('Seeding database...')

  // Insert family members
  const insertUser = sqlite.prepare(
    'INSERT INTO users (name, role, family_id) VALUES (?, ?, ?)'
  )

  const parentResult = insertUser.run('妈妈', 'parent', 1)
  const childResult = insertUser.run('小明', 'child', 1)

  const parentId = parentResult.lastInsertRowid as number
  const childId = childResult.lastInsertRowid as number

  // Insert Pikachu for child
  sqlite.prepare(
    'INSERT INTO pokemons (child_id, species_id, name, vitality, wisdom, affection, level) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(childId, 25, '皮卡丘', 70, 65, 75, 5)

  // Initialize inventory
  const insertInventory = sqlite.prepare(
    'INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)'
  )
  insertInventory.run(childId, 'food', 5)
  insertInventory.run(childId, 'crystal', 2)
  insertInventory.run(childId, 'candy', 3)
  insertInventory.run(childId, 'fragment', 1)

  // Insert sample tasks
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)

  const insertTask = sqlite.prepare(
    'INSERT INTO tasks (family_id, created_by, title, subject, description, difficulty, estimated_minutes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )

  insertTask.run(
    1, parentId,
    '完成数学练习册第15页',
    '数学',
    '完成加减法混合运算练习，共20道题，要求书写整齐',
    3, 30,
    tomorrow.toISOString().split('T')[0]
  )

  insertTask.run(
    1, parentId,
    '朗读语文课文并背诵',
    '语文',
    '朗读《春晓》和《静夜思》各三遍，尝试背诵其中一首',
    2, 20,
    dayAfter.toISOString().split('T')[0]
  )

  console.log('Seed data inserted successfully!')
  console.log(`Parent ID: ${parentId}, Child ID: ${childId}`)
} else {
  console.log('Database already seeded, skipping...')
}

sqlite.close()
console.log('Done!')

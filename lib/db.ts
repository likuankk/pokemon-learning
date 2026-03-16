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

// Run migrations for existing DBs
const runMigrations = () => {
  const cols = (sqlite.prepare(`PRAGMA table_info(tasks)`).all() as {name:string}[]).map(c => c.name)
  if (!cols.includes('last_updated')) {
    // SQLite ALTER TABLE doesn't support datetime() as default — use a literal string
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN last_updated TEXT NOT NULL DEFAULT '2024-01-01T00:00:00.000Z'`)
    // Back-fill existing rows with their created_at value
    sqlite.exec(`UPDATE tasks SET last_updated = created_at WHERE last_updated = '2024-01-01T00:00:00.000Z'`)
  }
}
runMigrations()

export default db

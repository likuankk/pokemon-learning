import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'parent' | 'child'
  familyId: integer('family_id').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const pokemons = sqliteTable('pokemons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  speciesId: integer('species_id').notNull(),
  name: text('name').notNull(),
  vitality: real('vitality').notNull().default(60),    // 体力
  wisdom: real('wisdom').notNull().default(60),         // 智慧
  affection: real('affection').notNull().default(60),   // 亲密度
  level: integer('level').notNull().default(1),
  lastUpdated: text('last_updated').notNull().default(new Date().toISOString()),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  familyId: integer('family_id').notNull(),
  createdBy: integer('created_by').notNull(),
  title: text('title').notNull(),
  subject: text('subject').notNull(), // '语文'|'数学'|'英语'|'科学'|'其他'
  description: text('description'),
  difficulty: integer('difficulty').notNull().default(3), // 1-5
  estimatedMinutes: integer('estimated_minutes').notNull().default(30),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('pending'), // pending|submitted|approved|partial|rejected
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull(),
  childId: integer('child_id').notNull(),
  submittedAt: text('submitted_at').notNull().default(new Date().toISOString()),
  reviewStatus: text('review_status').notNull().default('pending'), // pending|approved|partial|rejected
  reviewComment: text('review_comment'),
  qualityScore: integer('quality_score'), // 1-5
  reviewedAt: text('reviewed_at'),
})

export const inventory = sqliteTable('inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  itemType: text('item_type').notNull(), // food|crystal|candy|fragment
  quantity: real('quantity').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

export type User = typeof users.$inferSelect
export type Pokemon = typeof pokemons.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Submission = typeof submissions.$inferSelect
export type InventoryItem = typeof inventory.$inferSelect

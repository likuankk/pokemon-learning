import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ── Core tables ─────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'parent' | 'child'
  familyId: integer('family_id').notNull(),
  passwordHash: text('password_hash'),
  avatar: text('avatar'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const pokemons = sqliteTable('pokemons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  speciesId: integer('species_id').notNull(),
  name: text('name').notNull(),
  vitality: real('vitality').notNull().default(60),
  wisdom: real('wisdom').notNull().default(60),
  affection: real('affection').notNull().default(60),
  level: integer('level').notNull().default(1),
  streakDays: integer('streak_days').notNull().default(0),
  maxStreak: integer('max_streak').notNull().default(0),
  lastCheckinDate: text('last_checkin_date'),
  evolutionStage: integer('evolution_stage').notNull().default(1),
  lastUpdated: text('last_updated').notNull().default(new Date().toISOString()),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  familyId: integer('family_id').notNull(),
  createdBy: integer('created_by').notNull(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  description: text('description'),
  difficulty: integer('difficulty').notNull().default(3),
  estimatedMinutes: integer('estimated_minutes').notNull().default(30),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('pending'),
  taskType: text('task_type').notNull().default('regular'),
  isWeekendChallenge: integer('is_weekend_challenge').notNull().default(0),
  lastUpdated: text('last_updated').notNull().default(new Date().toISOString()),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull(),
  childId: integer('child_id').notNull(),
  submittedAt: text('submitted_at').notNull().default(new Date().toISOString()),
  reviewStatus: text('review_status').notNull().default('pending'),
  reviewComment: text('review_comment'),
  qualityScore: integer('quality_score'),
  reviewedAt: text('reviewed_at'),
})

export const inventory = sqliteTable('inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  itemType: text('item_type').notNull(),
  quantity: real('quantity').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

// ── Achievement system ──────────────────────────────────────────────────────

export const achievements = sqliteTable('achievements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  icon: text('icon').notNull().default('🏅'),
  tier: integer('tier').notNull().default(1),
  conditionType: text('condition_type').notNull(),
  conditionValue: integer('condition_value').notNull().default(1),
})

export const childAchievements = sqliteTable('child_achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  achievementId: text('achievement_id').notNull(),
  unlockedAt: text('unlocked_at').notNull().default(new Date().toISOString()),
})

// ── House decoration system ─────────────────────────────────────────────────

export const decorations = sqliteTable('decorations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  price: integer('price').notNull().default(10),
  icon: text('icon').notNull().default('🪑'),
  description: text('description'),
  rarity: text('rarity').notNull().default('common'),
})

export const houseItems = sqliteTable('house_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  decorationId: text('decoration_id').notNull(),
  placed: integer('placed').notNull().default(0),
  slot: text('slot'),
  purchasedAt: text('purchased_at').notNull().default(new Date().toISOString()),
})

// ── Notification system ─────────────────────────────────────────────────────

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: integer('read').notNull().default(0),
  data: text('data'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ── Pokemon letter system ───────────────────────────────────────────────────

export const pokemonLetters = sqliteTable('pokemon_letters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  content: text('content').notNull(),
  weekStart: text('week_start').notNull(),
  read: integer('read').notNull().default(0),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ── Weekend challenge system ────────────────────────────────────────────────

export const weekendChallenges = sqliteTable('weekend_challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  familyId: integer('family_id').notNull(),
  taskId: integer('task_id'),
  challengeType: text('challenge_type').notNull(),
  bonusMultiplier: real('bonus_multiplier').notNull().default(1.5),
  weekendDate: text('weekend_date').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ── Anti-addiction system ───────────────────────────────────────────────────

export const sessionLogs = sqliteTable('session_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  startedAt: text('started_at').notNull().default(new Date().toISOString()),
  endedAt: text('ended_at'),
  durationSeconds: integer('duration_seconds').notNull().default(0),
})

export const familySettings = sqliteTable('family_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  familyId: integer('family_id').notNull(),
  curfewStart: integer('curfew_start').notNull().default(21),
  curfewEnd: integer('curfew_end').notNull().default(7),
  warningMinutes: integer('warning_minutes').notNull().default(20),
  limitMinutes: integer('limit_minutes').notNull().default(30),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

// ── Honor & stats ───────────────────────────────────────────────────────────

export const honorRecords = sqliteTable('honor_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  metric: text('metric').notNull(),
  value: real('value').notNull().default(0),
  period: text('period').notNull(),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

// ── Onboarding ──────────────────────────────────────────────────────────────

export const onboarding = sqliteTable('onboarding', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  completed: integer('completed').notNull().default(0),
  currentStep: integer('current_step').notNull().default(0),
  data: text('data'),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

// ── Evolution system ────────────────────────────────────────────────────────

export const discoveredSpecies = sqliteTable('discovered_species', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  speciesId: integer('species_id').notNull(),
  discoveredAt: text('discovered_at').notNull().default(new Date().toISOString()),
})

export const evolutionHistory = sqliteTable('evolution_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  fromSpeciesId: integer('from_species_id').notNull(),
  toSpeciesId: integer('to_species_id').notNull(),
  fromStage: integer('from_stage').notNull(),
  toStage: integer('to_stage').notNull(),
  evolvedAt: text('evolved_at').notNull().default(new Date().toISOString()),
})

// ── Planner system ──────────────────────────────────────────────────────────

export const dailyPlans = sqliteTable('daily_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull(),
  planDate: text('plan_date').notNull(),
  slot: text('slot').notNull(),
  taskId: integer('task_id').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ── Type exports ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type Pokemon = typeof pokemons.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Submission = typeof submissions.$inferSelect
export type InventoryItem = typeof inventory.$inferSelect
export type Achievement = typeof achievements.$inferSelect
export type ChildAchievement = typeof childAchievements.$inferSelect
export type Decoration = typeof decorations.$inferSelect
export type HouseItem = typeof houseItems.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type PokemonLetter = typeof pokemonLetters.$inferSelect
export type WeekendChallenge = typeof weekendChallenges.$inferSelect
export type SessionLog = typeof sessionLogs.$inferSelect
export type FamilySetting = typeof familySettings.$inferSelect
export type HonorRecord = typeof honorRecords.$inferSelect
export type Onboarding = typeof onboarding.$inferSelect
export type DiscoveredSpecies = typeof discoveredSpecies.$inferSelect
export type EvolutionHistoryRecord = typeof evolutionHistory.$inferSelect
export type DailyPlan = typeof dailyPlans.$inferSelect

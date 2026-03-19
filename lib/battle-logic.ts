// ── Battle System Logic ─────────────────────────────────────────────────────
// Core battle engine: type effectiveness, damage calculation, wild Pokemon
// generation, AI strategy, capture probability, exp/level system.

// ── Type Effectiveness ──────────────────────────────────────────────────────

export type PokemonType = 'fire' | 'water' | 'grass' | 'electric' | 'ground' | 'ice' | 'flying' | 'bug' | 'normal' | 'fairy'

// 1.5x = super effective, 0.67x = not effective, 1.0 = neutral
const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  fire:     { grass: 1.5, ice: 1.5, water: 0.67, ground: 0.67 },
  water:    { fire: 1.5, ground: 1.5, grass: 0.67, electric: 0.67 },
  grass:    { water: 1.5, ground: 1.5, fire: 0.67, ice: 0.67 },
  electric: { water: 1.5, flying: 1.5, ground: 0.67 },
  ground:   { fire: 1.5, electric: 1.5, water: 0.67, grass: 0.67 },
  ice:      { grass: 1.5, flying: 1.5, fire: 0.67, ground: 0.67 },
  flying:   { grass: 1.5, bug: 1.5, electric: 0.67, ice: 0.67 },
  bug:      { grass: 1.5, fire: 0.67, flying: 0.67 },
  normal:   {},
  fairy:    { bug: 1.5, ice: 0.67 },
}

export function getTypeEffectiveness(attackType: PokemonType, defType1: PokemonType, defType2?: PokemonType | null): number {
  let mult = TYPE_CHART[attackType]?.[defType1] ?? 1.0
  if (defType2) {
    mult *= (TYPE_CHART[attackType]?.[defType2 as PokemonType] ?? 1.0)
  }
  return mult
}

export function getEffectivenessLabel(mult: number): 'super_effective' | 'not_effective' | 'normal' {
  if (mult > 1.2) return 'super_effective'
  if (mult < 0.8) return 'not_effective'
  return 'normal'
}

export const TYPE_EMOJI: Record<PokemonType, string> = {
  fire: '🔥', water: '💧', grass: '🌿', electric: '⚡', ground: '🌍',
  ice: '❄️', flying: '🪽', bug: '🐛', normal: '⭐', fairy: '🧚',
}

export const TYPE_NAMES: Record<PokemonType, string> = {
  fire: '火', water: '水', grass: '草', electric: '电', ground: '地',
  ice: '冰', flying: '飞', bug: '虫', normal: '一般', fairy: '妖精',
}

// ── Stat Formulas ───────────────────────────────────────────────────────────

export function calcBattlePower(basePower: number, battleLevel: number): number {
  return Math.round(basePower * (1 + (battleLevel - 1) * 0.08) * 10) / 10
}

export function calcDefense(basePower: number, battleLevel: number): number {
  return Math.round(basePower * 1.0 * (1 + (battleLevel - 1) * 0.08) * 10) / 10
}

export function calcHP(basePower: number, battleLevel: number): number {
  return Math.round(basePower * 3.5 * (1 + (battleLevel - 1) * 0.12) * 10) / 10
}

// ── Battle Level / Exp ──────────────────────────────────────────────────────

export function expForLevel(level: number): number {
  // Exp needed to go from `level` to `level+1`
  return 20 + (level - 1) * 15
}

export function battleExpGain(wildLevel: number): number {
  return 10 + wildLevel * 2
}

export function checkBattleLevelUp(currentLevel: number, currentExp: number): { newLevel: number; newExp: number; levelsGained: number } {
  let level = currentLevel
  let exp = currentExp
  let gained = 0
  while (exp >= expForLevel(level)) {
    exp -= expForLevel(level)
    level++
    gained++
  }
  return { newLevel: level, newExp: exp, levelsGained: gained }
}

// ── Skill Unlock ────────────────────────────────────────────────────────────

// skill slot → required battle_level
export const SKILL_UNLOCK_LEVELS: Record<number, number> = {
  1: 1,   // initial
  2: 3,   // mid-tier
  3: 8,   // support
  4: 15,  // ultimate
}

export function getUnlockedSkillSlots(battleLevel: number): number[] {
  return Object.entries(SKILL_UNLOCK_LEVELS)
    .filter(([, reqLv]) => battleLevel >= reqLv)
    .map(([slot]) => parseInt(slot))
}

// ── Damage Formula ──────────────────────────────────────────────────────────

export interface DamageResult {
  damage: number
  effectiveness: 'super_effective' | 'not_effective' | 'normal'
  critical: boolean
  missed: boolean
}

export function calculateDamage(
  attackerBP: number,
  skillPower: number,
  skillType: PokemonType,
  skillAccuracy: number,
  defenderDefense: number,
  defenderType1: PokemonType,
  defenderType2?: PokemonType | null,
  critChance: number = 0,
  attackBuff: number = 0,    // +0.5 from sword dance etc
  defenseBuff: number = 0,
): DamageResult {
  // Accuracy check
  if (Math.random() * 100 > skillAccuracy) {
    return { damage: 0, effectiveness: 'normal', critical: false, missed: true }
  }

  // If skill power is 0, it's a status move - no damage
  if (skillPower === 0) {
    return { damage: 0, effectiveness: 'normal', critical: false, missed: false }
  }

  const typeMult = getTypeEffectiveness(skillType, defenderType1, defenderType2)
  const effectiveness = getEffectivenessLabel(typeMult)

  // Critical hit
  const critical = Math.random() < (critChance || 0.05)
  const critMult = critical ? 1.5 : 1.0

  // Random fluctuation 0.85 ~ 1.15
  const randomMult = 0.85 + Math.random() * 0.3

  const effectiveAtk = attackerBP * (1 + attackBuff)
  const effectiveDef = defenderDefense * (1 + defenseBuff)

  const raw = (effectiveAtk * skillPower / 100) * typeMult * randomMult * critMult
  const damage = Math.max(1, Math.round(raw / (effectiveDef / 50 + 1)))

  return { damage, effectiveness, critical, missed: false }
}

// ── Status Effects ──────────────────────────────────────────────────────────

export type StatusEffect = 'burn' | 'paralyze' | 'freeze' | 'sleep'

export interface ActiveStatus {
  type: StatusEffect
  turnsRemaining: number
}

export function applyStatusDamage(maxHP: number, status: ActiveStatus): number {
  if (status.type === 'burn') return Math.round(maxHP * 0.05)
  return 0
}

export function canAct(status: ActiveStatus | null): boolean {
  if (!status) return true
  if (status.type === 'freeze') return false
  if (status.type === 'sleep') return false
  if (status.type === 'paralyze') return Math.random() > 0.25
  return true
}

// ── Wild Pokemon Generation ─────────────────────────────────────────────────

export interface WildPokemon {
  speciesId: number
  name: string
  emoji: string
  type1: PokemonType
  type2: PokemonType | null
  level: number
  hp: number
  maxHp: number
  battlePower: number
  defense: number
  speed: number
  rarity: number
  skills: WildSkill[]
}

export interface WildSkill {
  id: string
  name: string
  type: PokemonType
  power: number
  accuracy: number
  pp: number
  currentPP: number
  effect: string | null
}

// Region config
export const REGIONS = [
  { id: 1, name: '翠绿森林', emoji: '🌿', minLevel: 1, maxLevel: 5, baseLevel: 3, unlockWins: 0 },
  { id: 2, name: '火山熔岩', emoji: '🔥', minLevel: 5, maxLevel: 12, baseLevel: 8, unlockWins: 5 },
  { id: 3, name: '深蓝湖畔', emoji: '💧', minLevel: 8, maxLevel: 18, baseLevel: 13, unlockWins: 15 },
  { id: 4, name: '雷鸣平原', emoji: '⚡', minLevel: 12, maxLevel: 22, baseLevel: 17, unlockWins: 30 },
  { id: 5, name: '冰雪山脉', emoji: '❄️', minLevel: 18, maxLevel: 28, baseLevel: 23, unlockWins: 50 },
  { id: 6, name: '冠军之路', emoji: '🏆', minLevel: 25, maxLevel: 35, baseLevel: 30, unlockWins: 80 },
]

// Rarity weights: ★=50%, ★★=30%, ★★★=15%, ★★★★=4%, ★★★★★=1%
const RARITY_WEIGHTS: Record<number, number> = { 1: 50, 2: 30, 3: 15, 4: 4, 5: 1 }

export function weightedRandomSpecies(pool: any[]): any {
  const totalWeight = pool.reduce((sum, p) => sum + (RARITY_WEIGHTS[p.rarity] || 1), 0)
  let r = Math.random() * totalWeight
  for (const p of pool) {
    r -= (RARITY_WEIGHTS[p.rarity] || 1)
    if (r <= 0) return p
  }
  return pool[pool.length - 1]
}

export function generateWildLevel(region: typeof REGIONS[0], playerBattleLevel: number): number {
  const offset = Math.floor(Math.random() * 6) - 2 // -2 to +3
  const levelMod = Math.floor(playerBattleLevel * 0.1)
  return Math.max(region.minLevel, Math.min(region.maxLevel, region.baseLevel + offset + levelMod))
}

export function generateWildSkills(
  speciesSkills: { skill1: string; skill2: string; skill3: string; skill4: string },
  allSkills: Record<string, any>,
  wildLevel: number
): WildSkill[] {
  const skillIds: string[] = []
  // Always get skill1
  if (speciesSkills.skill1) skillIds.push(speciesSkills.skill1)
  // Skill2 at level 3+
  if (wildLevel >= 3 && speciesSkills.skill2) skillIds.push(speciesSkills.skill2)
  // Skill3 at level 8+
  if (wildLevel >= 8 && speciesSkills.skill3) skillIds.push(speciesSkills.skill3)
  // Skill4 at level 15+
  if (wildLevel >= 15 && speciesSkills.skill4) skillIds.push(speciesSkills.skill4)

  // For low-level wilds, limit to 1-2 skills
  const maxSkills = wildLevel <= 5 ? 2 : wildLevel <= 12 ? 3 : 4
  const finalIds = skillIds.slice(0, maxSkills)

  return finalIds.map(sid => {
    const sk = allSkills[sid]
    if (!sk) return null
    return {
      id: sid,
      name: sk.name,
      type: sk.type as PokemonType,
      power: sk.power,
      accuracy: sk.accuracy,
      pp: sk.pp,
      currentPP: sk.pp,
      effect: sk.effect,
    }
  }).filter(Boolean) as WildSkill[]
}

// ── Wild AI Strategy ────────────────────────────────────────────────────────

export function wildAIChooseSkill(
  wildSkills: WildSkill[],
  wildLevel: number,
  playerType1: PokemonType,
  playerType2: PokemonType | null,
  wildHP: number,
  wildMaxHP: number,
): WildSkill {
  const usableSkills = wildSkills.filter(s => s.currentPP > 0)
  if (usableSkills.length === 0) {
    // Struggle - return a basic attack
    return { id: 'S01', name: '挣扎', type: 'normal', power: 30, accuracy: 100, pp: 999, currentPP: 999, effect: null }
  }

  // Level 1-5: pure random
  if (wildLevel <= 5) {
    return usableSkills[Math.floor(Math.random() * usableSkills.length)]
  }

  // Level 6-12: 70% highest power, 30% random
  if (wildLevel <= 12) {
    if (Math.random() < 0.7) {
      return usableSkills.reduce((best, s) => s.power > best.power ? s : best, usableSkills[0])
    }
    return usableSkills[Math.floor(Math.random() * usableSkills.length)]
  }

  // Level 13-22: 80% consider type effectiveness
  if (wildLevel <= 22) {
    if (Math.random() < 0.8) {
      // Score each skill by power * effectiveness
      const scored = usableSkills.map(s => ({
        skill: s,
        score: s.power * getTypeEffectiveness(s.type, playerType1, playerType2)
      }))
      scored.sort((a, b) => b.score - a.score)
      return scored[0].skill
    }
    return usableSkills.reduce((best, s) => s.power > best.power ? s : best, usableSkills[0])
  }

  // Level 23-28: smart + heal when low HP
  if (wildLevel <= 28) {
    // Heal if HP < 30%
    if (wildHP < wildMaxHP * 0.3) {
      const healSkill = usableSkills.find(s => s.effect && s.effect.includes('heal'))
      if (healSkill) return healSkill
    }
    // Buff if first few turns
    const buffSkill = usableSkills.find(s => s.effect && (s.effect.includes('attack_up') || s.effect.includes('defense_up')))
    if (buffSkill && Math.random() < 0.3) return buffSkill

    const scored = usableSkills.filter(s => s.power > 0).map(s => ({
      skill: s,
      score: s.power * getTypeEffectiveness(s.type, playerType1, playerType2)
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.skill || usableSkills[0]
  }

  // Level 29+: optimal strategy
  if (wildHP < wildMaxHP * 0.3) {
    const healSkill = usableSkills.find(s => s.effect && s.effect.includes('heal'))
    if (healSkill) return healSkill
  }

  const scored = usableSkills.filter(s => s.power > 0).map(s => ({
    skill: s,
    score: s.power * getTypeEffectiveness(s.type, playerType1, playerType2)
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.skill || usableSkills[0]
}

// ── Capture System ──────────────────────────────────────────────────────────

export type BallType = 'pokeball' | 'greatball' | 'ultraball' | 'masterball'

export const BALL_INFO: Record<BallType, { name: string; emoji: string; multiplier: number; price: number }> = {
  pokeball:  { name: '精灵球', emoji: '🔴', multiplier: 1.0, price: 5 },
  greatball: { name: '超级球', emoji: '🔵', multiplier: 1.5, price: 15 },
  ultraball: { name: '高级球', emoji: '🟡', multiplier: 2.0, price: 30 },
  masterball:{ name: '大师球', emoji: '🟣', multiplier: 100, price: 0 },
}

const RARITY_CAPTURE_COEFF: Record<number, number> = { 1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0, 5: 3.0 }

export function calculateCaptureRate(
  currentHP: number,
  maxHP: number,
  ballType: BallType,
  rarity: number,
): number {
  const hpFactor = (1 - currentHP / maxHP) * 0.6 + 0.1
  const ballMult = BALL_INFO[ballType].multiplier
  const rarityCo = RARITY_CAPTURE_COEFF[rarity] || 1.5
  return Math.min(1, hpFactor * ballMult / rarityCo)
}

export function attemptCapture(
  currentHP: number,
  maxHP: number,
  ballType: BallType,
  rarity: number,
): { success: boolean; rate: number } {
  if (ballType === 'masterball') return { success: true, rate: 1 }
  const rate = calculateCaptureRate(currentHP, maxHP, ballType, rarity)
  return { success: Math.random() < rate, rate }
}

// ── Battle Rewards ──────────────────────────────────────────────────────────

export interface BattleRewards {
  exp: number
  candy: number
  pokeball: number
  fragment: number
}

export function calculateBattleRewards(wildLevel: number, wildRarity: number): BattleRewards {
  const exp = battleExpGain(wildLevel)
  const candy = Math.min(3, Math.max(1, Math.floor(wildLevel / 5) + 1))
  const pokeball = Math.random() < 0.3 ? 1 : 0
  const fragment = (wildRarity >= 3 && Math.random() < 0.1) ? 0.5 : 0
  return { exp, candy, pokeball, fragment }
}

// ── Boss / Elite Data ───────────────────────────────────────────────────────

export interface BossData {
  speciesId: number
  level: number
  name: string
  type: 'elite' | 'boss'
}

export const REGION_BOSSES: Record<number, { elite: BossData; boss: BossData }> = {
  1: {
    elite: { speciesId: 12, level: 8, name: '巴大蝶', type: 'elite' },
    boss: { speciesId: 3, level: 10, name: '妙蛙花', type: 'boss' },
  },
  2: {
    elite: { speciesId: 78, level: 15, name: '烈焰马', type: 'elite' },
    boss: { speciesId: 6, level: 18, name: '喷火龙', type: 'boss' },
  },
  3: {
    elite: { speciesId: 55, level: 20, name: '哥达鸭', type: 'elite' },
    boss: { speciesId: 9, level: 22, name: '水箭龟', type: 'boss' },
  },
  4: {
    elite: { speciesId: 26, level: 25, name: '雷丘', type: 'elite' },
    boss: { speciesId: 82, level: 28, name: '三合一磁怪', type: 'boss' },
  },
  5: {
    elite: { speciesId: 76, level: 30, name: '隆隆岩', type: 'elite' },
    boss: { speciesId: 131, level: 32, name: '拉普拉斯', type: 'boss' },
  },
  6: {
    elite: { speciesId: 149, level: 35, name: '快龙', type: 'elite' },
    boss: { speciesId: 150, level: 40, name: '超梦', type: 'boss' },
  },
}

// Boss first-defeat rewards
export const BOSS_REWARDS: Record<number, { items: Record<string, number>; description: string }> = {
  1: { items: { greatball: 3, candy: 20 }, description: '超级球 x3 + 星星糖 x20' },
  2: { items: { greatball: 5, fragment: 2 }, description: '超级球 x5 + 进化石碎片 x2' },
  3: { items: { ultraball: 3, candy: 50 }, description: '高级球 x3 + 星星糖 x50' },
  4: { items: { ultraball: 5, fragment: 3 }, description: '高级球 x5 + 进化石碎片 x3' },
  5: { items: { ultraball: 10, fragment: 5 }, description: '高级球 x10 + 进化石 x1' },
  6: { items: { masterball: 1 }, description: '大师球 x1' },
}

// ── Battle State (for in-memory tracking during a battle) ───────────────────

export interface BattleState {
  battleId: string
  childId: number
  region: number
  round: number
  playerPokemonId: number
  playerSpeciesId: number
  playerName: string
  playerType1: PokemonType
  playerType2: PokemonType | null
  playerHP: number
  playerMaxHP: number
  playerBP: number
  playerDefense: number
  playerSpeed: number
  playerSkills: WildSkill[]
  playerStatus: ActiveStatus | null
  playerAttackBuff: number
  playerDefenseBuff: number
  playerBuffTurns: number
  wild: WildPokemon
  wildStatus: ActiveStatus | null
  wildAttackBuff: number
  wildDefenseBuff: number
  wildBuffTurns: number
  isBoss: boolean
  bossType?: 'elite' | 'boss'
  status: 'ongoing' | 'win' | 'lose' | 'flee' | 'captured'
  // Knowledge system
  quizCombo: number
  quizTotalCorrect: number
  quizTotalAnswered: number
  quizMaxCombo: number
  // Tactic system
  activeTactic: TacticType | null
  tacticTurnsLeft: number
  storedPower: number  // For charge tactic
}

// ── Knowledge Quiz System ──────────────────────────────────────────────────

export interface QuizBonus {
  damageMultiplier: number
  label: string
  comboCount: number
}

export function getQuizBonus(correct: boolean, fast: boolean, combo: number): QuizBonus {
  if (!correct) {
    return { damageMultiplier: 0.7, label: '😅 答错了，攻击力下降…', comboCount: 0 }
  }
  // fast = answered within 30s → 1.5x, slow = over 30s → 1.2x
  let mult = fast ? 1.5 : 1.2
  // Combo bonus
  let comboBonus = 0
  const newCombo = combo + 1
  if (newCombo >= 10) comboBonus = 0.5
  else if (newCombo >= 5) comboBonus = 0.35
  else if (newCombo >= 3) comboBonus = 0.2
  else if (newCombo >= 2) comboBonus = 0.1

  mult += comboBonus

  let label = fast ? '⚡ 快速答对！' : '✅ 答对了！'
  if (newCombo >= 10) label = '🌟 学霸模式！' + newCombo + '连击！'
  else if (newCombo >= 5) label = '⚡ 知识就是力量！' + newCombo + '连击！'
  else if (newCombo >= 3) label = '🔥 太棒了！' + newCombo + '连击！'
  else if (newCombo >= 2) label = '👍 不错！' + newCombo + '连击！'

  return { damageMultiplier: mult, label, comboCount: newCombo }
}

// Region → quiz difficulty mapping
export function getQuizDifficultyForRegion(regionId: number): { gradeMin: number; gradeMax: number; difficulty: number } {
  if (regionId <= 2) return { gradeMin: 3, gradeMax: 4, difficulty: 1 }
  if (regionId <= 4) return { gradeMin: 3, gradeMax: 6, difficulty: 2 }
  return { gradeMin: 5, gradeMax: 6, difficulty: 3 }
}

// ── Tactic System ──────────────────────────────────────────────────────────

export type TacticType = 'all_out' | 'defend' | 'charge' | 'heal'

export interface TacticEffect {
  attackMult: number
  defenseMult: number
  healPercent: number
  skipAttack: boolean
  storedPower: number
  label: string
  emoji: string
}

export const TACTICS: Record<TacticType, TacticEffect> = {
  all_out: { attackMult: 1.5, defenseMult: 0.7, healPercent: 0, skipAttack: false, storedPower: 0, label: '全力进攻', emoji: '🗡️' },
  defend: { attackMult: 0.8, defenseMult: 1.5, healPercent: 0, skipAttack: false, storedPower: 0, label: '防御反击', emoji: '🛡️' },
  charge: { attackMult: 0, defenseMult: 1.0, healPercent: 0, skipAttack: true, storedPower: 2.0, label: '蓄力', emoji: '🔄' },
  heal: { attackMult: 0, defenseMult: 1.0, healPercent: 0.25, skipAttack: true, storedPower: 0, label: '恢复', emoji: '💊' },
}

export function canUseTactic(round: number): boolean {
  // Can use tactic every 3 rounds (round 3, 6, 9...)
  return round > 0 && round % 3 === 0
}

// ── Type weakness info for UI ──────────────────────────────────────────────

export function getTypeWeaknesses(type1: PokemonType, type2?: PokemonType | null): { weakTo: PokemonType[]; resistTo: PokemonType[] } {
  const allTypes: PokemonType[] = ['fire', 'water', 'grass', 'electric', 'ground', 'ice', 'flying', 'bug', 'normal', 'fairy']
  const weakTo: PokemonType[] = []
  const resistTo: PokemonType[] = []

  for (const atk of allTypes) {
    const eff = getTypeEffectiveness(atk, type1, type2)
    if (eff > 1.2) weakTo.push(atk)
    else if (eff < 0.8) resistTo.push(atk)
  }

  return { weakTo, resistTo }
}

// Generate unique battle ID
export function generateBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

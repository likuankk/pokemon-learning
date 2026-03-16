// 奖励计算和宝可梦数值更新逻辑

export type ItemReward = {
  food: number      // 精灵食物
  crystal: number   // 知识结晶
  candy: number     // 星星糖
  fragment: number  // 进化石碎片
}

export type PokemonStatus = 'energetic' | 'good' | 'tired' | 'sad'

// 奖励计算：根据质量评分(1-5)
export function calculateRewards(qualityScore: number): ItemReward {
  if (qualityScore <= 3) {
    return { food: 2, crystal: 0, candy: 1, fragment: 0 }
  } else if (qualityScore === 4) {
    return { food: 3, crystal: 1, candy: 1, fragment: 0 }
  } else {
    return { food: 3, crystal: 2, candy: 2, fragment: 0.5 }
  }
}

// 难度系数
export function getDifficultyMultiplier(difficulty: number): number {
  const multipliers: Record<number, number> = {
    1: 1.0, 2: 1.1, 3: 1.2, 4: 1.35, 5: 1.5,
  }
  return multipliers[difficulty] ?? 1.2
}

// 升级所需完成任务数（每级需要更多）
export function getLevelUpThreshold(currentLevel: number): number {
  return 3 + (currentLevel - 1) * 2  // lv1→3个, lv2→5个, lv3→7个...
}

// 计算新等级（根据累计通过任务数）
export function calculateLevel(approvedCount: number): number {
  let level = 1
  let needed = 3
  let remaining = approvedCount
  while (remaining >= needed) {
    remaining -= needed
    level++
    needed = 3 + (level - 1) * 2
  }
  return level
}

// 更新宝可梦三维度
export function calculateStatUpdates(
  rewards: ItemReward,
  difficulty: number,
  currentVitality: number,
  currentWisdom: number,
  currentAffection: number,
  streakDays: number
) {
  const diffMultiplier = getDifficultyMultiplier(difficulty)

  const vitalityGain = rewards.food * diffMultiplier
  const newVitality = Math.min(100, currentVitality + vitalityGain)

  const wisdomGain = rewards.crystal * 2
  const newWisdom = Math.min(100, currentWisdom + wisdomGain)

  const affectionGain = streakDays >= 1 ? 1 : 0
  const newAffection = Math.min(100, currentAffection + affectionGain)

  return {
    vitality: Math.round(newVitality * 10) / 10,
    wisdom: Math.round(newWisdom * 10) / 10,
    affection: Math.round(newAffection * 10) / 10,
    gains: {
      vitality: Math.round(vitalityGain * 10) / 10,
      wisdom: Math.round(wisdomGain * 10) / 10,
      affection: affectionGain,
    }
  }
}

// 宝可梦状态判断
export function getPokemonStatus(vitality: number, wisdom: number, affection: number): PokemonStatus {
  const avg = (vitality + wisdom + affection) / 3
  if (avg >= 80) return 'energetic'
  if (avg >= 60) return 'good'
  if (avg >= 40) return 'tired'
  return 'sad'
}

export const statusLabels: Record<PokemonStatus, string> = {
  energetic: '元气满满 ✨',
  good: '精神良好 😊',
  tired: '有点疲惫 😴',
  sad: '需要关心 🥺',
}

export const itemLabels: Record<string, string> = {
  food: '精灵食物',
  crystal: '知识结晶',
  candy: '星星糖',
  fragment: '进化石碎片',
}

export const itemEmojis: Record<string, string> = {
  food: '🍖',
  crystal: '💎',
  candy: '⭐',
  fragment: '🪨',
}

export const subjectColors: Record<string, string> = {
  '语文': 'bg-red-100 text-red-700 border-red-200',
  '数学': 'bg-blue-100 text-blue-700 border-blue-200',
  '英语': 'bg-green-100 text-green-700 border-green-200',
  '科学': 'bg-purple-100 text-purple-700 border-purple-200',
  '其他': 'bg-gray-100 text-gray-700 border-gray-200',
}

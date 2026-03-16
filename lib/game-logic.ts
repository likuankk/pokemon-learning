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
    // 普通完成 1-3分
    return { food: 2, crystal: 0, candy: 1, fragment: 0 }
  } else if (qualityScore === 4) {
    // 良好完成 4分
    return { food: 3, crystal: 1, candy: 1, fragment: 0 }
  } else {
    // 优秀完成 5分
    return { food: 3, crystal: 2, candy: 2, fragment: 0.5 }
  }
}

// 难度系数
export function getDifficultyMultiplier(difficulty: number): number {
  const multipliers: Record<number, number> = {
    1: 1.0,
    2: 1.1,
    3: 1.2,
    4: 1.35,
    5: 1.5,
  }
  return multipliers[difficulty] ?? 1.2
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

  // 体力 += 精灵食物 × 难度系数，上限100
  const vitalityGain = rewards.food * diffMultiplier
  const newVitality = Math.min(100, currentVitality + vitalityGain)

  // 智慧 += 知识结晶 × 2，上限100
  const wisdomGain = rewards.crystal * 2
  const newWisdom = Math.min(100, currentWisdom + wisdomGain)

  // 亲密度 += 连续打卡天数奖励，当天完成≥1任务+1，上限100
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
  if (avg >= 80) return 'energetic'  // 元气满满
  if (avg >= 60) return 'good'       // 精神良好
  if (avg >= 40) return 'tired'      // 有点疲惫
  return 'sad'                        // 需要关心
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

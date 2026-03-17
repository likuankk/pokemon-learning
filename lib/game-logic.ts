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

  // Affection: +1 for any task today, +extra for streak milestones
  const affectionBonus = streakDays >= 7 ? 3 : streakDays >= 3 ? 2 : streakDays >= 1 ? 1 : 0
  const newAffection = Math.min(100, currentAffection + affectionBonus)

  return {
    vitality: Math.round(newVitality * 10) / 10,
    wisdom: Math.round(newWisdom * 10) / 10,
    affection: Math.round(newAffection * 10) / 10,
    gains: {
      vitality: Math.round(vitalityGain * 10) / 10,
      wisdom: Math.round(wisdomGain * 10) / 10,
      affection: affectionBonus,
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

// ── 进化系统 ─────────────────────────────────────────────────────────────────

// 宝可梦名称映射
export const POKEMON_NAMES: Record<number, string> = {
  1: '妙蛙种子', 2: '妙蛙草', 3: '妙蛙花',
  4: '小火龙', 5: '火恐龙', 6: '喷火龙',
  7: '杰尼龟', 8: '卡咪龟', 9: '水箭龟',
  10: '绿毛虫', 11: '铁甲蛹', 12: '巴大蝶',
  25: '皮卡丘', 26: '雷丘',
  27: '穿山鼠', 28: '穿山王',
  35: '皮皮', 36: '皮可西',
  37: '六尾', 38: '九尾',
  39: '胖丁', 40: '胖可丁',
  43: '走路草', 44: '臭臭花', 45: '霸王花',
  50: '地鼠', 51: '三地鼠',
  54: '可达鸭', 55: '哥达鸭',
  58: '卡蒂狗', 59: '风速狗',
  60: '蚊香蝌蚪', 61: '蚊香君', 62: '蚊香泳士',
  69: '喇叭芽', 70: '口呆花', 71: '大食花',
  74: '小拳石', 75: '隆隆石', 76: '隆隆岩',
  77: '小火马', 78: '烈焰马',
  81: '小磁怪', 82: '三合一磁怪',
  86: '小海狮', 87: '白海狮',
  100: '霹雳电球', 101: '顽皮雷弹',
  120: '海星星', 121: '宝石海星',
  125: '电击兽',
  131: '拉普拉斯',
  133: '伊布', 134: '水伊布', 135: '雷伊布', 136: '火伊布',
  143: '卡比兽',
  144: '急冻鸟', 145: '闪电鸟', 146: '火焰鸟',
  147: '迷你龙', 148: '哈克龙', 149: '快龙',
  150: '超梦',
  471: '冰伊布',
}

// 宝可梦属性映射
export const POKEMON_TYPES: Record<number, string> = {
  1: '草', 2: '草', 3: '草',
  4: '火', 5: '火', 6: '火/飞行',
  7: '水', 8: '水', 9: '水',
  10: '虫', 11: '虫', 12: '虫/飞行',
  25: '电', 26: '电',
  27: '地', 28: '地',
  35: '妖精', 36: '妖精',
  37: '火', 38: '火',
  39: '妖精', 40: '妖精',
  43: '草', 44: '草', 45: '草',
  50: '地', 51: '地',
  54: '水', 55: '水',
  58: '火', 59: '火',
  60: '水', 61: '水', 62: '水',
  69: '草', 70: '草', 71: '草',
  74: '地', 75: '地', 76: '地',
  77: '火', 78: '火',
  81: '电', 82: '电',
  86: '水', 87: '水/冰',
  100: '电', 101: '电',
  120: '水', 121: '水',
  125: '电',
  131: '水/冰',
  133: '一般', 134: '水', 135: '电', 136: '火',
  143: '一般',
  144: '冰/飞行', 145: '电/飞行', 146: '火/飞行',
  147: '飞行', 148: '飞行', 149: '飞行',
  150: '一般',
  471: '冰',
}

// 进化路径：base_species_id → 进化链 (支持分支进化)
export interface EvolutionPath {
  chain: number[]         // 默认进化链
  branches?: Record<number, number[]>  // 分支进化 (阶段 → [可选species_id])
}

export const EVOLUTION_PATHS: Record<number, EvolutionPath> = {
  1:   { chain: [1, 2, 3] },           // 妙蛙种子 → 妙蛙草 → 妙蛙花
  4:   { chain: [4, 5, 6] },           // 小火龙 → 火恐龙 → 喷火龙
  7:   { chain: [7, 8, 9] },           // 杰尼龟 → 卡咪龟 → 水箭龟
  10:  { chain: [10, 11, 12] },        // 绿毛虫 → 铁甲蛹 → 巴大蝶
  25:  { chain: [25, 26] },            // 皮卡丘 → 雷丘
  27:  { chain: [27, 28] },            // 穿山鼠 → 穿山王
  35:  { chain: [35, 36] },            // 皮皮 → 皮可西
  37:  { chain: [37, 38] },            // 六尾 → 九尾
  39:  { chain: [39, 40] },            // 胖丁 → 胖可丁
  43:  { chain: [43, 44, 45] },        // 走路草 → 臭臭花 → 霸王花
  50:  { chain: [50, 51] },            // 地鼠 → 三地鼠
  54:  { chain: [54, 55] },            // 可达鸭 → 哥达鸭
  58:  { chain: [58, 59] },            // 卡蒂狗 → 风速狗
  60:  { chain: [60, 61, 62] },        // 蚊香蝌蚪 → 蚊香君 → 蚊香泳士
  69:  { chain: [69, 70, 71] },        // 喇叭芽 → 口呆花 → 大食花
  74:  { chain: [74, 75, 76] },        // 小拳石 → 隆隆石 → 隆隆岩
  77:  { chain: [77, 78] },            // 小火马 → 烈焰马
  81:  { chain: [81, 82] },            // 小磁怪 → 三合一磁怪
  86:  { chain: [86, 87] },            // 小海狮 → 白海狮
  100: { chain: [100, 101] },          // 霹雳电球 → 顽皮雷弹
  120: { chain: [120, 121] },          // 海星星 → 宝石海星
  133: { chain: [133, 135],            // 伊布 → 雷伊布 (默认)
         branches: { 1: [134, 135, 136, 471] } },  // 第一阶段分支: 水/雷/火/冰伊布
  147: { chain: [147, 148, 149] },     // 迷你龙 → 哈克龙 → 快龙
}

// 获取宝可梦的起始species_id（用于查找进化路径）
export function getBaseSpeciesId(speciesId: number): number {
  for (const [base, pathDef] of Object.entries(EVOLUTION_PATHS)) {
    const allIds = new Set(pathDef.chain)
    if (pathDef.branches) {
      for (const ids of Object.values(pathDef.branches)) {
        ids.forEach(id => allIds.add(id))
      }
    }
    if (allIds.has(speciesId)) return parseInt(base)
  }
  return speciesId
}

// 获取当前所处进化阶段
export function getEvolutionStage(speciesId: number): number {
  const baseId = getBaseSpeciesId(speciesId)
  const pathDef = EVOLUTION_PATHS[baseId]
  if (!pathDef) return 1

  const idx = pathDef.chain.indexOf(speciesId)
  if (idx >= 0) return idx + 1

  // Check branches
  if (pathDef.branches) {
    for (const [stage, ids] of Object.entries(pathDef.branches)) {
      if (ids.includes(speciesId)) return parseInt(stage) + 1
    }
  }
  return 1
}

// 获取进化所需条件
export function getEvolutionRequirements(evolutionStage: number): { level: number; fragments: number } {
  if (evolutionStage === 1) return { level: 10, fragments: 3 }
  if (evolutionStage === 2) return { level: 20, fragments: 5 }
  return { level: 999, fragments: 999 } // 不可进化
}

// 获取可进化的目标列表 (支持分支)
export function getEvolutionTargets(
  speciesId: number,
  evolutionStage: number,
): number[] {
  const baseId = getBaseSpeciesId(speciesId)
  const pathDef = EVOLUTION_PATHS[baseId]
  if (!pathDef) return []

  const maxStage = pathDef.chain.length
  if (evolutionStage >= maxStage) return []

  // Check if there are branch options for this stage
  if (pathDef.branches && pathDef.branches[evolutionStage]) {
    return pathDef.branches[evolutionStage]
  }

  // Default chain evolution
  return [pathDef.chain[evolutionStage]]
}

// 检查是否可以进化
export function checkEvolution(
  speciesId: number,
  evolutionStage: number,
  level: number,
  fragmentQty: number,
  targetSpeciesId?: number
): { canEvolve: boolean; nextSpeciesId?: number; targets?: number[] } {
  const targets = getEvolutionTargets(speciesId, evolutionStage)
  if (targets.length === 0) return { canEvolve: false }

  const { level: requiredLevel, fragments: requiredFragments } = getEvolutionRequirements(evolutionStage)

  if (level >= requiredLevel && fragmentQty >= requiredFragments) {
    // If targetSpeciesId specified and is valid, use it; otherwise use first target
    const nextId = targetSpeciesId && targets.includes(targetSpeciesId)
      ? targetSpeciesId
      : targets[0]
    return { canEvolve: true, nextSpeciesId: nextId, targets }
  }
  return { canEvolve: false, targets }
}

// 获取完整进化链展示数据
export function getEvolutionChainDisplay(speciesId: number): {
  stages: { speciesId: number; name: string; stage: number; isCurrent: boolean; isBranch?: boolean }[]
  maxStage: number
} {
  const baseId = getBaseSpeciesId(speciesId)
  const pathDef = EVOLUTION_PATHS[baseId]
  if (!pathDef) return { stages: [{ speciesId, name: POKEMON_NAMES[speciesId] || '???', stage: 1, isCurrent: true }], maxStage: 1 }

  const stages: { speciesId: number; name: string; stage: number; isCurrent: boolean; isBranch?: boolean }[] = []

  for (let i = 0; i < pathDef.chain.length; i++) {
    const id = pathDef.chain[i]
    stages.push({
      speciesId: id,
      name: POKEMON_NAMES[id] || `#${id}`,
      stage: i + 1,
      isCurrent: id === speciesId,
    })

    // Add branch options at this stage
    if (pathDef.branches && pathDef.branches[i]) {
      for (const branchId of pathDef.branches[i]) {
        if (!pathDef.chain.includes(branchId)) { // skip IDs already in the main chain
          stages.push({
            speciesId: branchId,
            name: POKEMON_NAMES[branchId] || `#${branchId}`,
            stage: i + 1 + 1,
            isCurrent: branchId === speciesId,
            isBranch: true,
          })
        }
      }
    }
  }

  return { stages, maxStage: pathDef.chain.length }
}

// 连续打卡里程碑奖励
export function getStreakMilestoneReward(newStreak: number): ItemReward | null {
  if (newStreak === 30) return { food: 0, crystal: 0, candy: 0, fragment: 1 }
  if (newStreak === 7)  return { food: 0, crystal: 1, candy: 0, fragment: 0 }
  if (newStreak === 3)  return { food: 0, crystal: 0, candy: 2, fragment: 0 }
  return null
}

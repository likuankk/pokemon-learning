import { describe, it, expect } from 'vitest'
import {
  calculateRewards,
  getDifficultyMultiplier,
  getLevelUpThreshold,
  calculateLevel,
  calculateStatUpdates,
  getPokemonStatus,
  getStreakMilestoneReward,
  POKEMON_NAMES,
  POKEMON_TYPES,
  EVOLUTION_PATHS,
  getBaseSpeciesId,
  getEvolutionStage,
  getEvolutionRequirements,
  getEvolutionTargets,
  checkEvolution,
  getEvolutionChainDisplay,
} from '@/lib/game-logic'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 奖励计算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('calculateRewards', () => {
  it('score 1-3 给基础奖励', () => {
    for (const score of [1, 2, 3]) {
      const r = calculateRewards(score)
      expect(r.food).toBe(2)
      expect(r.crystal).toBe(0)
      expect(r.candy).toBe(1)
      expect(r.fragment).toBe(0)
    }
  })

  it('score 4 给中等奖励', () => {
    const r = calculateRewards(4)
    expect(r.food).toBe(3)
    expect(r.crystal).toBe(1)
    expect(r.candy).toBe(1)
    expect(r.fragment).toBe(0)
  })

  it('score 5 给最高奖励，包含碎片', () => {
    const r = calculateRewards(5)
    expect(r.food).toBe(3)
    expect(r.crystal).toBe(2)
    expect(r.candy).toBe(2)
    expect(r.fragment).toBe(0.5)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 难度系数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('getDifficultyMultiplier', () => {
  it('返回正确的难度系数', () => {
    expect(getDifficultyMultiplier(1)).toBe(1.0)
    expect(getDifficultyMultiplier(2)).toBe(1.1)
    expect(getDifficultyMultiplier(3)).toBe(1.2)
    expect(getDifficultyMultiplier(4)).toBe(1.35)
    expect(getDifficultyMultiplier(5)).toBe(1.5)
  })

  it('无效难度返回默认值', () => {
    expect(getDifficultyMultiplier(0)).toBe(1.2)
    expect(getDifficultyMultiplier(6)).toBe(1.2)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 等级系统
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('getLevelUpThreshold', () => {
  it('等级越高需要越多任务', () => {
    expect(getLevelUpThreshold(1)).toBe(3)
    expect(getLevelUpThreshold(2)).toBe(5)
    expect(getLevelUpThreshold(3)).toBe(7)
    expect(getLevelUpThreshold(5)).toBe(11)
  })
})

describe('calculateLevel', () => {
  it('0个任务 = 等级1', () => {
    expect(calculateLevel(0)).toBe(1)
  })

  it('2个任务 = 等级1（需3个才升级）', () => {
    expect(calculateLevel(2)).toBe(1)
  })

  it('3个任务 = 等级2', () => {
    expect(calculateLevel(3)).toBe(2)
  })

  it('8个任务 = 等级3（3+5=8）', () => {
    expect(calculateLevel(8)).toBe(3)
  })

  it('15个任务 = 等级4（3+5+7=15）', () => {
    expect(calculateLevel(15)).toBe(4)
  })

  it('大量任务应持续升级', () => {
    const level = calculateLevel(100)
    expect(level).toBeGreaterThan(5)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 属性更新
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('calculateStatUpdates', () => {
  it('基础奖励增加体力', () => {
    const rewards = { food: 3, crystal: 2, candy: 1, fragment: 0 }
    const result = calculateStatUpdates(rewards, 3, 60, 60, 60, 1)
    expect(result.vitality).toBeGreaterThan(60)
    expect(result.wisdom).toBeGreaterThan(60)
  })

  it('属性不超过100', () => {
    const rewards = { food: 10, crystal: 10, candy: 10, fragment: 10 }
    const result = calculateStatUpdates(rewards, 5, 95, 95, 95, 30)
    expect(result.vitality).toBeLessThanOrEqual(100)
    expect(result.wisdom).toBeLessThanOrEqual(100)
    expect(result.affection).toBeLessThanOrEqual(100)
  })

  it('连续打卡增加亲密度', () => {
    const rewards = { food: 2, crystal: 0, candy: 1, fragment: 0 }
    const noStreak = calculateStatUpdates(rewards, 3, 60, 60, 60, 0)
    const withStreak = calculateStatUpdates(rewards, 3, 60, 60, 60, 7)
    expect(withStreak.affection).toBeGreaterThan(noStreak.affection)
  })

  it('gains 记录正确增量', () => {
    const rewards = { food: 3, crystal: 2, candy: 1, fragment: 0 }
    const result = calculateStatUpdates(rewards, 3, 50, 50, 50, 3)
    expect(result.gains.vitality).toBeGreaterThan(0)
    expect(result.gains.wisdom).toBe(4) // crystal * 2
    expect(result.gains.affection).toBe(2) // streak >= 3
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 宝可梦状态
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('getPokemonStatus', () => {
  it('高属性 = energetic', () => {
    expect(getPokemonStatus(90, 90, 90)).toBe('energetic')
    expect(getPokemonStatus(80, 80, 80)).toBe('energetic')
  })

  it('中等属性 = good', () => {
    expect(getPokemonStatus(70, 60, 60)).toBe('good')
  })

  it('低属性 = tired', () => {
    expect(getPokemonStatus(40, 45, 50)).toBe('tired')
  })

  it('很低属性 = sad', () => {
    expect(getPokemonStatus(20, 20, 20)).toBe('sad')
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 连续打卡里程碑
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('getStreakMilestoneReward', () => {
  it('3天里程碑奖励糖', () => {
    const r = getStreakMilestoneReward(3)
    expect(r).not.toBeNull()
    expect(r!.candy).toBe(2)
  })

  it('7天里程碑奖励结晶', () => {
    const r = getStreakMilestoneReward(7)
    expect(r).not.toBeNull()
    expect(r!.crystal).toBe(1)
  })

  it('30天里程碑奖励碎片', () => {
    const r = getStreakMilestoneReward(30)
    expect(r).not.toBeNull()
    expect(r!.fragment).toBe(1)
  })

  it('非里程碑不奖励', () => {
    expect(getStreakMilestoneReward(1)).toBeNull()
    expect(getStreakMilestoneReward(5)).toBeNull()
    expect(getStreakMilestoneReward(15)).toBeNull()
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 宝可梦名称和属性映射
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POKEMON_NAMES', () => {
  it('所有初始宝可梦有名称', () => {
    const starters = [1, 4, 7, 25, 39, 133]
    for (const id of starters) {
      expect(POKEMON_NAMES[id]).toBeDefined()
      expect(POKEMON_NAMES[id].length).toBeGreaterThan(0)
    }
  })

  it('所有进化形态有名称', () => {
    const evolved = [2, 3, 5, 6, 8, 9, 26, 40, 134, 135, 136]
    for (const id of evolved) {
      expect(POKEMON_NAMES[id]).toBeDefined()
      expect(POKEMON_NAMES[id].length).toBeGreaterThan(0)
    }
  })
})

describe('POKEMON_TYPES', () => {
  it('所有有名称的宝可梦都有属性', () => {
    for (const id of Object.keys(POKEMON_NAMES).map(Number)) {
      expect(POKEMON_TYPES[id]).toBeDefined()
      expect(POKEMON_TYPES[id].length).toBeGreaterThan(0)
    }
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 进化系统
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('EVOLUTION_PATHS', () => {
  it('所有6条进化路径都存在', () => {
    expect(EVOLUTION_PATHS[1]).toBeDefined()
    expect(EVOLUTION_PATHS[4]).toBeDefined()
    expect(EVOLUTION_PATHS[7]).toBeDefined()
    expect(EVOLUTION_PATHS[25]).toBeDefined()
    expect(EVOLUTION_PATHS[39]).toBeDefined()
    expect(EVOLUTION_PATHS[133]).toBeDefined()
  })

  it('三阶段宝可梦有3个进化形态', () => {
    expect(EVOLUTION_PATHS[1].chain).toHaveLength(3)
    expect(EVOLUTION_PATHS[4].chain).toHaveLength(3)
    expect(EVOLUTION_PATHS[7].chain).toHaveLength(3)
  })

  it('两阶段宝可梦有2个进化形态', () => {
    expect(EVOLUTION_PATHS[25].chain).toHaveLength(2)
    expect(EVOLUTION_PATHS[39].chain).toHaveLength(2)
  })

  it('伊布有分支进化', () => {
    expect(EVOLUTION_PATHS[133].branches).toBeDefined()
    expect(EVOLUTION_PATHS[133].branches![1]).toContain(134) // 水伊布
    expect(EVOLUTION_PATHS[133].branches![1]).toContain(135) // 雷伊布
    expect(EVOLUTION_PATHS[133].branches![1]).toContain(136) // 火伊布
  })

  it('进化链第一个元素是base', () => {
    for (const [base, pathDef] of Object.entries(EVOLUTION_PATHS)) {
      expect(pathDef.chain[0]).toBe(parseInt(base))
    }
  })
})

describe('getBaseSpeciesId', () => {
  it('初始形态返回自身', () => {
    expect(getBaseSpeciesId(1)).toBe(1)
    expect(getBaseSpeciesId(4)).toBe(4)
    expect(getBaseSpeciesId(25)).toBe(25)
    expect(getBaseSpeciesId(133)).toBe(133)
  })

  it('进化形态返回base', () => {
    expect(getBaseSpeciesId(2)).toBe(1)   // 妙蛙草 → 妙蛙种子
    expect(getBaseSpeciesId(3)).toBe(1)   // 妙蛙花 → 妙蛙种子
    expect(getBaseSpeciesId(6)).toBe(4)   // 喷火龙 → 小火龙
    expect(getBaseSpeciesId(9)).toBe(7)   // 水箭龟 → 杰尼龟
    expect(getBaseSpeciesId(26)).toBe(25) // 雷丘 → 皮卡丘
    expect(getBaseSpeciesId(40)).toBe(39) // 胖可丁 → 胖丁
  })

  it('伊布分支进化返回base', () => {
    expect(getBaseSpeciesId(134)).toBe(133) // 水伊布
    expect(getBaseSpeciesId(135)).toBe(133) // 雷伊布
    expect(getBaseSpeciesId(136)).toBe(133) // 火伊布
  })

  it('未知species_id返回自身', () => {
    expect(getBaseSpeciesId(999)).toBe(999)
  })
})

describe('getEvolutionStage', () => {
  it('初始形态是阶段1', () => {
    expect(getEvolutionStage(1)).toBe(1)
    expect(getEvolutionStage(4)).toBe(1)
    expect(getEvolutionStage(25)).toBe(1)
    expect(getEvolutionStage(133)).toBe(1)
  })

  it('第二形态是阶段2', () => {
    expect(getEvolutionStage(2)).toBe(2) // 妙蛙草
    expect(getEvolutionStage(5)).toBe(2) // 火恐龙
    expect(getEvolutionStage(8)).toBe(2) // 卡咪龟
    expect(getEvolutionStage(26)).toBe(2) // 雷丘
    expect(getEvolutionStage(40)).toBe(2) // 胖可丁
  })

  it('第三形态是阶段3', () => {
    expect(getEvolutionStage(3)).toBe(3) // 妙蛙花
    expect(getEvolutionStage(6)).toBe(3) // 喷火龙
    expect(getEvolutionStage(9)).toBe(3) // 水箭龟
  })

  it('伊布分支进化是阶段2', () => {
    expect(getEvolutionStage(134)).toBe(2) // 水伊布
    expect(getEvolutionStage(135)).toBe(2) // 雷伊布 (在chain中)
    expect(getEvolutionStage(136)).toBe(2) // 火伊布
  })
})

describe('getEvolutionRequirements', () => {
  it('阶段1→2需要Lv10和3碎片', () => {
    const req = getEvolutionRequirements(1)
    expect(req.level).toBe(10)
    expect(req.fragments).toBe(3)
  })

  it('阶段2→3需要Lv20和5碎片', () => {
    const req = getEvolutionRequirements(2)
    expect(req.level).toBe(20)
    expect(req.fragments).toBe(5)
  })

  it('阶段3不可继续进化', () => {
    const req = getEvolutionRequirements(3)
    expect(req.level).toBe(999)
    expect(req.fragments).toBe(999)
  })
})

describe('getEvolutionTargets', () => {
  it('妙蛙种子阶段1的目标是妙蛙草', () => {
    expect(getEvolutionTargets(1, 1)).toEqual([2])
  })

  it('妙蛙草阶段2的目标是妙蛙花', () => {
    expect(getEvolutionTargets(2, 2)).toEqual([3])
  })

  it('妙蛙花阶段3没有进化目标', () => {
    expect(getEvolutionTargets(3, 3)).toEqual([])
  })

  it('皮卡丘阶段1的目标是雷丘', () => {
    expect(getEvolutionTargets(25, 1)).toEqual([26])
  })

  it('雷丘已是最终形态', () => {
    expect(getEvolutionTargets(26, 2)).toEqual([])
  })

  it('伊布阶段1有3个分支目标', () => {
    const targets = getEvolutionTargets(133, 1)
    expect(targets).toContain(134)
    expect(targets).toContain(135)
    expect(targets).toContain(136)
    expect(targets).toHaveLength(3)
  })
})

describe('checkEvolution', () => {
  it('条件不足返回canEvolve=false', () => {
    const result = checkEvolution(1, 1, 5, 1) // level和碎片都不够
    expect(result.canEvolve).toBe(false)
  })

  it('等级够但碎片不够', () => {
    const result = checkEvolution(1, 1, 10, 1)
    expect(result.canEvolve).toBe(false)
  })

  it('碎片够但等级不够', () => {
    const result = checkEvolution(1, 1, 5, 5)
    expect(result.canEvolve).toBe(false)
  })

  it('条件满足返回canEvolve=true', () => {
    const result = checkEvolution(1, 1, 10, 3)
    expect(result.canEvolve).toBe(true)
    expect(result.nextSpeciesId).toBe(2) // 妙蛙草
  })

  it('阶段2进化需要更高条件', () => {
    const notEnough = checkEvolution(2, 2, 15, 3)
    expect(notEnough.canEvolve).toBe(false)

    const enough = checkEvolution(2, 2, 20, 5)
    expect(enough.canEvolve).toBe(true)
    expect(enough.nextSpeciesId).toBe(3)
  })

  it('最终形态不能进化', () => {
    const result = checkEvolution(3, 3, 99, 99)
    expect(result.canEvolve).toBe(false)
  })

  it('伊布可以选择进化目标', () => {
    const defaultResult = checkEvolution(133, 1, 10, 3)
    expect(defaultResult.canEvolve).toBe(true)
    expect(defaultResult.targets).toHaveLength(3)

    // 指定目标
    const waterResult = checkEvolution(133, 1, 10, 3, 134)
    expect(waterResult.canEvolve).toBe(true)
    expect(waterResult.nextSpeciesId).toBe(134) // 水伊布

    const fireResult = checkEvolution(133, 1, 10, 3, 136)
    expect(fireResult.canEvolve).toBe(true)
    expect(fireResult.nextSpeciesId).toBe(136) // 火伊布
  })

  it('指定无效目标使用默认目标', () => {
    const result = checkEvolution(133, 1, 10, 3, 999)
    expect(result.canEvolve).toBe(true)
    expect(result.nextSpeciesId).toBe(134) // 第一个分支目标
  })

  it('两阶段宝可梦的二阶段不能继续进化', () => {
    const result = checkEvolution(26, 2, 99, 99) // 雷丘
    expect(result.canEvolve).toBe(false)
  })
})

describe('getEvolutionChainDisplay', () => {
  it('妙蛙种子显示3阶段', () => {
    const chain = getEvolutionChainDisplay(1)
    expect(chain.maxStage).toBe(3)
    expect(chain.stages.filter(s => !s.isBranch)).toHaveLength(3)
    expect(chain.stages[0].isCurrent).toBe(true) // 当前是妙蛙种子
    expect(chain.stages[0].name).toBe('妙蛙种子')
  })

  it('中间形态正确标记当前', () => {
    const chain = getEvolutionChainDisplay(5) // 火恐龙
    const current = chain.stages.find(s => s.isCurrent)
    expect(current).toBeDefined()
    expect(current!.name).toBe('火恐龙')
    expect(current!.stage).toBe(2)
  })

  it('皮卡丘显示2阶段', () => {
    const chain = getEvolutionChainDisplay(25)
    expect(chain.maxStage).toBe(2)
    const nonBranch = chain.stages.filter(s => !s.isBranch)
    expect(nonBranch).toHaveLength(2)
  })

  it('伊布显示分支', () => {
    const chain = getEvolutionChainDisplay(133)
    const branches = chain.stages.filter(s => s.isBranch)
    expect(branches.length).toBeGreaterThan(0)
  })

  it('未知宝可梦返回单阶段', () => {
    const chain = getEvolutionChainDisplay(999)
    expect(chain.maxStage).toBe(1)
    expect(chain.stages).toHaveLength(1)
  })
})

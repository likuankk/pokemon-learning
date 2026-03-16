import { describe, it, expect } from 'vitest'
import {
  calculateRewards,
  getDifficultyMultiplier,
  getLevelUpThreshold,
  calculateLevel,
  calculateStatUpdates,
  getPokemonStatus,
  getStreakMilestoneReward,
  checkEvolution,
  getEvolutionStage,
  getBaseSpeciesId,
  getEvolutionTargets,
  getEvolutionRequirements,
  getEvolutionChainDisplay,
  POKEMON_NAMES,
  POKEMON_TYPES,
  EVOLUTION_PATHS,
  statusLabels,
  itemLabels,
  itemEmojis,
  subjectColors,
  type ItemReward,
  type PokemonStatus,
} from '@/lib/game-logic'

describe('Integration - Complete Task Flow Simulation', () => {
  it('simulates a full task→reward→stat update→level→evolution flow', () => {
    // 1. Child completes a quality-5, difficulty-5 task
    const rewards = calculateRewards(5)
    expect(rewards.food).toBe(3)
    expect(rewards.crystal).toBe(2)
    expect(rewards.candy).toBe(2)
    expect(rewards.fragment).toBe(0.5)

    // 2. Calculate stat updates
    const stats = calculateStatUpdates(rewards, 5, 60, 60, 60, 7)
    expect(stats.vitality).toBeGreaterThan(60)
    expect(stats.wisdom).toBeGreaterThan(60)
    expect(stats.affection).toBeGreaterThan(60)

    // 3. After many tasks, check level
    const level = calculateLevel(30)
    expect(level).toBeGreaterThan(1)

    // 4. Accumulate fragments (0.5 per perfect task × many tasks)
    // At level 10+, with 3+ fragments, can evolve
    const evoCheck = checkEvolution(1, 1, 10, 3)
    expect(evoCheck.canEvolve).toBe(true)
    expect(evoCheck.nextSpeciesId).toBe(2) // 妙蛙种子 → 妙蛙草
  })

  it('simulates low-quality task gives minimal rewards', () => {
    const rewards = calculateRewards(1)
    const stats = calculateStatUpdates(rewards, 1, 50, 50, 50, 0)
    // food=2, difficulty=1 (1.0x), vitality gain = 2
    expect(stats.gains.vitality).toBe(2)
    // crystal=0, wisdom gain = 0
    expect(stats.gains.wisdom).toBe(0)
    // no streak, affection = 0
    expect(stats.gains.affection).toBe(0)
  })

  it('simulates multiple difficulty levels affecting rewards', () => {
    const rewards = calculateRewards(4)
    const statsD1 = calculateStatUpdates(rewards, 1, 50, 50, 50, 1)
    const statsD5 = calculateStatUpdates(rewards, 5, 50, 50, 50, 1)
    // Higher difficulty should give more vitality gain
    expect(statsD5.gains.vitality).toBeGreaterThan(statsD1.gains.vitality)
    // Wisdom doesn't change with difficulty (based on crystal only)
    expect(statsD5.gains.wisdom).toBe(statsD1.gains.wisdom)
  })
})

describe('Evolution System - Complete Scenarios', () => {
  it('three-stage evolution: 妙蛙种子 → 妙蛙草 → 妙蛙花', () => {
    // Stage 1: 妙蛙种子 can evolve
    const evo1 = checkEvolution(1, 1, 10, 3)
    expect(evo1.canEvolve).toBe(true)
    expect(evo1.nextSpeciesId).toBe(2) // → 妙蛙草

    // Stage 2: 妙蛙草 can evolve
    const evo2 = checkEvolution(2, 2, 20, 5)
    expect(evo2.canEvolve).toBe(true)
    expect(evo2.nextSpeciesId).toBe(3) // → 妙蛙花

    // Stage 3: 妙蛙花 can't evolve (max)
    const evo3 = checkEvolution(3, 3, 99, 99)
    expect(evo3.canEvolve).toBe(false)
  })

  it('two-stage evolution: 皮卡丘 → 雷丘', () => {
    const evo = checkEvolution(25, 1, 10, 3)
    expect(evo.canEvolve).toBe(true)
    expect(evo.nextSpeciesId).toBe(26)

    const evo2 = checkEvolution(26, 2, 99, 99)
    expect(evo2.canEvolve).toBe(false)
  })

  it('Eevee branch evolution - choose specific target', () => {
    // Choose water eevee
    const evoWater = checkEvolution(133, 1, 10, 3, 134)
    expect(evoWater.canEvolve).toBe(true)
    expect(evoWater.nextSpeciesId).toBe(134) // 水伊布

    // Choose fire eevee
    const evoFire = checkEvolution(133, 1, 10, 3, 136)
    expect(evoFire.canEvolve).toBe(true)
    expect(evoFire.nextSpeciesId).toBe(136) // 火伊布

    // Choose thunder eevee
    const evoThunder = checkEvolution(133, 1, 10, 3, 135)
    expect(evoThunder.canEvolve).toBe(true)
    expect(evoThunder.nextSpeciesId).toBe(135) // 雷伊布
  })

  it('Eevee with invalid target falls back to first option', () => {
    const evo = checkEvolution(133, 1, 10, 3, 999) // invalid target
    expect(evo.canEvolve).toBe(true)
    expect(evo.nextSpeciesId).toBe(134) // first branch option
  })

  it('evolution chain for all starter pokemon families', () => {
    const starters = [
      { base: 1, chain: [1, 2, 3] },
      { base: 4, chain: [4, 5, 6] },
      { base: 7, chain: [7, 8, 9] },
    ]
    for (const starter of starters) {
      for (const id of starter.chain) {
        expect(getBaseSpeciesId(id)).toBe(starter.base)
      }
      const display = getEvolutionChainDisplay(starter.chain[0])
      expect(display.maxStage).toBe(3)
      expect(display.stages).toHaveLength(3)
    }
  })

  it('unknown species returns self as base', () => {
    expect(getBaseSpeciesId(999)).toBe(999)
  })

  it('unknown species has stage 1', () => {
    expect(getEvolutionStage(999)).toBe(1)
  })

  it('unknown species cannot evolve', () => {
    const targets = getEvolutionTargets(999, 1)
    expect(targets).toHaveLength(0)
  })

  it('unknown species chain display shows single entry', () => {
    const display = getEvolutionChainDisplay(999)
    expect(display.stages).toHaveLength(1)
    expect(display.stages[0].isCurrent).toBe(true)
    expect(display.stages[0].name).toBe('???')
    expect(display.maxStage).toBe(1)
  })

  it('all evolution requirements are progressive', () => {
    const req1 = getEvolutionRequirements(1)
    const req2 = getEvolutionRequirements(2)
    expect(req2.level).toBeGreaterThan(req1.level)
    expect(req2.fragments).toBeGreaterThan(req1.fragments)
  })

  it('stage 3+ evolution requirements are unreachable', () => {
    const req = getEvolutionRequirements(3)
    expect(req.level).toBe(999)
    expect(req.fragments).toBe(999)
  })
})

describe('Labels and Mappings Completeness', () => {
  it('all PokemonStatus values have labels', () => {
    const statuses: PokemonStatus[] = ['energetic', 'good', 'tired', 'sad']
    for (const s of statuses) {
      expect(statusLabels[s]).toBeDefined()
      expect(statusLabels[s].length).toBeGreaterThan(0)
    }
  })

  it('all item types have labels', () => {
    const types = ['food', 'crystal', 'candy', 'fragment']
    for (const t of types) {
      expect(itemLabels[t]).toBeDefined()
      expect(itemEmojis[t]).toBeDefined()
    }
  })

  it('all subjects have colors', () => {
    const subjects = ['语文', '数学', '英语', '科学', '其他']
    for (const s of subjects) {
      expect(subjectColors[s]).toBeDefined()
    }
  })

  it('POKEMON_NAMES covers all species in EVOLUTION_PATHS', () => {
    for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
      for (const id of pathDef.chain) {
        expect(POKEMON_NAMES[id]).toBeDefined()
      }
      if (pathDef.branches) {
        for (const ids of Object.values(pathDef.branches)) {
          for (const id of ids) {
            expect(POKEMON_NAMES[id]).toBeDefined()
          }
        }
      }
    }
  })

  it('POKEMON_TYPES covers all species in EVOLUTION_PATHS', () => {
    for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
      for (const id of pathDef.chain) {
        expect(POKEMON_TYPES[id]).toBeDefined()
      }
      if (pathDef.branches) {
        for (const ids of Object.values(pathDef.branches)) {
          for (const id of ids) {
            expect(POKEMON_TYPES[id]).toBeDefined()
          }
        }
      }
    }
  })
})

describe('Stat Calculations - Detailed Scenarios', () => {
  it('zero rewards give no stat gains (except streak affection)', () => {
    const rewards: ItemReward = { food: 0, crystal: 0, candy: 0, fragment: 0 }
    const result = calculateStatUpdates(rewards, 3, 50, 50, 50, 0)
    expect(result.gains.vitality).toBe(0)
    expect(result.gains.wisdom).toBe(0)
    expect(result.gains.affection).toBe(0)
    expect(result.vitality).toBe(50)
    expect(result.wisdom).toBe(50)
    expect(result.affection).toBe(50)
  })

  it('streak milestones: 1-day streak gives +1 affection', () => {
    const rewards: ItemReward = { food: 0, crystal: 0, candy: 0, fragment: 0 }
    const result = calculateStatUpdates(rewards, 1, 50, 50, 50, 1)
    expect(result.gains.affection).toBe(1)
  })

  it('streak milestones: 3-day streak gives +2 affection', () => {
    const rewards: ItemReward = { food: 0, crystal: 0, candy: 0, fragment: 0 }
    const result = calculateStatUpdates(rewards, 1, 50, 50, 50, 3)
    expect(result.gains.affection).toBe(2)
  })

  it('streak milestones: 7-day streak gives +3 affection', () => {
    const rewards: ItemReward = { food: 0, crystal: 0, candy: 0, fragment: 0 }
    const result = calculateStatUpdates(rewards, 1, 50, 50, 50, 7)
    expect(result.gains.affection).toBe(3)
  })

  it('streak milestones: 100-day streak still gives +3', () => {
    const rewards: ItemReward = { food: 0, crystal: 0, candy: 0, fragment: 0 }
    const result = calculateStatUpdates(rewards, 1, 50, 50, 50, 100)
    expect(result.gains.affection).toBe(3)
  })

  it('stats cap at 100 even with extreme values', () => {
    const rewards: ItemReward = { food: 999, crystal: 999, candy: 999, fragment: 999 }
    const result = calculateStatUpdates(rewards, 5, 99.9, 99.9, 99.9, 30)
    expect(result.vitality).toBe(100)
    expect(result.wisdom).toBe(100)
    expect(result.affection).toBe(100)
  })

  it('all values are rounded to 1 decimal place', () => {
    const rewards: ItemReward = { food: 1, crystal: 1, candy: 0, fragment: 0 }
    const result = calculateStatUpdates(rewards, 3, 33.33, 44.44, 55.55, 2)
    // Check that values have at most 1 decimal
    expect(Number(result.vitality.toFixed(1))).toBe(result.vitality)
    expect(Number(result.wisdom.toFixed(1))).toBe(result.wisdom)
    expect(Number(result.affection.toFixed(1))).toBe(result.affection)
  })

  it('difficulty multipliers cover all values 1-5', () => {
    for (let d = 1; d <= 5; d++) {
      const m = getDifficultyMultiplier(d)
      expect(m).toBeGreaterThanOrEqual(1.0)
      expect(m).toBeLessThanOrEqual(1.5)
    }
  })

  it('unknown difficulty falls back to 1.2', () => {
    expect(getDifficultyMultiplier(0)).toBe(1.2)
    expect(getDifficultyMultiplier(6)).toBe(1.2)
    expect(getDifficultyMultiplier(-1)).toBe(1.2)
  })
})

describe('Level System - Detailed', () => {
  it('exact level boundaries', () => {
    // Level 1: 0-2 tasks (need 3 to level up)
    expect(calculateLevel(0)).toBe(1)
    expect(calculateLevel(1)).toBe(1)
    expect(calculateLevel(2)).toBe(1)
    expect(calculateLevel(3)).toBe(2) // 3 tasks → level 2

    // Level 2: need 5 more (3+2) → total 8
    expect(calculateLevel(7)).toBe(2)
    expect(calculateLevel(8)).toBe(3) // 3+5=8 → level 3

    // Level 3: need 7 more → total 15
    expect(calculateLevel(14)).toBe(3)
    expect(calculateLevel(15)).toBe(4) // 3+5+7=15 → level 4
  })

  it('getLevelUpThreshold matches calculateLevel boundaries', () => {
    // At each level, threshold should be correct
    expect(getLevelUpThreshold(1)).toBe(3)
    expect(getLevelUpThreshold(2)).toBe(5)
    expect(getLevelUpThreshold(3)).toBe(7)
    expect(getLevelUpThreshold(4)).toBe(9)
  })

  it('very high task counts produce reasonable levels', () => {
    const level = calculateLevel(1000)
    expect(level).toBeGreaterThan(10)
    expect(level).toBeLessThan(100)
  })
})

describe('Pokemon Status - Boundary Values', () => {
  it('average exactly 80 is energetic', () => {
    expect(getPokemonStatus(80, 80, 80)).toBe('energetic')
  })

  it('average exactly 60 is good', () => {
    expect(getPokemonStatus(60, 60, 60)).toBe('good')
  })

  it('average exactly 40 is tired', () => {
    expect(getPokemonStatus(40, 40, 40)).toBe('tired')
  })

  it('average just below 80 is good', () => {
    expect(getPokemonStatus(79, 79, 79)).toBe('good')
  })

  it('average just below 60 is tired', () => {
    expect(getPokemonStatus(59, 59, 59)).toBe('tired')
  })

  it('average just below 40 is sad', () => {
    expect(getPokemonStatus(39, 39, 39)).toBe('sad')
  })

  it('uneven stats: one high, others low', () => {
    // avg = (100 + 0 + 0) / 3 ≈ 33.3 → tired
    expect(getPokemonStatus(100, 0, 0)).toBe('sad')
    // avg = (100 + 100 + 0) / 3 ≈ 66.7 → good
    expect(getPokemonStatus(100, 100, 0)).toBe('good')
  })
})

describe('Streak Milestones - All Values', () => {
  it('streak of 3 gives candy', () => {
    const reward = getStreakMilestoneReward(3)
    expect(reward).not.toBeNull()
    expect(reward!.candy).toBe(2)
  })

  it('streak of 7 gives crystal', () => {
    const reward = getStreakMilestoneReward(7)
    expect(reward).not.toBeNull()
    expect(reward!.crystal).toBe(1)
  })

  it('streak of 30 gives fragment', () => {
    const reward = getStreakMilestoneReward(30)
    expect(reward).not.toBeNull()
    expect(reward!.fragment).toBe(1)
  })

  it('non-milestone streaks return null', () => {
    for (const n of [1, 2, 4, 5, 6, 8, 9, 10, 15, 20, 25, 28, 29, 31, 50, 100]) {
      expect(getStreakMilestoneReward(n)).toBeNull()
    }
  })
})

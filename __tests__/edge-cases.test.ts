import { describe, it, expect } from 'vitest'
import {
  checkEvolution,
  getBaseSpeciesId,
  getEvolutionTargets,
  getEvolutionStage,
  getEvolutionChainDisplay,
  getEvolutionRequirements,
  POKEMON_NAMES,
  POKEMON_TYPES,
  EVOLUTION_PATHS,
  calculateRewards,
  calculateStatUpdates,
  calculateLevel,
  getPokemonStatus,
  getStreakMilestoneReward,
} from '@/lib/game-logic'

describe('Edge Cases - Evolution System', () => {
  // ── Eevee branch evolution edge cases ──
  describe('伊布分支进化边界', () => {
    it('伊布分支进化后不能继续进化 (水伊布)', () => {
      const result = checkEvolution(134, 2, 99, 99) // 水伊布 stage 2
      expect(result.canEvolve).toBe(false)
    })

    it('伊布分支进化后不能继续进化 (火伊布)', () => {
      const result = checkEvolution(136, 2, 99, 99)
      expect(result.canEvolve).toBe(false)
    })

    it('伊布默认进化链的chain长度为2', () => {
      expect(EVOLUTION_PATHS[133].chain).toHaveLength(2)
    })

    it('所有伊布进化形态的base都是133', () => {
      expect(getBaseSpeciesId(134)).toBe(133)
      expect(getBaseSpeciesId(135)).toBe(133)
      expect(getBaseSpeciesId(136)).toBe(133)
    })

    it('伊布的getEvolutionTargets返回分支而非默认chain', () => {
      const targets = getEvolutionTargets(133, 1)
      // 分支应该覆盖默认chain
      expect(targets).toHaveLength(3)
      expect(targets).toContain(134)
      expect(targets).toContain(135)
      expect(targets).toContain(136)
    })
  })

  // ── Evolution stage consistency ──
  describe('进化阶段一致性', () => {
    it('所有已定义的species在POKEMON_NAMES和POKEMON_TYPES中都存在', () => {
      for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
        for (const id of pathDef.chain) {
          expect(POKEMON_NAMES[id]).toBeDefined()
          expect(POKEMON_TYPES[id]).toBeDefined()
        }
        if (pathDef.branches) {
          for (const ids of Object.values(pathDef.branches)) {
            for (const id of ids) {
              expect(POKEMON_NAMES[id]).toBeDefined()
              expect(POKEMON_TYPES[id]).toBeDefined()
            }
          }
        }
      }
    })

    it('chain display对每个进化形态都能正确生成', () => {
      const allSpeciesIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 26, 39, 40, 133, 134, 135, 136]
      for (const id of allSpeciesIds) {
        const chain = getEvolutionChainDisplay(id)
        expect(chain.stages.length).toBeGreaterThan(0)
        expect(chain.maxStage).toBeGreaterThan(0)
        // 应该有且仅有一个isCurrent
        const currentStages = chain.stages.filter(s => s.isCurrent)
        expect(currentStages.length).toBe(1)
      }
    })

    it('getEvolutionStage和chain stage一致', () => {
      // For non-branch species
      expect(getEvolutionStage(1)).toBe(1)  // 妙蛙种子 = stage 1
      expect(getEvolutionStage(2)).toBe(2)  // 妙蛙草 = stage 2
      expect(getEvolutionStage(3)).toBe(3)  // 妙蛙花 = stage 3
      expect(getEvolutionStage(25)).toBe(1) // 皮卡丘 = stage 1
      expect(getEvolutionStage(26)).toBe(2) // 雷丘 = stage 2
    })
  })

  // ── Boundary conditions ──
  describe('边界条件', () => {
    it('等级恰好等于进化需求', () => {
      const result = checkEvolution(1, 1, 10, 3)
      expect(result.canEvolve).toBe(true)
    })

    it('等级差一级不能进化', () => {
      const result = checkEvolution(1, 1, 9, 3)
      expect(result.canEvolve).toBe(false)
    })

    it('碎片恰好等于进化需求', () => {
      const result = checkEvolution(1, 1, 10, 3)
      expect(result.canEvolve).toBe(true)
    })

    it('碎片差一个不能进化', () => {
      const result = checkEvolution(1, 1, 10, 2)
      expect(result.canEvolve).toBe(false)
    })

    it('等级0的宝可梦', () => {
      expect(calculateLevel(0)).toBe(1) // 最低等级是1
    })

    it('属性为0不会crash', () => {
      const status = getPokemonStatus(0, 0, 0)
      expect(status).toBe('sad')
    })

    it('属性为100', () => {
      const status = getPokemonStatus(100, 100, 100)
      expect(status).toBe('energetic')
    })

    it('负数碎片不能进化', () => {
      const result = checkEvolution(1, 1, 10, -1)
      expect(result.canEvolve).toBe(false)
    })
  })

  // ── Level calculation edge cases ──
  describe('等级计算边界', () => {
    it('连续等级的任务数阈值递增', () => {
      let prev = 0
      for (let tasks = 0; tasks <= 100; tasks++) {
        const level = calculateLevel(tasks)
        expect(level).toBeGreaterThanOrEqual(prev)
        prev = level
      }
    })

    it('calculateLevel是单调递增的', () => {
      for (let i = 0; i < 50; i++) {
        expect(calculateLevel(i + 1)).toBeGreaterThanOrEqual(calculateLevel(i))
      }
    })
  })

  // ── Stat calculation edge cases ──
  describe('属性计算边界', () => {
    it('所有返回值都不超过100', () => {
      const rewards = { food: 100, crystal: 100, candy: 100, fragment: 100 }
      const result = calculateStatUpdates(rewards, 5, 99, 99, 99, 60)
      expect(result.vitality).toBeLessThanOrEqual(100)
      expect(result.wisdom).toBeLessThanOrEqual(100)
      expect(result.affection).toBeLessThanOrEqual(100)
    })

    it('gains不为负数', () => {
      const rewards = { food: 1, crystal: 0, candy: 0, fragment: 0 }
      const result = calculateStatUpdates(rewards, 1, 50, 50, 50, 0)
      expect(result.gains.vitality).toBeGreaterThanOrEqual(0)
      expect(result.gains.wisdom).toBeGreaterThanOrEqual(0)
      expect(result.gains.affection).toBeGreaterThanOrEqual(0)
    })
  })

  // ── Streak milestone edge cases ──
  describe('打卡里程碑边界', () => {
    it('streak 0不触发里程碑', () => {
      expect(getStreakMilestoneReward(0)).toBeNull()
    })

    it('milestone rewards只在精确数值触发', () => {
      expect(getStreakMilestoneReward(2)).toBeNull()
      expect(getStreakMilestoneReward(3)).not.toBeNull()
      expect(getStreakMilestoneReward(4)).toBeNull()
      expect(getStreakMilestoneReward(6)).toBeNull()
      expect(getStreakMilestoneReward(7)).not.toBeNull()
      expect(getStreakMilestoneReward(8)).toBeNull()
      expect(getStreakMilestoneReward(29)).toBeNull()
      expect(getStreakMilestoneReward(30)).not.toBeNull()
      expect(getStreakMilestoneReward(31)).toBeNull()
    })
  })

  // ── Reward calculation for different scores ──
  describe('奖励等级', () => {
    it('高分给的奖励多于低分', () => {
      const low = calculateRewards(1)
      const high = calculateRewards(5)
      expect(high.food).toBeGreaterThanOrEqual(low.food)
      expect(high.crystal).toBeGreaterThanOrEqual(low.crystal)
      expect(high.candy).toBeGreaterThanOrEqual(low.candy)
      expect(high.fragment).toBeGreaterThanOrEqual(low.fragment)
    })

    it('只有满分给碎片', () => {
      expect(calculateRewards(1).fragment).toBe(0)
      expect(calculateRewards(2).fragment).toBe(0)
      expect(calculateRewards(3).fragment).toBe(0)
      expect(calculateRewards(4).fragment).toBe(0)
      expect(calculateRewards(5).fragment).toBeGreaterThan(0)
    })
  })
})

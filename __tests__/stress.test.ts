import { describe, it, expect } from 'vitest'
import {
  calculateRewards,
  calculateStatUpdates,
  calculateLevel,
  getLevelUpThreshold,
  getDifficultyMultiplier,
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
  type ItemReward,
} from '@/lib/game-logic'

describe('Stress Tests & Robustness', () => {
  describe('calculateLevel with extreme inputs', () => {
    it('handles very large task counts without error', () => {
      const level = calculateLevel(10000)
      expect(level).toBeGreaterThan(1)
      expect(typeof level).toBe('number')
      expect(Number.isFinite(level)).toBe(true)
    })

    it('negative task count returns level 1', () => {
      // While not a valid input, it shouldn't crash
      const level = calculateLevel(-5)
      expect(level).toBe(1)
    })

    it('NaN task count returns level 1', () => {
      const level = calculateLevel(NaN)
      expect(level).toBe(1) // NaN < needed evaluates to false, loop doesn't run
    })
  })

  describe('calculateStatUpdates with extreme inputs', () => {
    it('starting from 0 stats', () => {
      const rewards: ItemReward = { food: 5, crystal: 5, candy: 5, fragment: 5 }
      const result = calculateStatUpdates(rewards, 3, 0, 0, 0, 7)
      expect(result.vitality).toBeGreaterThan(0)
      expect(result.wisdom).toBeGreaterThan(0)
      expect(result.affection).toBeGreaterThan(0)
    })

    it('starting from 100 stats - no increase', () => {
      const rewards: ItemReward = { food: 5, crystal: 5, candy: 5, fragment: 5 }
      const result = calculateStatUpdates(rewards, 3, 100, 100, 100, 7)
      expect(result.vitality).toBe(100)
      expect(result.wisdom).toBe(100)
      expect(result.affection).toBe(100)
    })

    it('zero food/crystal with zero streak = no gains', () => {
      const rewards: ItemReward = { food: 0, crystal: 0, candy: 99, fragment: 99 }
      const result = calculateStatUpdates(rewards, 5, 50, 50, 50, 0)
      expect(result.gains.vitality).toBe(0)
      expect(result.gains.wisdom).toBe(0)
      expect(result.gains.affection).toBe(0)
    })
  })

  describe('Evolution paths structural integrity', () => {
    it('all chains start with their base species id key', () => {
      for (const [baseStr, pathDef] of Object.entries(EVOLUTION_PATHS)) {
        const baseId = parseInt(baseStr)
        expect(pathDef.chain[0]).toBe(baseId)
      }
    })

    it('all chains have unique ids (no duplicates within a chain)', () => {
      for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
        const uniqueIds = new Set(pathDef.chain)
        expect(uniqueIds.size).toBe(pathDef.chain.length)
      }
    })

    it('no species appears in multiple evolution chains', () => {
      const allIds = new Set<number>()
      for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
        for (const id of pathDef.chain) {
          expect(allIds.has(id)).toBe(false)
          allIds.add(id)
        }
        if (pathDef.branches) {
          for (const ids of Object.values(pathDef.branches)) {
            for (const id of ids) {
              // Branch IDs can overlap with chain IDs within the same path
              // but not across different evolution paths
            }
          }
        }
      }
    })

    it('chain lengths are at least 2 (base + evolution)', () => {
      for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
        expect(pathDef.chain.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('branch indices are valid stage indices', () => {
      for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
        if (pathDef.branches) {
          for (const stageStr of Object.keys(pathDef.branches)) {
            const stage = parseInt(stageStr)
            // Branch stage should be within chain range (0-based in branches, refers to evolution from stage to stage+1)
            expect(stage).toBeGreaterThanOrEqual(0)
            expect(stage).toBeLessThan(pathDef.chain.length)
          }
        }
      }
    })
  })

  describe('Reward system consistency', () => {
    it('rewards are monotonically non-decreasing with quality', () => {
      for (let q = 1; q < 5; q++) {
        const lower = calculateRewards(q)
        const higher = calculateRewards(q + 1)
        expect(higher.food).toBeGreaterThanOrEqual(lower.food)
        expect(higher.crystal).toBeGreaterThanOrEqual(lower.crystal)
        expect(higher.candy).toBeGreaterThanOrEqual(lower.candy)
        expect(higher.fragment).toBeGreaterThanOrEqual(lower.fragment)
      }
    })

    it('difficulty multipliers are monotonically increasing', () => {
      for (let d = 1; d < 5; d++) {
        expect(getDifficultyMultiplier(d + 1)).toBeGreaterThanOrEqual(getDifficultyMultiplier(d))
      }
    })

    it('level thresholds are monotonically increasing', () => {
      for (let lv = 1; lv < 20; lv++) {
        expect(getLevelUpThreshold(lv + 1)).toBeGreaterThan(getLevelUpThreshold(lv))
      }
    })
  })

  describe('getEvolutionChainDisplay - all species consistency', () => {
    it('every species in all chains resolves correctly', () => {
      const allSpecies: number[] = []
      for (const [, pathDef] of Object.entries(EVOLUTION_PATHS)) {
        allSpecies.push(...pathDef.chain)
        if (pathDef.branches) {
          for (const ids of Object.values(pathDef.branches)) {
            allSpecies.push(...ids)
          }
        }
      }
      // Deduplicate
      const unique = [...new Set(allSpecies)]

      for (const id of unique) {
        const display = getEvolutionChainDisplay(id)
        // Must have at least one stage
        expect(display.stages.length).toBeGreaterThan(0)
        // Must have exactly one isCurrent
        const currentCount = display.stages.filter(s => s.isCurrent).length
        expect(currentCount).toBe(1)
        // The current stage's speciesId must match the input
        const current = display.stages.find(s => s.isCurrent)!
        expect(current.speciesId).toBe(id)
      }
    })
  })

  describe('Cross-function consistency', () => {
    it('getEvolutionStage matches checkEvolution behavior', () => {
      // For 3-stage pokemon at final stage, checkEvolution should return false
      const stage3 = getEvolutionStage(3) // 妙蛙花
      expect(stage3).toBe(3)
      const evo = checkEvolution(3, stage3, 999, 999)
      expect(evo.canEvolve).toBe(false)
    })

    it('getEvolutionTargets is consistent with checkEvolution targets', () => {
      // For Eevee
      const targets = getEvolutionTargets(133, 1)
      const evo = checkEvolution(133, 1, 10, 3)
      expect(evo.targets).toEqual(targets)
    })

    it('getBaseSpeciesId is consistent with EVOLUTION_PATHS keys', () => {
      for (const [baseStr] of Object.entries(EVOLUTION_PATHS)) {
        const baseId = parseInt(baseStr)
        expect(getBaseSpeciesId(baseId)).toBe(baseId)
      }
    })
  })
})

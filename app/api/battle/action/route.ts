import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession, getChildId } from '@/lib/auth'
import {
  calculateDamage, wildAIChooseSkill, applyStatusDamage, canAct,
  attemptCapture, calculateBattleRewards, checkBattleLevelUp,
  getUnlockedSkillSlots, calcBattlePower, calcDefense, calcHP,
  BOSS_REWARDS,
  type PokemonType, type ActiveStatus, type BallType, type BattleState
} from '@/lib/battle-logic'
import { activeBattles } from '../encounter/route'

// POST /api/battle/action - Execute a battle action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session = await getSession()
    const childId = getChildId(session)
    const { battleId, action, skillId, ballType } = body
    const sqlite = (db as any).session.client

    // Get battle state
    const battle = activeBattles.get(battleId)
    if (!battle || battle.childId !== childId) {
      return NextResponse.json({ error: '战斗不存在或已结束' }, { status: 400 })
    }
    if (battle.status !== 'ongoing') {
      return NextResponse.json({ error: '战斗已结束' }, { status: 400 })
    }

    battle.round++
    const result: any = { roundNumber: battle.round, battleStatus: 'ongoing' }

    // ── FLEE ────────────────────────────────────────────────────
    if (action === 'flee') {
      battle.status = 'flee'
      // Log
      sqlite.prepare(
        'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds) VALUES (?,?,?,?,?,?,?)'
      ).run(childId, battle.playerPokemonId, battle.wild.speciesId, battle.wild.level, battle.region, 'flee', battle.round)
      sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1 WHERE child_id = ?').run(childId)

      activeBattles.delete(battleId)
      return NextResponse.json({ battleStatus: 'flee', message: '成功逃跑了！' })
    }

    // ── CAPTURE ─────────────────────────────────────────────────
    if (action === 'capture') {
      const bt = (ballType || 'pokeball') as BallType
      // Check ball inventory
      const ballInv = sqlite.prepare('SELECT quantity FROM inventory WHERE child_id = ? AND item_type = ?').get(childId, bt) as any
      if (!ballInv || ballInv.quantity < 1) {
        return NextResponse.json({ error: `${bt === 'pokeball' ? '精灵球' : bt === 'greatball' ? '超级球' : bt === 'ultraball' ? '高级球' : '大师球'}不足！` }, { status: 400 })
      }

      // Deduct ball
      sqlite.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE child_id = ? AND item_type = ?').run(childId, bt)

      const captureResult = attemptCapture(battle.wild.hp, battle.wild.maxHp, bt, battle.wild.rarity)

      if (captureResult.success) {
        battle.status = 'captured'

        // Check species limit (max 3 of same species, 1 for legendary)
        const ownedCount = (sqlite.prepare(
          'SELECT COUNT(*) as c FROM pokemons WHERE child_id = ? AND species_id = ?'
        ).get(childId, battle.wild.speciesId) as any).c
        const maxOwn = battle.wild.rarity >= 5 ? 1 : 3

        if (ownedCount >= maxOwn) {
          // Already at limit
          activeBattles.delete(battleId)
          sqlite.prepare(
            'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds) VALUES (?,?,?,?,?,?,?)'
          ).run(childId, battle.playerPokemonId, battle.wild.speciesId, battle.wild.level, battle.region, 'capture', battle.round)
          sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1, total_wins = total_wins + 1 WHERE child_id = ?').run(childId)
          return NextResponse.json({
            battleStatus: 'captured',
            captureSuccess: true,
            message: `收服成功！但你已经有${maxOwn}只${battle.wild.name}了，超出限制释放了~`,
            captureRate: captureResult.rate,
          })
        }

        // Add to team
        const now = new Date().toISOString()
        const insertResult = sqlite.prepare(
          `INSERT INTO pokemons (child_id, species_id, name, vitality, wisdom, affection, level, battle_power, defense, hp, speed, battle_exp, battle_level, is_active, source, last_updated, created_at)
           VALUES (?,?,?,50,50,30,1,?,?,?,?,0,?,0,'captured',?,?)`
        ).run(
          childId, battle.wild.speciesId, battle.wild.name,
          battle.wild.battlePower, battle.wild.defense, battle.wild.maxHp, battle.wild.speed,
          battle.wild.level,
          now, now
        )

        // Assign initial skill
        const species = sqlite.prepare('SELECT skill1 FROM species_catalog WHERE id = ?').get(battle.wild.speciesId) as any
        if (species?.skill1) {
          sqlite.prepare('INSERT OR IGNORE INTO pokemon_skills (pokemon_id, skill_id, slot) VALUES (?, ?, 1)')
            .run(insertResult.lastInsertRowid, species.skill1)
        }

        // Log
        sqlite.prepare(
          'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds, captured_pokemon_id) VALUES (?,?,?,?,?,?,?,?)'
        ).run(childId, battle.playerPokemonId, battle.wild.speciesId, battle.wild.level, battle.region, 'capture', battle.round, insertResult.lastInsertRowid)
        sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1, total_wins = total_wins + 1 WHERE child_id = ?').run(childId)

        activeBattles.delete(battleId)
        return NextResponse.json({
          battleStatus: 'captured',
          captureSuccess: true,
          capturedPokemonId: insertResult.lastInsertRowid,
          message: `成功收服了 ${battle.wild.name}！`,
          captureRate: captureResult.rate,
        })
      } else {
        // Capture failed - wild gets a turn
        result.captureAttempt = { success: false, rate: captureResult.rate, ballType: bt }

        // Wild pokemon attacks
        const wildSkill = wildAIChooseSkill(
          battle.wild.skills, battle.wild.level,
          battle.playerType1, battle.playerType2,
          battle.wild.hp, battle.wild.maxHp
        )
        const wildDmg = calculateDamage(
          battle.wild.battlePower, wildSkill.power, wildSkill.type,
          wildSkill.accuracy,
          battle.playerDefense,
          battle.playerType1, battle.playerType2,
          0, battle.wildAttackBuff, battle.playerDefenseBuff,
        )
        battle.playerHP = Math.max(0, battle.playerHP - wildDmg.damage)

        result.wildTurn = {
          action: 'skill',
          skillName: wildSkill.name,
          skillType: wildSkill.type,
          damage: wildDmg.damage,
          effectiveness: wildDmg.effectiveness,
          missed: wildDmg.missed,
          playerHpAfter: battle.playerHP,
        }

        if (battle.playerHP <= 0) {
          battle.status = 'lose'
          result.battleStatus = 'lose'
          sqlite.prepare(
            'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds) VALUES (?,?,?,?,?,?,?)'
          ).run(childId, battle.playerPokemonId, battle.wild.speciesId, battle.wild.level, battle.region, 'lose', battle.round)
          sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1 WHERE child_id = ?').run(childId)
          activeBattles.delete(battleId)
          result.message = '宝可梦需要继续成长！多完成学习任务来变强吧！'
        }

        return NextResponse.json(result)
      }
    }

    // ── SKILL ───────────────────────────────────────────────────
    if (action === 'skill') {
      const playerSkill = battle.playerSkills.find(s => s.id === skillId)
      if (!playerSkill) {
        return NextResponse.json({ error: '无效的技能' }, { status: 400 })
      }
      if (playerSkill.currentPP <= 0) {
        return NextResponse.json({ error: '技能PP不足' }, { status: 400 })
      }

      // Decrease buffs
      if (battle.playerBuffTurns > 0) {
        battle.playerBuffTurns--
        if (battle.playerBuffTurns === 0) { battle.playerAttackBuff = 0; battle.playerDefenseBuff = 0 }
      }
      if (battle.wildBuffTurns > 0) {
        battle.wildBuffTurns--
        if (battle.wildBuffTurns === 0) { battle.wildAttackBuff = 0; battle.wildDefenseBuff = 0 }
      }

      // Status effects
      let playerCanAct = true
      let wildCanAct = true

      if (battle.playerStatus) {
        playerCanAct = canAct(battle.playerStatus)
        battle.playerStatus.turnsRemaining--
        if (battle.playerStatus.turnsRemaining <= 0) battle.playerStatus = null
        // Status damage (burn)
        if (battle.playerStatus?.type === 'burn') {
          const statusDmg = applyStatusDamage(battle.playerMaxHP, battle.playerStatus)
          battle.playerHP = Math.max(0, battle.playerHP - statusDmg)
        }
      }
      if (battle.wildStatus) {
        wildCanAct = canAct(battle.wildStatus)
        battle.wildStatus.turnsRemaining--
        if (battle.wildStatus.turnsRemaining <= 0) battle.wildStatus = null
        if (battle.wildStatus?.type === 'burn') {
          const statusDmg = applyStatusDamage(battle.wild.maxHp, battle.wildStatus)
          battle.wild.hp = Math.max(0, battle.wild.hp - statusDmg)
        }
      }

      // Determine turn order by speed
      const playerFirst = battle.playerSpeed >= battle.wild.speed

      const executePlayerTurn = () => {
        if (!playerCanAct) {
          return { action: 'status', message: `${battle.playerName}无法行动！`, playerHpAfter: battle.playerHP }
        }
        playerSkill.currentPP--

        // Handle support skills
        const effect = playerSkill.effect ? JSON.parse(playerSkill.effect) : null
        if (playerSkill.power === 0 && effect) {
          if (effect.type === 'heal') {
            const healAmt = Math.round(battle.playerMaxHP * effect.amount)
            battle.playerHP = Math.min(battle.playerMaxHP, battle.playerHP + healAmt)
            return { action: 'skill', skillName: playerSkill.name, skillType: playerSkill.type, damage: 0, healed: healAmt, effectiveness: 'normal' as const, missed: false, critical: false, playerHpAfter: battle.playerHP }
          }
          if (effect.type === 'attack_up') {
            battle.playerAttackBuff = effect.amount
            battle.playerBuffTurns = effect.duration
            return { action: 'skill', skillName: playerSkill.name, skillType: playerSkill.type, damage: 0, buffed: 'attack', effectiveness: 'normal' as const, missed: false, critical: false }
          }
          if (effect.type === 'defense_up') {
            battle.playerDefenseBuff = effect.amount
            battle.playerBuffTurns = effect.duration
            return { action: 'skill', skillName: playerSkill.name, skillType: playerSkill.type, damage: 0, buffed: 'defense', effectiveness: 'normal' as const, missed: false, critical: false }
          }
          if (effect.type === 'sleep') {
            const hit = Math.random() * 100 <= playerSkill.accuracy
            if (hit) {
              battle.wildStatus = { type: 'sleep', turnsRemaining: 1 + Math.floor(Math.random() * 2) }
              return { action: 'skill', skillName: playerSkill.name, skillType: playerSkill.type, damage: 0, statusApplied: 'sleep', effectiveness: 'normal' as const, missed: false, critical: false }
            }
            return { action: 'skill', skillName: playerSkill.name, skillType: playerSkill.type, damage: 0, effectiveness: 'normal' as const, missed: true, critical: false }
          }
        }

        const dmg = calculateDamage(
          battle.playerBP, playerSkill.power, playerSkill.type as PokemonType,
          playerSkill.accuracy,
          battle.wild.defense,
          battle.wild.type1, battle.wild.type2,
          0, battle.playerAttackBuff, battle.wildDefenseBuff,
        )
        battle.wild.hp = Math.max(0, battle.wild.hp - dmg.damage)

        // Check if skill applies status
        if (effect && dmg.damage > 0) {
          if (['burn', 'paralyze', 'freeze'].includes(effect.type) && Math.random() * 100 < (effect.chance || 0)) {
            battle.wildStatus = { type: effect.type, turnsRemaining: effect.type === 'freeze' ? 1 : 3 }
          }
        }

        return {
          action: 'skill',
          skillName: playerSkill.name,
          skillType: playerSkill.type,
          damage: dmg.damage,
          effectiveness: dmg.effectiveness,
          critical: dmg.critical,
          missed: dmg.missed,
          wildHpAfter: battle.wild.hp,
          statusApplied: battle.wildStatus?.type || null,
        }
      }

      const executeWildTurn = () => {
        if (!wildCanAct) {
          return { action: 'status', message: `野生${battle.wild.name}无法行动！`, wildHpAfter: battle.wild.hp }
        }
        const wildSkill = wildAIChooseSkill(
          battle.wild.skills, battle.wild.level,
          battle.playerType1, battle.playerType2,
          battle.wild.hp, battle.wild.maxHp
        )

        // Handle wild support skills
        const effect = wildSkill.effect ? JSON.parse(wildSkill.effect) : null
        if (wildSkill.power === 0 && effect) {
          if (effect.type === 'heal') {
            const healAmt = Math.round(battle.wild.maxHp * effect.amount)
            battle.wild.hp = Math.min(battle.wild.maxHp, battle.wild.hp + healAmt)
            return { action: 'skill', skillName: wildSkill.name, skillType: wildSkill.type, damage: 0, healed: healAmt, effectiveness: 'normal' as const, missed: false }
          }
          if (effect.type === 'attack_up') {
            battle.wildAttackBuff = effect.amount
            battle.wildBuffTurns = effect.duration
            return { action: 'skill', skillName: wildSkill.name, skillType: wildSkill.type, damage: 0, buffed: 'attack', effectiveness: 'normal' as const, missed: false }
          }
          if (effect.type === 'defense_up') {
            battle.wildDefenseBuff = effect.amount
            battle.wildBuffTurns = effect.duration
            return { action: 'skill', skillName: wildSkill.name, skillType: wildSkill.type, damage: 0, buffed: 'defense', effectiveness: 'normal' as const, missed: false }
          }
          return { action: 'skill', skillName: wildSkill.name, skillType: wildSkill.type, damage: 0, effectiveness: 'normal' as const, missed: false }
        }

        const wildDmg = calculateDamage(
          battle.wild.battlePower, wildSkill.power, wildSkill.type,
          wildSkill.accuracy,
          battle.playerDefense,
          battle.playerType1, battle.playerType2,
          0, battle.wildAttackBuff, battle.playerDefenseBuff,
        )
        battle.playerHP = Math.max(0, battle.playerHP - wildDmg.damage)

        // Status effect from wild
        if (effect && wildDmg.damage > 0) {
          if (['burn', 'paralyze', 'freeze'].includes(effect.type) && Math.random() * 100 < (effect.chance || 0)) {
            battle.playerStatus = { type: effect.type as any, turnsRemaining: effect.type === 'freeze' ? 1 : 3 }
          }
        }

        return {
          action: 'skill',
          skillName: wildSkill.name,
          skillType: wildSkill.type,
          damage: wildDmg.damage,
          effectiveness: wildDmg.effectiveness,
          critical: wildDmg.critical,
          missed: wildDmg.missed,
          playerHpAfter: battle.playerHP,
        }
      }

      // Execute turns
      if (playerFirst) {
        result.playerTurn = executePlayerTurn()
        // Check if wild fainted
        if (battle.wild.hp <= 0) {
          return finishBattle(battle, result, 'win', sqlite, childId)
        }
        result.wildTurn = executeWildTurn()
        if (battle.playerHP <= 0) {
          return finishBattle(battle, result, 'lose', sqlite, childId)
        }
      } else {
        result.wildTurn = executeWildTurn()
        if (battle.playerHP <= 0) {
          return finishBattle(battle, result, 'lose', sqlite, childId)
        }
        result.playerTurn = executePlayerTurn()
        if (battle.wild.hp <= 0) {
          return finishBattle(battle, result, 'win', sqlite, childId)
        }
      }

      result.playerHP = battle.playerHP
      result.playerMaxHP = battle.playerMaxHP
      result.wildHP = battle.wild.hp
      result.wildMaxHP = battle.wild.maxHp
      result.playerStatus = battle.playerStatus
      result.wildStatus = battle.wildStatus

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/battle/action error:', error)
    return NextResponse.json({ error: 'Battle action failed' }, { status: 500 })
  }
}

function finishBattle(
  battle: BattleState,
  result: any,
  outcome: 'win' | 'lose',
  sqlite: any,
  childId: number
) {
  battle.status = outcome
  result.battleStatus = outcome

  if (outcome === 'win') {
    // Calculate rewards
    const rewards = calculateBattleRewards(battle.wild.level, battle.wild.rarity)

    // Apply exp
    const pokemon = sqlite.prepare('SELECT battle_level, battle_exp, species_id FROM pokemons WHERE id = ?').get(battle.playerPokemonId) as any
    const species = sqlite.prepare('SELECT base_power, base_speed, skill1, skill2, skill3, skill4 FROM species_catalog WHERE id = ?').get(pokemon.species_id) as any

    const newExpTotal = (pokemon.battle_exp || 0) + rewards.exp
    const levelResult = checkBattleLevelUp(pokemon.battle_level || 1, newExpTotal)

    // Update pokemon
    const newBP = calcBattlePower(species.base_power, levelResult.newLevel)
    const newDef = calcDefense(species.base_power, levelResult.newLevel)
    const newHP = calcHP(species.base_power, levelResult.newLevel)

    sqlite.prepare(
      `UPDATE pokemons SET battle_exp = ?, battle_level = ?, battle_power = ?, defense = ?, hp = ?, last_updated = datetime('now') WHERE id = ?`
    ).run(levelResult.newExp, levelResult.newLevel, newBP, newDef, newHP, battle.playerPokemonId)

    // Sync main level if battle_level exceeds it
    try {
      sqlite.prepare(
        `UPDATE pokemons SET level = ? WHERE id = ? AND (level IS NULL OR level < ?)`
      ).run(levelResult.newLevel, battle.playerPokemonId, levelResult.newLevel)
    } catch (e) { /* ignore */ }

    // Unlock new skills if leveled up
    const newSkillSlots = getUnlockedSkillSlots(levelResult.newLevel)
    const skillFields = ['skill1', 'skill2', 'skill3', 'skill4'] as const
    const newSkills: string[] = []
    for (const slot of newSkillSlots) {
      const fieldName = skillFields[slot - 1]
      if (species[fieldName]) {
        const existing = sqlite.prepare('SELECT id FROM pokemon_skills WHERE pokemon_id = ? AND slot = ?').get(battle.playerPokemonId, slot)
        if (!existing) {
          sqlite.prepare('INSERT OR IGNORE INTO pokemon_skills (pokemon_id, skill_id, slot) VALUES (?, ?, ?)')
            .run(battle.playerPokemonId, species[fieldName], slot)
          const skillInfo = sqlite.prepare('SELECT name FROM skills WHERE id = ?').get(species[fieldName]) as any
          if (skillInfo) newSkills.push(skillInfo.name)
        }
      }
    }

    // Add rewards to inventory
    if (rewards.candy > 0) {
      sqlite.prepare(`INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'candy', ?) ON CONFLICT(child_id, item_type) DO UPDATE SET quantity = quantity + ?`)
        .run(childId, rewards.candy, rewards.candy)
      // Fallback: ensure inventory row exists
      const candyInv = sqlite.prepare("SELECT id FROM inventory WHERE child_id = ? AND item_type = 'candy'").get(childId)
      if (!candyInv) {
        sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'candy', ?)").run(childId, rewards.candy)
      } else {
        sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'candy'").run(rewards.candy, childId)
      }
    }
    if (rewards.pokeball > 0) {
      const pbInv = sqlite.prepare("SELECT id FROM inventory WHERE child_id = ? AND item_type = 'pokeball'").get(childId)
      if (!pbInv) {
        sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'pokeball', ?)").run(childId, rewards.pokeball)
      } else {
        sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'pokeball'").run(rewards.pokeball, childId)
      }
    }
    if (rewards.fragment > 0) {
      const fragInv = sqlite.prepare("SELECT id FROM inventory WHERE child_id = ? AND item_type = 'fragment'").get(childId)
      if (!fragInv) {
        sqlite.prepare("INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, 'fragment', ?)").run(childId, rewards.fragment)
      } else {
        sqlite.prepare("UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = 'fragment'").run(rewards.fragment, childId)
      }
    }

    // Boss special rewards
    let bossRewards: any = null
    if (battle.isBoss && battle.bossType) {
      const regionUnlock = sqlite.prepare('SELECT * FROM region_unlocks WHERE child_id = ? AND region = ?').get(childId, battle.region) as any
      const field = battle.bossType === 'boss' ? 'boss_defeated' : 'elite_defeated'
      if (regionUnlock && regionUnlock[field] === 0) {
        sqlite.prepare(`UPDATE region_unlocks SET ${field} = 1 WHERE child_id = ? AND region = ?`).run(childId, battle.region)

        if (battle.bossType === 'boss') {
          const bossRewardData = BOSS_REWARDS[battle.region]
          if (bossRewardData) {
            bossRewards = bossRewardData
            for (const [itemType, amount] of Object.entries(bossRewardData.items)) {
              const inv = sqlite.prepare('SELECT id FROM inventory WHERE child_id = ? AND item_type = ?').get(childId, itemType)
              if (!inv) {
                sqlite.prepare('INSERT INTO inventory (child_id, item_type, quantity) VALUES (?, ?, ?)').run(childId, itemType, amount)
              } else {
                sqlite.prepare('UPDATE inventory SET quantity = quantity + ? WHERE child_id = ? AND item_type = ?').run(amount, childId, itemType)
              }
            }
          }
        }
      }
    }

    // Log
    sqlite.prepare(
      'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds, exp_gained) VALUES (?,?,?,?,?,?,?,?)'
    ).run(childId, battle.playerPokemonId, battle.wild.speciesId, battle.wild.level, battle.region, 'win', battle.round, rewards.exp)
    sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1, total_wins = total_wins + 1 WHERE child_id = ?').run(childId)

    result.rewards = rewards
    result.levelUp = levelResult.levelsGained > 0 ? {
      oldLevel: pokemon.battle_level,
      newLevel: levelResult.newLevel,
      levelsGained: levelResult.levelsGained,
    } : null
    result.newSkills = newSkills
    result.bossRewards = bossRewards
    result.message = '战斗胜利！'
  } else {
    // Loss
    sqlite.prepare(
      'INSERT INTO battle_logs (child_id, pokemon_id, wild_species_id, wild_level, region, result, rounds) VALUES (?,?,?,?,?,?,?)'
    ).run(childId, battle.playerPokemonId, battle.wild.speciesId, battle.wild.level, battle.region, 'lose', battle.round)
    sqlite.prepare('UPDATE battle_energy SET total_battles = total_battles + 1 WHERE child_id = ?').run(childId)
    result.message = '宝可梦需要继续成长！多完成学习任务来变强吧！'
  }

  activeBattles.delete(battle.battleId)
  return NextResponse.json(result)
}

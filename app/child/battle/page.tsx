'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ToastProvider'

// ── Types ─────────────────────────────────────────────────────────────────

interface Region {
  id: number; name: string; emoji: string; minLevel: number; maxLevel: number
  unlocked: boolean; bossDefeated: boolean; eliteDefeated: boolean; unlockWins: number
}

interface PokemonInfo {
  id: number; name: string; speciesId: number; emoji: string
  type1: string; type2: string | null; battleLevel: number; battleExp: number
  battlePower: number; defense: number; hp: number; speed: number
  skills: SkillInfo[]
}

interface SkillInfo {
  id: string; name: string; type: string; power: number
  accuracy: number; pp: number; currentPP: number; slot?: number
}

interface WildPokemon {
  speciesId: number; name: string; emoji: string; type1: string; type2: string | null
  level: number; hp: number; maxHp: number; battlePower: number; rarity: number
  skills: { id: string; name: string; type: string; power: number }[]
  weakTo?: string[]; resistTo?: string[]
}

interface BattleData {
  battleId: string; wild: WildPokemon; myPokemon: PokemonInfo
  energyRemaining: number; isBoss: boolean; bossType?: string; region?: number
}

interface TeamMember {
  id: number; name: string; speciesId: number; type1: string; type2: string | null
  battleLevel: number; battlePower: number; hp: number; isActive: boolean
  emoji: string; source: string
}

type GamePhase = 'map' | 'encounter' | 'battle' | 'result' | 'team' | 'shop' | 'pokedex'

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

const TYPE_COLORS: Record<string, string> = {
  fire: '#EF4444', water: '#3B82F6', grass: '#22C55E', electric: '#EAB308',
  ground: '#A16207', ice: '#06B6D4', flying: '#818CF8', bug: '#84CC16',
  normal: '#9CA3AF', fairy: '#EC4899',
}

const TYPE_NAMES: Record<string, string> = {
  fire: '火', water: '水', grass: '草', electric: '电', ground: '地',
  ice: '冰', flying: '飞', bug: '虫', normal: '一般', fairy: '妖精',
}

const EFFECTIVENESS_LABELS: Record<string, { text: string; color: string }> = {
  super_effective: { text: '效果拔群！', color: '#EF4444' },
  not_effective: { text: '效果不佳...', color: '#9CA3AF' },
  normal: { text: '', color: '' },
}

export default function BattlePage() {
  const { showToast } = useToast()
  const [phase, setPhase] = useState<GamePhase>('map')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Map state
  const [energy, setEnergy] = useState({ current: 0, max: 5, totalWins: 0, totalBattles: 0 })
  const [regions, setRegions] = useState<Region[]>([])
  const [activePokemon, setActivePokemon] = useState<PokemonInfo | null>(null)
  const [balls, setBalls] = useState<Record<string, number>>({})
  const [pokedex, setPokedex] = useState({ discovered: 0, total: 55 })
  const [team, setTeam] = useState<TeamMember[]>([])

  // Battle state
  const [battleData, setBattleData] = useState<BattleData | null>(null)
  const [playerHP, setPlayerHP] = useState(0)
  const [playerMaxHP, setPlayerMaxHP] = useState(0)
  const [wildHP, setWildHP] = useState(0)
  const [wildMaxHP, setWildMaxHP] = useState(0)
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [roundNum, setRoundNum] = useState(0)

  // Result state
  const [battleResult, setBattleResult] = useState<any>(null)

  // Quiz state
  const [quizQuestion, setQuizQuestion] = useState<any>(null)
  const [quizPhase, setQuizPhase] = useState<'none' | 'answering' | 'result'>('none')
  const [quizAnswer, setQuizAnswer] = useState<{ correct: boolean; fast: boolean } | null>(null)
  const [quizCombo, setQuizCombo] = useState(0)
  const [quizTimer, setQuizTimer] = useState(0)

  // Pending skill (user clicked a skill, quiz is shown, after answering auto-attack)
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null)

  // Tactic state
  const [showTactics, setShowTactics] = useState(false)
  const [canTactic, setCanTactic] = useState(false)

  // ── Load Data ──────────────────────────────────────────────────────────

  const loadBattleStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/battle')
      const data = await res.json()
      if (data.energy) setEnergy(data.energy)
      if (data.regions) setRegions(data.regions)
      setActivePokemon(data.activePokemon ?? null)
      if (data.balls) setBalls(data.balls)
      if (data.pokedex) setPokedex(data.pokedex)
      if (data.team) setTeam(data.team)
    } catch (e) {
      console.error('Failed to load battle status:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBattleStatus() }, [loadBattleStatus])

  // ── Start Encounter ────────────────────────────────────────────────────

  const startEncounter = async (regionId: number, challengeBoss = false, challengeElite = false) => {
    if (energy.current < 1) {
      showToast('战斗能量不足！完成学习任务来获得能量吧！', 'error')
      return
    }
    if (!activePokemon) {
      showToast('请先选择出战宝可梦', 'error')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/battle/encounter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: regionId, challengeBoss, challengeElite }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error, 'error'); return }

      setBattleData({ ...data, region: regionId })
      setPlayerHP(data.myPokemon.hp)
      setPlayerMaxHP(data.myPokemon.hp)
      setWildHP(data.wild.hp)
      setWildMaxHP(data.wild.maxHp)
      setBattleLog([`遇到了野生 ${data.wild.name}！`])
      setRoundNum(0)
      setEnergy(prev => ({ ...prev, current: data.energyRemaining }))
      setQuizCombo(0)
      setQuizAnswer(null)
      setQuizPhase('none')
      setPendingSkillId(null)
      setCanTactic(false)
      setShowTactics(false)
      setPhase('encounter')

      // Short delay then go to battle (no quiz preload — quiz shows after clicking a skill)
      setTimeout(() => {
        setPhase('battle')
      }, 1500)
    } catch (e) {
      showToast('遭遇失败', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Fetch Quiz ────────────────────────────────────────────────────────
  const fetchQuiz = async (regionId: number) => {
    try {
      const res = await fetch(`/api/quiz?region=${regionId}`)
      if (res.ok) {
        const data = await res.json()
        setQuizQuestion(data)
        setQuizPhase('answering')
        setQuizAnswer(null)
        setQuizTimer(30)
      }
    } catch {
      // Quiz failed to load, skip it
      setQuizPhase('none')
    }
  }

  // ── Battle Action ──────────────────────────────────────────────────────

  const doBattleAction = async (action: string, skillId?: string, ballType?: string, tactic?: string, directQuizResult?: { correct: boolean; fast: boolean } | null) => {
    if (!battleData || actionLoading || battleResult) return
    setActionLoading(true)
    try {
      const reqBody: any = { battleId: battleData.battleId, action, skillId, ballType, tactic }

      // Include quiz result for skill actions (prefer direct param, fallback to state)
      const qr = directQuizResult !== undefined ? directQuizResult : quizAnswer
      if (action === 'skill' && qr !== null && qr !== undefined) {
        reqBody.quizCorrect = qr.correct
        reqBody.quizFast = qr.fast
      }

      const res = await fetch('/api/battle/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error, 'error'); setActionLoading(false); return }

      const newLog: string[] = []

      // Process tactic used
      if (data.tacticUsed) {
        newLog.push(`${data.tacticUsed.emoji} 使用战术：${data.tacticUsed.label}！`)
        if (data.healed) {
          newLog.push(`💊 回复了 ${data.healed} HP！`)
        }
      }

      // Process quiz bonus info
      if (data.quizBonus?.label) {
        newLog.push(data.quizBonus.label)
      }
      if (data.quizBonus?.combo !== undefined) {
        setQuizCombo(data.quizBonus.combo)
      }

      // Process capture attempt
      if (data.captureAttempt) {
        if (data.captureAttempt.success) {
          newLog.push(`收服成功！`)
        } else {
          newLog.push(`精灵球未能收服...（捕获率 ${Math.round(data.captureAttempt.rate * 100)}%）`)
        }
        // Update ball count locally
        if (data.captureAttempt.ballType) {
          setBalls(prev => ({
            ...prev,
            [data.captureAttempt.ballType]: Math.max(0, (prev[data.captureAttempt.ballType] || 0) - 1)
          }))
        }
      }

      // Capture success (direct return from server, no captureAttempt field)
      if (data.battleStatus === 'captured' && data.captureSuccess) {
        if (ballType) {
          setBalls(prev => ({
            ...prev,
            [ballType]: Math.max(0, (prev[ballType] || 0) - 1)
          }))
        }
        newLog.push(`✨ 成功收服了 ${battleData.wild.name}！`)
      }

      // Process player turn
      if (data.playerTurn) {
        const pt = data.playerTurn
        if (pt.action === 'status') {
          newLog.push(pt.message)
        } else if (pt.missed) {
          newLog.push(`${activePokemon?.name}使用了${pt.skillName}...但没有命中！`)
        } else if (pt.healed) {
          newLog.push(`${activePokemon?.name}使用了${pt.skillName}，回复了${pt.healed}HP！`)
        } else if (pt.buffed) {
          newLog.push(`${activePokemon?.name}使用了${pt.skillName}，${pt.buffed === 'attack' ? '攻击力' : '防御力'}提升了！`)
        } else {
          let msg = `${activePokemon?.name}使用了${pt.skillName}，造成${pt.damage}伤害！`
          if (pt.critical) msg += ' 暴击！'
          const eff = EFFECTIVENESS_LABELS[pt.effectiveness]
          if (eff?.text) msg += ` ${eff.text}`
          newLog.push(msg)
        }
        if (pt.wildHpAfter !== undefined) setWildHP(Math.max(0, pt.wildHpAfter))
      }

      // Update PP locally after skill use
      if (action === 'skill' && skillId && activePokemon) {
        setActivePokemon(prev => {
          if (!prev) return prev
          return {
            ...prev,
            skills: prev.skills.map(s =>
              s.id === skillId ? { ...s, currentPP: Math.max(0, s.currentPP - 1) } : s
            )
          }
        })
      }

      // Process wild turn
      if (data.wildTurn) {
        const wt = data.wildTurn
        if (wt.action === 'status') {
          newLog.push(wt.message)
        } else if (wt.missed) {
          newLog.push(`野生${battleData.wild.name}使用了${wt.skillName}...但没有命中！`)
        } else if (wt.healed) {
          newLog.push(`野生${battleData.wild.name}使用了${wt.skillName}，回复了${wt.healed}HP！`)
        } else {
          let msg = `野生${battleData.wild.name}使用了${wt.skillName}，造成${wt.damage}伤害！`
          if (wt.critical) msg += ' 暴击！'
          const eff = EFFECTIVENESS_LABELS[wt.effectiveness]
          if (eff?.text) msg += ` ${eff.text}`
          newLog.push(msg)
        }
        if (wt.playerHpAfter !== undefined) setPlayerHP(Math.max(0, wt.playerHpAfter))
      }

      // Update HP from response
      if (data.playerHP !== undefined) setPlayerHP(data.playerHP)
      if (data.wildHP !== undefined) setWildHP(data.wildHP)

      setRoundNum(data.roundNumber || roundNum + 1)
      setBattleLog(prev => [...prev, ...newLog])

      // Update tactic availability
      if (data.canUseTactic !== undefined) {
        setCanTactic(data.canUseTactic)
      }

      // Check battle end
      if (data.battleStatus === 'win' || data.battleStatus === 'lose' || data.battleStatus === 'flee' || data.battleStatus === 'captured') {
        setBattleResult(data)
        setActionLoading(true) // Keep buttons disabled until phase switches
        setQuizPhase('none')
        setTimeout(() => setPhase('result'), 800)
        return // Skip finally's setActionLoading(false)
      }

      // Load next quiz for next round — no longer auto-fetch;
      // quiz will be fetched when user clicks a skill
      setQuizAnswer(null)
      setQuizPhase('none')
      setPendingSkillId(null)
      setShowTactics(false)
    } catch (e) {
      showToast('行动失败', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Switch Active Pokemon ──────────────────────────────────────────────

  const switchActive = async (pokemonId: number) => {
    try {
      const res = await fetch('/api/battle/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActive', pokemonId }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message, 'success')
        await loadBattleStatus()
      } else {
        showToast(data.error, 'error')
      }
    } catch (e) {
      showToast('切换失败', 'error')
    }
  }

  // ── Release Pokemon ────────────────────────────────────────────────────

  const releasePokemon = async (pokemonId: number) => {
    if (!confirm('确定要释放这只宝可梦吗？此操作不可撤销！')) return
    try {
      const res = await fetch('/api/battle/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release', pokemonId }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message, 'success')
        await loadBattleStatus()
      } else {
        showToast(data.error, 'error')
      }
    } catch (e) {
      showToast('释放失败', 'error')
    }
  }

  // ── Buy Balls ──────────────────────────────────────────────────────────

  const buyBalls = async (ballType: string, quantity: number) => {
    try {
      const res = await fetch('/api/battle/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ballType, quantity }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message, 'success')
        await loadBattleStatus()
      } else {
        showToast(data.error, 'error')
      }
    } catch (e) {
      showToast('购买失败', 'error')
    }
  }

  // ── Return to Map ──────────────────────────────────────────────────────

  const returnToMap = useCallback(() => {
    setPhase('map')
    setBattleData(null)
    setBattleResult(null)
    setBattleLog([])
    loadBattleStatus()
  }, [loadBattleStatus])

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}
          className="w-16 h-16 rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)' }}>
      <AnimatePresence mode="wait">
        {phase === 'map' && <MapView key="map" energy={energy} regions={regions} activePokemon={activePokemon}
          balls={balls} pokedex={pokedex} team={team} onEncounter={startEncounter} onTeam={() => setPhase('team')}
          onShop={() => setPhase('shop')} onPokedex={() => setPhase('pokedex')} actionLoading={actionLoading} />}

        {phase === 'encounter' && battleData && (
          <EncounterView key="encounter" wild={battleData.wild} isBoss={battleData.isBoss} />
        )}

        {phase === 'battle' && battleData && activePokemon && (
          <BattleView key="battle" battleData={battleData} activePokemon={activePokemon}
            playerHP={playerHP} playerMaxHP={playerMaxHP} wildHP={wildHP} wildMaxHP={wildMaxHP}
            battleLog={battleLog} roundNum={roundNum} balls={balls}
            onAction={doBattleAction} actionLoading={actionLoading}
            quizQuestion={quizQuestion} quizPhase={quizPhase} quizCombo={quizCombo}
            quizTimer={quizTimer}
            onQuizAnswer={(correct: boolean, fast: boolean) => {
              const quizResult = { correct, fast }
              setQuizAnswer(quizResult)
              setQuizPhase('result')
              // Auto-execute the pending skill after quiz + explanation
              if (pendingSkillId) {
                const sid = pendingSkillId
                setPendingSkillId(null)
                setTimeout(() => {
                  doBattleAction('skill', sid, undefined, undefined, quizResult)
                }, 300)
              }
            }}
            onQuizSkip={() => {
              setQuizAnswer(null)
              setQuizPhase('none')
              // Auto-execute the pending skill even when skipped (no quiz bonus)
              if (pendingSkillId) {
                const sid = pendingSkillId
                setPendingSkillId(null)
                setTimeout(() => {
                  doBattleAction('skill', sid, undefined, undefined, null)
                }, 300)
              }
            }}
            onSkillClick={async (skillId: string) => {
              setPendingSkillId(skillId)
              // Fetch quiz and show it
              await fetchQuiz(battleData.region || 1)
            }}
            pendingSkillId={pendingSkillId}
            canTactic={canTactic} showTactics={showTactics} setShowTactics={setShowTactics}
          />
        )}

        {phase === 'result' && (
          <ResultView key="result" result={battleResult} wild={battleData?.wild || null}
            pokemon={activePokemon} onReturn={returnToMap} />
        )}

        {phase === 'team' && (
          <TeamView key="team" team={team} onSwitch={switchActive} onRelease={releasePokemon}
            onBack={() => { setPhase('map'); loadBattleStatus() }} />
        )}

        {phase === 'shop' && (
          <ShopView key="shop" balls={balls} onBuy={buyBalls}
            onBack={() => { setPhase('map'); loadBattleStatus() }} />
        )}

        {phase === 'pokedex' && (
          <PokedexView key="pokedex" onBack={() => { setPhase('map'); loadBattleStatus() }} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAP VIEW
// ════════════════════════════════════════════════════════════════════════════

function MapView({ energy, regions, activePokemon, balls, pokedex, team, onEncounter, onTeam, onShop, onPokedex, actionLoading }: {
  energy: any; regions: Region[]; activePokemon: PokemonInfo | null
  balls: Record<string, number>; pokedex: any; team: TeamMember[]
  onEncounter: (region: number, boss?: boolean, elite?: boolean) => void
  onTeam: () => void; onShop: () => void; onPokedex: () => void; actionLoading: boolean
}) {
  const DIFFICULTY: Record<number, { label: string; stars: string; color: string }> = {
    1: { label: '简单', stars: '★☆☆', color: '#22C55E' },
    2: { label: '普通', stars: '★★☆', color: '#EAB308' },
    3: { label: '普通', stars: '★★☆', color: '#EAB308' },
    4: { label: '困难', stars: '★★★', color: '#F97316' },
    5: { label: '极难', stars: '★★★', color: '#EF4444' },
    6: { label: '传说', stars: '★★★', color: '#A855F7' },
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          ⚔️ 宝可梦战斗
        </h1>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl text-white font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>
            ⚡ {energy.current}/{energy.max}
          </div>
          <div className="px-4 py-2 rounded-xl text-white font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>
            🏆 {energy.totalWins}胜
          </div>
        </div>
      </div>

      {/* Active Pokemon */}
      {activePokemon && (
        <div className="rounded-2xl p-4 mb-6 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <img src={HOME_SPRITE(activePokemon.speciesId)} alt={activePokemon.name} width={80} height={80}
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} />
          <div>
            <p className="text-white font-bold text-xl" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
              {activePokemon.name}
              <span className="ml-2 text-teal-300 text-lg">Lv.{activePokemon.battleLevel}</span>
            </p>
            <div className="flex gap-2 mt-1">
              <TypeBadge type={activePokemon.type1} />
              {activePokemon.type2 && <TypeBadge type={activePokemon.type2} />}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              战斗力 {Math.round(activePokemon.battlePower)} | HP {Math.round(activePokemon.hp)} | 技能 {activePokemon.skills.length}个
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={onShop}
              className="px-4 py-2 rounded-xl font-bold text-white hover:opacity-80 transition"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
              🛒 商店
            </button>
            <button onClick={onTeam}
              className="px-4 py-2 rounded-xl font-bold text-white hover:opacity-80 transition"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
              🎒 队伍
            </button>
          </div>
        </div>
      )}

      {/* Regions */}
      <div className="space-y-3">
        {regions.map(region => {
          const diff = DIFFICULTY[region.id]
          return (
            <motion.div key={region.id}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{
                background: region.unlocked ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${region.unlocked ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                opacity: region.unlocked ? 1 : 0.6,
              }}
              whileHover={region.unlocked ? { scale: 1.01 } : {}}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{region.emoji}</span>
                  <div>
                    <p className="text-white font-bold text-lg" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                      {region.name}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Lv.{region.minLevel}-{region.maxLevel}
                      {diff && <span className="ml-2" style={{ color: diff.color }}>{diff.stars} {diff.label}</span>}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {region.eliteDefeated && <span className="text-xs px-2 py-0.5 rounded bg-yellow-600/30 text-yellow-300">精英已击败</span>}
                      {region.bossDefeated && <span className="text-xs px-2 py-0.5 rounded bg-red-600/30 text-red-300">BOSS已击败</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {region.unlocked ? (
                    <>
                      <button onClick={() => onEncounter(region.id)} disabled={actionLoading || energy.current < 1}
                        className="px-5 py-3 rounded-xl font-bold text-white disabled:opacity-40 transition hover:brightness-110"
                        style={{ background: 'linear-gradient(135deg, #10B981, #059669)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                        ⚔️ 战斗
                      </button>
                      {!region.eliteDefeated && (
                        <button onClick={() => onEncounter(region.id, false, true)} disabled={actionLoading || energy.current < 1}
                          className="px-4 py-3 rounded-xl font-bold text-white disabled:opacity-40 transition hover:brightness-110"
                          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '0.85rem' }}>
                          精英
                        </button>
                      )}
                      {region.eliteDefeated && !region.bossDefeated && (
                        <button onClick={() => onEncounter(region.id, true)} disabled={actionLoading || energy.current < 1}
                          className="px-4 py-3 rounded-xl font-bold text-white disabled:opacity-40 transition hover:brightness-110"
                          style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '0.85rem' }}>
                          BOSS
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="px-5 py-3 rounded-xl font-bold text-gray-500" style={{ background: 'rgba(255,255,255,0.05)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                      🔒 需{region.unlockWins}胜
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Stats bar */}
      <div className="mt-6 flex gap-4 text-sm text-gray-400 items-center">
        <span>🔴 精灵球 ×{balls.pokeball || 0}</span>
        <span>🔵 超级球 ×{balls.greatball || 0}</span>
        <span>🟡 高级球 ×{balls.ultraball || 0}</span>
        <span>🟣 大师球 ×{balls.masterball || 0}</span>
        <button onClick={onPokedex} className="ml-auto hover:text-white transition cursor-pointer" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          📖 图鉴 {pokedex.discovered}/{pokedex.total}
        </button>
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ENCOUNTER VIEW (transition animation)
// ════════════════════════════════════════════════════════════════════════════

function EncounterView({ wild, isBoss }: { wild: WildPokemon; isBoss: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full text-white"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <img src={HOME_SPRITE(wild.speciesId)} alt={wild.name} width={200} height={200}
          style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.6))' }} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="text-2xl font-bold mt-4"
        style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}
      >
        {isBoss ? '🔥 ' : ''}野生 {wild.name} 出现了！
      </motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="flex gap-2 mt-2">
        <TypeBadge type={wild.type1} />
        {wild.type2 && <TypeBadge type={wild.type2} />}
        <span className="text-gray-400 ml-2">Lv.{wild.level}</span>
        <span className="text-yellow-400">{'★'.repeat(wild.rarity)}</span>
      </motion.div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BATTLE VIEW
// ════════════════════════════════════════════════════════════════════════════

function BattleView({ battleData, activePokemon, playerHP, playerMaxHP, wildHP, wildMaxHP,
  battleLog, roundNum, balls, onAction, actionLoading,
  quizQuestion, quizPhase, quizCombo, quizTimer,
  onQuizAnswer, onQuizSkip, onSkillClick, pendingSkillId,
  canTactic, showTactics, setShowTactics }: {
  battleData: BattleData; activePokemon: PokemonInfo
  playerHP: number; playerMaxHP: number; wildHP: number; wildMaxHP: number
  battleLog: string[]; roundNum: number; balls: Record<string, number>
  onAction: (action: string, skillId?: string, ballType?: string, tactic?: string) => void
  actionLoading: boolean
  quizQuestion: any; quizPhase: 'none' | 'answering' | 'result'; quizCombo: number; quizTimer: number
  onQuizAnswer: (correct: boolean, fast: boolean) => void
  onQuizSkip: () => void
  onSkillClick: (skillId: string) => void
  pendingSkillId: string | null
  canTactic: boolean; showTactics: boolean; setShowTactics: (v: boolean) => void
}) {
  const [showBalls, setShowBalls] = useState(false)
  const [wildShake, setWildShake] = useState(false)
  const [playerShake, setPlayerShake] = useState(false)
  const [effectText, setEffectText] = useState<string | null>(null)
  const wild = battleData.wild

  // Trigger shake animations when HP changes
  useEffect(() => {
    if (roundNum > 0) {
      // Check last log for who got hit
      const lastLog = battleLog[battleLog.length - 1] || ''
      if (lastLog.includes('造成') && lastLog.includes(activePokemon?.name || '')) {
        // Player attacked, wild shakes
        setWildShake(true)
        setTimeout(() => setWildShake(false), 500)
      }
      if (lastLog.includes('造成') && lastLog.includes(wild.name)) {
        // Wild attacked, player shakes
        setPlayerShake(true)
        setTimeout(() => setPlayerShake(false), 500)
      }
      // Effectiveness text
      if (lastLog.includes('效果拔群')) {
        setEffectText('效果拔群！')
        setTimeout(() => setEffectText(null), 1200)
      } else if (lastLog.includes('效果不佳')) {
        setEffectText('效果不佳...')
        setTimeout(() => setEffectText(null), 1200)
      }
    }
  }, [battleLog.length])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="h-full flex flex-col max-w-3xl mx-auto p-4 relative">

      {/* Effectiveness popup */}
      <AnimatePresence>
        {effectText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1.2, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl font-bold text-2xl"
            style={{
              background: effectText.includes('拔群') ? 'linear-gradient(135deg, #EF4444, #F97316)' : 'rgba(107,114,128,0.8)',
              color: 'white',
              fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif",
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {effectText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with combo */}
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-400" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          {battleData.isBoss ? '🔥 ' : ''}第 {roundNum} 回合
        </span>
        {quizCombo >= 2 && (
          <motion.span
            key={quizCombo}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: quizCombo >= 10 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' :
                quizCombo >= 5 ? 'rgba(234,179,8,0.4)' : 'rgba(168,85,247,0.4)',
              color: quizCombo >= 10 ? '#fff' : quizCombo >= 5 ? '#FEF08A' : '#E9D5FF',
              fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif",
            }}
          >
            🔥 {quizCombo}连击
          </motion.span>
        )}
      </div>

      {/* Wild Pokemon */}
      <motion.div
        animate={wildShake ? { x: [0, -8, 8, -8, 8, 0], filter: ['brightness(1)', 'brightness(2)', 'brightness(1)'] } : {}}
        transition={{ duration: 0.4 }}
        className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <motion.img src={HOME_SPRITE(wild.speciesId)} alt={wild.name} width={80} height={80}
            animate={wildShake ? { opacity: [1, 0.3, 1] } : { y: [0, -3, 0] }}
            transition={wildShake ? { duration: 0.3 } : { repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                野生 {wild.name}
              </span>
              <span className="text-gray-400 text-sm">Lv.{wild.level}</span>
              <TypeBadge type={wild.type1} small />
              {wild.type2 && <TypeBadge type={wild.type2} small />}
            </div>
            <HPBar current={wildHP} max={wildMaxHP} />
            {wild.weakTo && wild.weakTo.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-red-400 text-xs">🎯弱点:</span>
                {wild.weakTo.map((t: string) => (
                  <span key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${TYPE_COLORS[t] || '#6B7280'}44`, color: TYPE_COLORS[t] || '#6B7280' }}>
                    {TYPE_NAMES[t] || t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* VS divider */}
      <div className="text-center text-gray-600 text-xs mb-2" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
        ─── ⚔️ VS ⚔️ ───
      </div>

      {/* My Pokemon */}
      <motion.div
        animate={playerShake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <motion.img src={HOME_SPRITE(activePokemon.speciesId)} alt={activePokemon.name} width={80} height={80}
            animate={playerShake ? { opacity: [1, 0.3, 1] } : { y: [0, -3, 0] }}
            transition={playerShake ? { duration: 0.3 } : { repeat: Infinity, duration: 2.5, ease: 'easeInOut', delay: 0.5 }}
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                {activePokemon.name}
              </span>
              <span className="text-teal-300 text-sm">Lv.{activePokemon.battleLevel}</span>
              <TypeBadge type={activePokemon.type1} small />
              {activePokemon.type2 && <TypeBadge type={activePokemon.type2} small />}
            </div>
            <HPBar current={playerHP} max={playerMaxHP} isPlayer />
          </div>
        </div>
      </motion.div>

      {/* Battle Log */}
      <div className="flex-1 rounded-xl p-3 mb-3 overflow-y-auto max-h-32" style={{ background: 'rgba(0,0,0,0.3)' }}>
        {battleLog.slice(-5).map((log, i) => (
          <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className="text-gray-300 text-sm mb-1" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            {log}
          </motion.p>
        ))}
      </div>

      {/* Quiz Overlay */}
      <AnimatePresence>
        {quizPhase === 'answering' && quizQuestion && (
          <QuizOverlay question={quizQuestion} timer={quizTimer} onAnswer={onQuizAnswer} onSkip={onQuizSkip} />
        )}
      </AnimatePresence>

      {/* Action Panel */}
      <div className="space-y-2">
        {/* Tactic chooser (shows every 3 rounds) */}
        {canTactic && !showTactics && quizPhase !== 'answering' && !pendingSkillId && (
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowTactics(true)}
            className="w-full p-3 rounded-xl font-bold text-white text-center transition hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}
          >
            ⚡ 可以选择战术！点击查看
          </motion.button>
        )}

        {showTactics && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2">
            {([
              { type: 'all_out', emoji: '🗡️', label: '全力进攻', desc: '伤害+50%，防御-30%' },
              { type: 'defend', emoji: '🛡️', label: '防御反击', desc: '防御+50%，伤害-20%' },
              { type: 'charge', emoji: '🔄', label: '蓄力', desc: '本回合不攻击，下回合×2' },
              { type: 'heal', emoji: '💊', label: '恢复', desc: '回复25%HP' },
            ] as const).map(t => (
              <button key={t.type}
                onClick={() => { onAction('tactic', undefined, undefined, t.type); setShowTactics(false) }}
                disabled={actionLoading}
                className="p-3 rounded-xl text-white font-bold text-left disabled:opacity-40 transition hover:brightness-110"
                style={{ background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.5)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}
              >
                <span className="text-base">{t.emoji} {t.label}</span>
                <p className="text-xs mt-0.5 opacity-70">{t.desc}</p>
              </button>
            ))}
            <button onClick={() => setShowTactics(false)}
              className="col-span-2 p-2 rounded-xl text-gray-400 text-sm hover:text-white transition"
              style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
              跳过战术，直接使用技能
            </button>
          </motion.div>
        )}

        {/* Skills - only show when not in quiz, not choosing tactics, and no pending skill */}
        {!showTactics && quizPhase !== 'answering' && !pendingSkillId && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {activePokemon.skills.map(skill => (
                <button key={skill.id}
                  onClick={() => onSkillClick(skill.id)}
                  disabled={actionLoading || skill.currentPP <= 0}
                  className="p-3 rounded-xl text-white font-bold text-left disabled:opacity-40 transition hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${TYPE_COLORS[skill.type] || '#6B7280'}88, ${TYPE_COLORS[skill.type] || '#6B7280'}44)`,
                    border: `1px solid ${TYPE_COLORS[skill.type] || '#6B7280'}66`,
                    fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif",
                  }}
                >
                  <span className="text-base">{skill.name}</span>
                  <div className="flex justify-between text-xs mt-0.5 opacity-80">
                    <span>威力 {skill.power || '-'}</span>
                    <span>PP {skill.currentPP}/{skill.pp}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Capture & Flee */}
            <div className="flex gap-2">
              {!showBalls ? (
                <button onClick={() => setShowBalls(true)} disabled={actionLoading}
                  className="flex-1 p-3 rounded-xl font-bold text-white transition hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                  🔴 投精灵球
                </button>
              ) : (
                <div className="flex-1 flex gap-1 items-center">
                  {(['pokeball', 'greatball', 'ultraball', 'masterball'] as const).map(bt => {
                    const names: Record<string, string> = { pokeball: '精灵球', greatball: '超级球', ultraball: '高级球', masterball: '大师球' }
                    const emojis: Record<string, string> = { pokeball: '🔴', greatball: '🔵', ultraball: '🟡', masterball: '🟣' }
                    const qty = balls[bt] || 0
                    return qty > 0 ? (
                      <button key={bt} onClick={() => { onAction('capture', undefined, bt); setShowBalls(false) }}
                        disabled={actionLoading}
                        className="flex-1 p-2 rounded-lg font-bold text-white text-xs transition hover:brightness-110"
                        style={{ background: 'rgba(239,68,68,0.5)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                        {emojis[bt]} {names[bt]} ×{qty}
                      </button>
                    ) : null
                  })}
                  {Object.values(balls).every(qty => !qty || qty <= 0) && (
                    <span className="text-gray-400 text-xs flex-1 text-center" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                      没有精灵球了！去商店购买吧
                    </span>
                  )}
                  <button onClick={() => setShowBalls(false)}
                    className="px-2 rounded-lg text-gray-400 hover:text-white text-sm">✕</button>
                </div>
              )}
              <button onClick={() => onAction('flee')} disabled={actionLoading}
                className="px-6 p-3 rounded-xl font-bold text-gray-300 transition hover:text-white"
                style={{ background: 'rgba(255,255,255,0.1)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                🏃 逃跑
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// RESULT VIEW
// ════════════════════════════════════════════════════════════════════════════

function ResultView({ result, wild, pokemon, onReturn }: {
  result: any; wild: WildPokemon | null; pokemon: PokemonInfo | null; onReturn: () => void
}) {
  const [countdown, setCountdown] = useState(8)
  const countdownRef = useRef(countdown)

  useEffect(() => {
    if (!result) return
    countdownRef.current = 8
    setCountdown(8)
    const timer = setInterval(() => {
      countdownRef.current -= 1
      const next = countdownRef.current
      if (next <= 0) {
        clearInterval(timer)
        setCountdown(0)
        onReturn()
      } else {
        setCountdown(next)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [result, onReturn])

  if (!result) return null

  const isWin = result.battleStatus === 'win'
  const isCaptured = result.battleStatus === 'captured'
  const isLose = result.battleStatus === 'lose'
  const isFlee = result.battleStatus === 'flee'

  // Visual config for each result type
  const resultConfig = isCaptured ? {
    icon: '✨', title: `成功收服 ${wild?.name}！`, subtitle: '新伙伴加入了队伍！',
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.4), rgba(236,72,153,0.3))',
    border: 'rgba(168,85,247,0.6)', titleColor: '#e9d5ff', tag: '🎊 收服成功', tagBg: 'rgba(168,85,247,0.6)',
  } : isWin ? {
    icon: '🏆', title: '战斗胜利！', subtitle: `击败了野生 ${wild?.name}！`,
    gradient: 'linear-gradient(135deg, rgba(234,179,8,0.4), rgba(245,158,11,0.3))',
    border: 'rgba(234,179,8,0.6)', titleColor: '#fef08a', tag: '⚔️ 胜利', tagBg: 'rgba(234,179,8,0.6)',
  } : isLose ? {
    icon: '💔', title: '战斗失败...', subtitle: `${pokemon?.name || '宝可梦'}倒下了`,
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(185,28,28,0.2))',
    border: 'rgba(239,68,68,0.5)', titleColor: '#fca5a5', tag: '😢 失败', tagBg: 'rgba(239,68,68,0.5)',
  } : {
    icon: '🏃', title: '成功逃跑！', subtitle: '安全撤退了',
    gradient: 'linear-gradient(135deg, rgba(156,163,175,0.3), rgba(107,114,128,0.2))',
    border: 'rgba(156,163,175,0.5)', titleColor: '#d1d5db', tag: '🏃 逃跑', tagBg: 'rgba(156,163,175,0.5)',
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full p-6 text-white">

      {/* Result Banner */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-full max-w-sm rounded-3xl p-6 mb-5 text-center"
        style={{ background: resultConfig.gradient, border: `2px solid ${resultConfig.border}` }}
      >
        {/* Status Tag */}
        <motion.span
          initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="inline-block px-4 py-1.5 rounded-full font-bold text-white text-sm mb-3"
          style={{ background: resultConfig.tagBg, fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}
        >
          {resultConfig.tag}
        </motion.span>

        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          className="text-7xl mb-3"
        >
          {resultConfig.icon}
        </motion.div>

        {/* Title */}
        <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", color: resultConfig.titleColor }}>
          {resultConfig.title}
        </h2>

        {/* Subtitle */}
        <p className="text-lg opacity-80" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          {resultConfig.subtitle}
        </p>

        {/* Capture rate info */}
        {isCaptured && result.captureRate && (
          <p className="text-sm mt-2 opacity-60" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            捕获率: {Math.round(result.captureRate * 100)}%
          </p>
        )}
      </motion.div>

      {/* Additional message */}
      {result.message && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-gray-300 text-lg mb-4 text-center max-w-sm" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}
        >
          {result.message}
        </motion.p>
      )}

      {/* Rewards */}
      {(isWin || isCaptured) && result.rewards && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-4 mb-4 w-full max-w-sm" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <p className="font-bold mb-2 text-center text-yellow-300" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>🎁 获得奖励</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span>⭐ 经验 +{result.rewards.exp}</span>
            <span>🍬 星星糖 +{result.rewards.candy}</span>
            {result.rewards.pokeball > 0 && <span>🔴 精灵球 +{result.rewards.pokeball}</span>}
            {result.rewards.fragment > 0 && <span>🪨 碎片 +{result.rewards.fragment}</span>}
          </div>
        </motion.div>
      )}

      {/* Level Up */}
      {result.levelUp && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-4 mb-4 w-full max-w-sm text-center"
          style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.3), rgba(245,158,11,0.3))', border: '1px solid rgba(234,179,8,0.4)' }}>
          <p className="text-xl font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            🎊 升级！Lv.{result.levelUp.oldLevel} → Lv.{result.levelUp.newLevel}
          </p>
        </motion.div>
      )}

      {/* New Skills */}
      {result.newSkills?.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="text-center mb-4">
          <p className="font-bold text-teal-300" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            ✨ 学会了新技能：{result.newSkills.join('、')}
          </p>
        </motion.div>
      )}

      {/* Boss Rewards */}
      {result.bossRewards && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
          className="rounded-2xl p-4 mb-4 w-full max-w-sm text-center"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(139,92,246,0.3))', border: '1px solid rgba(168,85,247,0.4)' }}>
          <p className="text-lg font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            🏆 BOSS击败奖励！
          </p>
          <p className="text-sm text-gray-300 mt-1">{result.bossRewards.description}</p>
        </motion.div>
      )}

      {/* Quiz Stats */}
      {result.quizStats && result.quizStats.totalAnswered > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="rounded-2xl p-4 mb-4 w-full max-w-sm"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <p className="font-bold mb-2 text-center text-indigo-300" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            📝 答题统计
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-300" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            <span>📊 答题数: {result.quizStats.totalAnswered}</span>
            <span>✅ 正确数: {result.quizStats.totalCorrect}</span>
            <span>🎯 正确率: {Math.round((result.quizStats.totalCorrect / result.quizStats.totalAnswered) * 100)}%</span>
            <span>🔥 最高连击: {result.quizStats.maxCombo || 0}</span>
          </div>
          {result.quizStats.maxCombo >= 5 && (
            <motion.p
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="text-center mt-2 text-yellow-300 font-bold text-sm"
              style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
              🌟 学霸加成！知识就是力量！
            </motion.p>
          )}
        </motion.div>
      )}

      {/* Encouragement for loss */}
      {isLose && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-4 mb-4 w-full max-w-sm text-center"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="font-bold text-blue-300" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            💪 多完成学习任务来变强吧！
          </p>
        </motion.div>
      )}

      <button onClick={onReturn}
        className="mt-4 px-8 py-3 rounded-xl font-bold text-white transition hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #10B981, #059669)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '1.2rem' }}>
        返回地图 ({countdown}s)
      </button>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TEAM VIEW
// ════════════════════════════════════════════════════════════════════════════

function TeamView({ team, onSwitch, onRelease, onBack }: {
  team: TeamMember[]; onSwitch: (id: number) => void; onRelease: (id: number) => void; onBack: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          🎒 我的队伍
        </h2>
        <button onClick={onBack}
          className="px-4 py-2 rounded-xl font-bold text-gray-300 hover:text-white transition"
          style={{ background: 'rgba(255,255,255,0.1)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          ← 返回
        </button>
      </div>

      <div className="space-y-3">
        {team.map(poke => (
          <div key={poke.id}
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{
              background: poke.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${poke.isActive ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}>
            <img src={HOME_SPRITE(poke.speciesId)} alt={poke.name} width={64} height={64}
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>{poke.name}</span>
                <span className="text-teal-300 text-sm">Lv.{poke.battleLevel}</span>
                {poke.isActive && <span className="text-xs px-2 py-0.5 rounded bg-teal-600/50 text-teal-200">出战中</span>}
                {poke.source === 'captured' && <span className="text-xs px-2 py-0.5 rounded bg-purple-600/30 text-purple-300">野生</span>}
              </div>
              <div className="flex gap-2 mt-1">
                <TypeBadge type={poke.type1} small />
                {poke.type2 && <TypeBadge type={poke.type2} small />}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                战斗力 {Math.round(poke.battlePower)} | HP {Math.round(poke.hp)}
              </p>
            </div>
            {!poke.isActive && (
              <div className="flex gap-2">
                <button onClick={() => onSwitch(poke.id)}
                  className="px-4 py-2 rounded-xl font-bold text-white text-sm transition hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                  出战
                </button>
                {poke.source === 'captured' && (
                  <button onClick={() => onRelease(poke.id)}
                    className="px-3 py-2 rounded-xl font-bold text-red-300 text-sm transition hover:text-red-200"
                    style={{ background: 'rgba(239,68,68,0.2)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                    释放
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// POKEDEX VIEW
// ════════════════════════════════════════════════════════════════════════════

function PokedexView({ onBack }: { onBack: () => void }) {
  const [species, setSpecies] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, discovered: 0, owned: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<number>(0) // 0 = all, 1-6 = region

  useEffect(() => {
    fetch('/api/battle/species')
      .then(r => r.json())
      .then(d => {
        setSpecies(d.species || [])
        setStats(d.stats || { total: 0, discovered: 0, owned: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  const REGION_NAMES: Record<number, string> = {
    1: '🌿 翠绿森林', 2: '🔥 火山熔岩', 3: '💧 深蓝湖畔',
    4: '⚡ 雷鸣平原', 5: '❄️ 冰雪山脉', 6: '🏆 冠军之路',
  }

  const filtered = filter === 0 ? species : species.filter(s => s.region === filter)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          📖 宝可梦图鉴
        </h2>
        <button onClick={onBack}
          className="px-4 py-2 rounded-xl font-bold text-gray-300 hover:text-white transition"
          style={{ background: 'rgba(255,255,255,0.1)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          ← 返回
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="px-3 py-1 rounded-lg text-teal-300" style={{ background: 'rgba(20,184,166,0.15)' }}>
          发现 {stats.discovered}/{stats.total}
        </span>
        <span className="px-3 py-1 rounded-lg text-purple-300" style={{ background: 'rgba(168,85,247,0.15)' }}>
          持有 {stats.owned}
        </span>
      </div>

      {/* Region filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter(0)}
          className={`px-3 py-1 rounded-lg text-sm font-bold transition ${filter === 0 ? 'text-white' : 'text-gray-400'}`}
          style={{ background: filter === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          全部
        </button>
        {[1, 2, 3, 4, 5, 6].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-3 py-1 rounded-lg text-sm font-bold transition ${filter === r ? 'text-white' : 'text-gray-400'}`}
            style={{ background: filter === r ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
            {REGION_NAMES[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-10">加载中...</div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
          {filtered.map(sp => (
            <motion.div key={sp.id}
              className="rounded-xl p-2 text-center"
              style={{
                background: sp.discovered
                  ? sp.owned ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${sp.owned ? 'rgba(16,185,129,0.3)' : sp.discovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'}`,
                opacity: sp.discovered ? 1 : 0.4,
              }}
              whileHover={{ scale: 1.05 }}
            >
              {sp.discovered ? (
                <img src={HOME_SPRITE(sp.id)} alt={sp.name} width={48} height={48} className="mx-auto"
                  style={{ filter: sp.owned ? 'none' : 'grayscale(0.5) brightness(0.7)' }} />
              ) : (
                <div className="w-12 h-12 mx-auto flex items-center justify-center text-2xl text-gray-600">❓</div>
              )}
              <p className="text-xs mt-1 truncate" style={{
                color: sp.discovered ? '#fff' : '#4B5563',
                fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif",
              }}>
                {sp.discovered ? sp.name : '???'}
              </p>
              {sp.discovered && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  <span className="text-yellow-400 text-xs">{'★'.repeat(sp.rarity)}</span>
                </div>
              )}
              {sp.owned && <span className="text-teal-400 text-xs">拥有</span>}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SHOP VIEW
// ════════════════════════════════════════════════════════════════════════════

function ShopView({ balls, onBuy, onBack }: {
  balls: Record<string, number>; onBuy: (type: string, qty: number) => void; onBack: () => void
}) {
  const items = [
    { type: 'pokeball', name: '精灵球', emoji: '🔴', price: 5, desc: '基础精灵球', mult: '1.0x' },
    { type: 'greatball', name: '超级球', emoji: '🔵', price: 15, desc: '收服率提升50%', mult: '1.5x' },
    { type: 'ultraball', name: '高级球', emoji: '🟡', price: 30, desc: '收服率翻倍', mult: '2.0x' },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          🛒 精灵球商店
        </h2>
        <button onClick={onBack}
          className="px-4 py-2 rounded-xl font-bold text-gray-300 hover:text-white transition"
          style={{ background: 'rgba(255,255,255,0.1)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          ← 返回
        </button>
      </div>

      <p className="text-gray-400 mb-4" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
        使用星星糖购买精灵球来收服野生宝可梦！
      </p>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.type}
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-4xl">{item.emoji}</span>
            <div className="flex-1">
              <p className="text-white font-bold text-lg" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                {item.name}
                <span className="text-gray-400 text-sm ml-2">收服倍率 {item.mult}</span>
              </p>
              <p className="text-gray-400 text-sm">{item.desc}</p>
              <p className="text-yellow-400 text-sm mt-1">⭐ {item.price} 星星糖/个 | 持有: {balls[item.type] || 0}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onBuy(item.type, 1)}
                className="px-4 py-2 rounded-xl font-bold text-white text-sm transition hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                买1个
              </button>
              <button onClick={() => onBuy(item.type, 5)}
                className="px-4 py-2 rounded-xl font-bold text-white text-sm transition hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
                买5个
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl p-3 text-center" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)' }}>
        <p className="text-purple-300 text-sm" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
          🟣 大师球无法购买，只能通过击败最终BOSS获得（100%收服率）
        </p>
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// QUIZ OVERLAY
// ════════════════════════════════════════════════════════════════════════════

function QuizOverlay({ question, timer, onAnswer, onSkip }: {
  question: { id: number; subject: string; question: string; options: string[]; timeLimit: number; category?: string; difficulty: number; correctIndex: number }
  timer: number
  onAnswer: (correct: boolean, fast: boolean) => void
  onSkip: () => void
}) {
  const QUIZ_FAST_TIME = 30 // 30 seconds = fast answer threshold
  const [elapsed, setElapsed] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correctIdx, setCorrectIdx] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [quizCorrect, setQuizCorrect] = useState(false)
  const [quizFast, setQuizFast] = useState(false)
  const startTimeRef = useRef(Date.now())
  const rafRef = useRef<number | null>(null)

  // AI explanation state
  const [explainPhase, setExplainPhase] = useState<'none' | 'loading' | 'streaming' | 'done'>('none')
  const [explanation, setExplanation] = useState('')
  const explainScrollRef = useRef<HTMLDivElement>(null)

  // Preloaded AI explanation — starts when question loads, before child answers
  const preloadedExplanationRef = useRef<string>('')
  const preloadDoneRef = useRef(false)
  const preloadAbortRef = useRef<AbortController | null>(null)

  // TTS (Text-to-Speech) state
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  // Pre-select the best Chinese voice as soon as voices are loaded
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const pickBestVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const zhVoices = voices.filter(v => v.lang === 'zh-CN' || v.lang.startsWith('zh'))
      if (zhVoices.length === 0) return

      // Debug: log all available Chinese voices so we can see exact names
      console.log('[TTS] Available zh voices:', zhVoices.map(v =>
        `${v.name} (${v.lang})${v.default ? ' [DEFAULT]' : ''}`
      ))

      // Respect the user's system default voice — they chose it for a reason
      const systemDefault = zhVoices.find(v => v.default)

      // Generic/novelty voices we'd rather skip (unless user explicitly set them as default)
      const genericVoices = /Eddy|Flo|Grandma|Grandpa|Sandy|Shelley|Reed|Rocko|Ralph/i

      // If the system default is a real voice (not a generic novelty), use it directly
      if (systemDefault && !genericVoices.test(systemDefault.name)) {
        bestVoiceRef.current = systemDefault
        console.log('[TTS] Using system default voice:', systemDefault.name, systemDefault.lang)
        return
      }

      // Otherwise, fall back to our own ranking:
      // 1st: Known high-quality Apple Chinese voices (enhanced variant)
      // 2nd: Known high-quality Apple Chinese voices (standard)
      // 3rd: Any premium/enhanced/neural voice (excluding generic)
      // 4th: Any non-generic voice
      // 5th: Whatever is available
      const preferredNames = [
        'Tingting', 'Lili', 'Shanshan', 'Meijia', 'Sinji',
        'Yu-shu', 'Li-mu',
      ]
      const preferredChinese = ['婷婷', '莉莉', '珊珊', '美佳', '月']

      const isPreferred = (v: SpeechSynthesisVoice) =>
        preferredNames.some(name => v.name.includes(name)) ||
        preferredChinese.some(name => v.name.includes(name))

      const appleEnhanced = zhVoices.find(v =>
        isPreferred(v) && /premium|enhanced/i.test(v.name)
      )
      const appleStandard = zhVoices.find(v => isPreferred(v))
      const otherPremium = zhVoices.find(v =>
        /premium|enhanced|natural|neural/i.test(v.name) &&
        !genericVoices.test(v.name)
      )
      const nonGeneric = zhVoices.find(v => !genericVoices.test(v.name))

      bestVoiceRef.current = appleEnhanced || appleStandard || otherPremium || nonGeneric || zhVoices[0]

      if (bestVoiceRef.current) {
        console.log('[TTS] Selected voice:', bestVoiceRef.current.name, bestVoiceRef.current.lang)
      }
    }

    // Try immediately (works on Firefox/some browsers)
    pickBestVoice()
    // Also listen for async voice loading (Chrome, Safari)
    window.speechSynthesis.addEventListener('voiceschanged', pickBestVoice)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', pickBestVoice)
    }
  }, [])

  // === Preload AI explanation as soon as question loads ===
  const preloadExplanation = async () => {
    // Abort previous preload if any
    if (preloadAbortRef.current) {
      preloadAbortRef.current.abort()
    }
    const abortController = new AbortController()
    preloadAbortRef.current = abortController
    preloadedExplanationRef.current = ''
    preloadDoneRef.current = false

    try {
      const res = await fetch('/api/quiz/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          options: question.options,
          correctIndex: question.correctIndex,
          // No userAnswerIndex — triggers preload mode on backend
          subject: question.subject,
          category: question.category,
        }),
        signal: abortController.signal,
      })

      if (!res.ok || !res.body) {
        preloadDoneRef.current = true
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (abortController.signal.aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              preloadedExplanationRef.current += parsed.text
            }
          } catch {
            // skip
          }
        }
      }
      preloadDoneRef.current = true
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        preloadDoneRef.current = true
      }
    }
  }

  useEffect(() => {
    startTimeRef.current = Date.now()
    setElapsed(0)
    setSelected(null)
    setCorrectIdx(null)
    setAnswered(false)
    setExplainPhase('none')
    setExplanation('')
    setQuizCorrect(false)
    setQuizFast(false)
    setIsSpeaking(false)
    preloadedExplanationRef.current = ''
    preloadDoneRef.current = false

    // Stop any ongoing speech when question changes
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    // 🚀 Start preloading AI explanation immediately when question loads!
    // The AI begins thinking while the child reads the question.
    if (question.correctIndex !== undefined) {
      preloadExplanation()
    }

    const tick = () => {
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000
      setElapsed(elapsedSec)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // Abort preload on unmount
      if (preloadAbortRef.current) preloadAbortRef.current.abort()
      // Cleanup speech on unmount
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [question.id, timer])

  // Auto-scroll explanation area
  useEffect(() => {
    if (explainScrollRef.current) {
      explainScrollRef.current.scrollTop = explainScrollRef.current.scrollHeight
    }
  }, [explanation])

  // Auto-start TTS when explanation is fully loaded
  useEffect(() => {
    if (explainPhase === 'done' && explanation && !isSpeaking) {
      startSpeech(explanation)
    }
  }, [explainPhase])

  // TTS: speak the explanation text
  const startSpeech = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()

    // Strip emojis and special symbols before reading aloud
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')  // Misc symbols & pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // Transport & map symbols
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // Flags
      .replace(/[\u{2600}-\u{26FF}]/gu, '')     // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')     // Dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')     // Variation selectors
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')   // Supplemental symbols
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')   // Chess symbols
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')   // Symbols extended-A
      .replace(/[\u{200D}]/gu, '')               // Zero-width joiner
      .replace(/[\u{20E3}]/gu, '')               // Combining enclosing keycap
      .replace(/[★☆✅❌⚔️⏭️⏱️⚡]/g, '')          // Common game symbols
      .replace(/\s{2,}/g, ' ')                   // Collapse multiple spaces
      .trim()

    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'zh-CN'

    // Use the pre-selected best Chinese voice (picked once via voiceschanged)
    if (bestVoiceRef.current) {
      utterance.voice = bestVoiceRef.current
    }

    // Tune for natural, warm, teacher-like delivery
    utterance.rate = 0.92   // Slightly slower than normal — clear for kids
    utterance.pitch = 1.05  // Just a touch higher — warm but not cartoonish
    utterance.volume = 1.0

    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utterance
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeech()
    } else if (explanation) {
      startSpeech(explanation)
    }
  }

  // Show the preloaded explanation — either instantly (if already done) or stream the remainder
  const showPreloadedExplanation = (isCorrect: boolean) => {
    // Add a personalized prefix based on whether the child got it right
    const prefix = isCorrect
      ? '🎉 太棒了，答对了！'
      : '💪 没关系，我们来看看这道题吧！'

    if (preloadDoneRef.current && preloadedExplanationRef.current) {
      // AI already finished! Show everything instantly — zero wait!
      setExplanation(prefix + '\n\n' + preloadedExplanationRef.current)
      setExplainPhase('done')
      return
    }

    // AI is still working — set initial state based on what's available
    if (preloadedExplanationRef.current) {
      setExplanation(prefix + '\n\n' + preloadedExplanationRef.current)
      setExplainPhase('streaming')
    } else {
      setExplainPhase('loading')
    }

    // Poll for new content from the preload stream (avoid stale closure with refs)
    let currentPhase: 'loading' | 'streaming' = preloadedExplanationRef.current ? 'streaming' : 'loading'
    const pollInterval = setInterval(() => {
      const currentText = preloadedExplanationRef.current
      if (currentText && currentPhase === 'loading') {
        currentPhase = 'streaming'
        setExplainPhase('streaming')
      }
      if (currentText) {
        setExplanation(prefix + '\n\n' + currentText)
      }
      if (preloadDoneRef.current) {
        clearInterval(pollInterval)
        setExplanation(prefix + '\n\n' + (preloadedExplanationRef.current || '讲解暂时不可用，继续战斗吧！'))
        setExplainPhase('done')
      }
    }, 100) // Check every 100ms for smooth updates
  }

  const handleAnswer = async (idx: number) => {
    if (answered) return
    setAnswered(true)
    setSelected(idx)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const elapsedSec = (Date.now() - startTimeRef.current) / 1000
    const fast = elapsedSec <= QUIZ_FAST_TIME

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, answerIndex: idx }),
      })
      const data = await res.json()
      setCorrectIdx(data.correctIndex)
      setQuizCorrect(data.correct)
      setQuizFast(fast)

      // Show preloaded explanation immediately! No waiting for AI at all!
      // The AI has been working in the background since the question loaded.
      showPreloadedExplanation(data.correct)
    } catch {
      setTimeout(() => onSkip(), 500)
    }
  }

  // Continue to battle after explanation
  const handleContinue = () => {
    stopSpeech()
    onAnswer(quizCorrect, quizFast)
  }

  const isFast = elapsed <= QUIZ_FAST_TIME
  const timePct = isFast ? Math.max(0, (1 - elapsed / QUIZ_FAST_TIME) * 100) : 0
  const timeColor = isFast ? (timePct > 50 ? '#22C55E' : '#EAB308') : '#EF4444'

  const subjectEmoji: Record<string, string> = {
    '数学': '🔢', '语文': '📖', '科学': '🔬',
  }

  const diffStars = '★'.repeat(question.difficulty) + '☆'.repeat(Math.max(0, 3 - question.difficulty))

  // === Explanation Phase UI ===
  if (explainPhase !== 'none') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed z-50 flex flex-col"
        style={{
          top: '2.5%', left: '2.5%', width: '95%', height: '95%',
          background: 'linear-gradient(180deg, #1e293b, #0f172a)',
          borderRadius: '1.5rem',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '3rem' }}>🧑‍🏫</span>
            <span className="text-indigo-300 font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '3rem' }}>
              老师讲解
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* TTS toggle button */}
            {(explainPhase === 'streaming' || explainPhase === 'done') && (
              <button onClick={toggleSpeech}
                className="px-4 py-3 rounded-xl font-bold transition"
                style={{
                  fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif",
                  fontSize: '2rem',
                  color: isSpeaking ? '#fbbf24' : '#94a3b8',
                  background: isSpeaking ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                }}>
                {isSpeaking ? '🔊 朗读中' : '🔈 朗读'}
              </button>
            )}
            {(explainPhase === 'streaming' || explainPhase === 'done') && (
              <button onClick={handleContinue}
                className="text-teal-400 hover:text-teal-300 px-4 py-3 rounded-xl font-bold"
                style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '2.2rem' }}>
                {explainPhase === 'done' ? '继续战斗 ⚔️' : '跳过讲解 ⏭️'}
              </button>
            )}
          </div>
        </div>

        {/* Result badge */}
        <div className="px-6 mb-4">
          <div className="rounded-xl p-5 text-center" style={{
            background: quizCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${quizCorrect ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          }}>
            <span style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '3rem', color: quizCorrect ? '#86efac' : '#fca5a5' }}>
              {quizCorrect ? '✨ 回答正确！' : `😅 答错了，正确答案是 ${['A','B','C','D'][correctIdx ?? 0]}`}
            </span>
          </div>
        </div>

        {/* Question recap */}
        <div className="px-6 mb-4">
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-gray-300" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '2.4rem', lineHeight: '1.5' }}>
              📝 {question.question}
            </p>
          </div>
        </div>

        {/* AI Explanation — extra large font for kids */}
        <div className="flex-1 px-6 overflow-hidden flex flex-col">
          <div ref={explainScrollRef}
            className="flex-1 rounded-2xl p-6 overflow-y-auto"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
            {explainPhase === 'loading' ? (
              <div className="flex items-center gap-4 text-indigo-300">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-10 h-10 border-3 border-indigo-400 border-t-transparent rounded-full"
                />
                <span style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '2.6rem' }}>老师正在思考中...</span>
              </div>
            ) : (
              <p className="text-white whitespace-pre-wrap" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '2.8rem', lineHeight: '1.8' }}>
                {explanation}
                {explainPhase === 'streaming' && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="inline-block w-3 h-8 bg-indigo-400 ml-1 align-middle rounded-sm"
                  />
                )}
              </p>
            )}
          </div>
        </div>

        {/* Continue button — big & friendly */}
        <div className="px-6 py-5">
          <button onClick={handleContinue}
            className="w-full p-6 rounded-2xl font-bold text-white text-center transition hover:brightness-110"
            style={{
              background: explainPhase === 'done'
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : 'rgba(255,255,255,0.1)',
              fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif",
              fontSize: '2.8rem',
            }}>
            {explainPhase === 'done' ? '⚔️ 继续战斗！' : '⏭️ 跳过讲解'}
          </button>
        </div>
      </motion.div>
    )
  }

  // === Answering Phase UI ===
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed z-50 flex flex-col"
      style={{
        top: '2.5%', left: '2.5%', width: '95%', height: '95%',
        background: 'linear-gradient(180deg, #1e293b, #0f172a)',
        borderRadius: '1.5rem',
        boxShadow: '0 0 60px rgba(0,0,0,0.8)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '3rem' }}>{subjectEmoji[question.subject] || '📝'}</span>
          <span className="text-indigo-300 font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '2.8rem' }}>
            {question.subject}{question.category ? ` · ${question.category}` : ''}
          </span>
          <span className="text-gray-500" style={{ fontSize: '2rem' }}>{diffStars}</span>
        </div>
        <button onClick={onSkip} className="text-gray-500 hover:text-gray-300 px-4 py-3 rounded-xl"
          style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '2.2rem' }}>
          跳过 ⏭️
        </button>
      </div>

      {/* Timer bar */}
      <div className="px-6">
        <div className="h-4 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-full rounded-full"
            style={{ background: timeColor, width: `${timePct}%`, transition: 'width 0.1s linear, background 0.3s ease' }}
          />
        </div>

        {/* Timer text */}
        <div className="text-center mb-4">
          <span
            className="font-bold"
            style={{ color: timeColor, fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '2.6rem' }}
          >
            {isFast ? `⚡ 快速作答 ${Math.ceil(QUIZ_FAST_TIME - elapsed)}秒 → 伤害1.5倍！` : '⏱️ 正确作答 → 伤害1.2倍'}
          </span>
        </div>
      </div>

      {/* Question — extra large font */}
      <div className="flex-1 flex flex-col px-6 overflow-auto">
        <div className="rounded-2xl p-6 mb-5" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <p className="text-white" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '3.2rem', lineHeight: '1.6' }}>
            {question.question}
          </p>
        </div>

        {/* Options — extra large for kids */}
        <div className="space-y-4 flex-1">
          {question.options.map((opt, idx) => {
            const labels = ['A', 'B', 'C', 'D']
            let bg = 'rgba(255,255,255,0.08)'
            let border = 'rgba(255,255,255,0.15)'
            let textColor = '#e2e8f0'

            if (answered) {
              if (idx === correctIdx) {
                bg = 'rgba(34,197,94,0.3)'
                border = 'rgba(34,197,94,0.7)'
                textColor = '#86efac'
              } else if (idx === selected && idx !== correctIdx) {
                bg = 'rgba(239,68,68,0.3)'
                border = 'rgba(239,68,68,0.7)'
                textColor = '#fca5a5'
              }
            }

            return (
              <motion.button
                key={idx}
                whileTap={!answered ? { scale: 0.97 } : {}}
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                className="w-full p-6 rounded-2xl text-left transition-all flex items-center gap-5 disabled:cursor-default"
                style={{
                  background: bg,
                  border: `2px solid ${border}`,
                  color: textColor,
                  fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif",
                }}
              >
                <span className="w-16 h-16 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: '2.8rem' }}>
                  {labels[idx]}
                </span>
                <span style={{ fontSize: '2.8rem', lineHeight: '1.4' }}>{opt}</span>
                {answered && idx === correctIdx && <span className="ml-auto" style={{ fontSize: '3rem' }}>✅</span>}
                {answered && idx === selected && idx !== correctIdx && <span className="ml-auto" style={{ fontSize: '3rem' }}>❌</span>}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Answer feedback (brief, before explanation loads) */}
      <AnimatePresence>
        {answered && correctIdx !== null && explainPhase === 'none' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-6 py-5 text-center"
          >
            {selected === correctIdx ? (
              <span className="text-green-400 font-bold" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '3.6rem' }}>
                ✨ 回答正确！
              </span>
            ) : (
              <span className="text-gray-400" style={{ fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif", fontSize: '3rem' }}>
                😅 答错了，正确答案是 {['A','B','C','D'][correctIdx]}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function TypeBadge({ type, small }: { type: string; small?: boolean }) {
  return (
    <span className={`inline-block rounded-full font-bold text-white ${small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ background: TYPE_COLORS[type] || '#6B7280', fontFamily: "'PingFang SC', 'Heiti SC', 'SimHei', 'Microsoft YaHei', sans-serif" }}>
      {TYPE_NAMES[type] || type}
    </span>
  )
}

function HPBar({ current, max, isPlayer }: { current: number; max: number; isPlayer?: boolean }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color = pct > 50 ? '#22C55E' : pct > 25 ? '#EAB308' : '#EF4444'

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-0.5">
        <span>HP</span>
        <span>{Math.round(current)}/{Math.round(max)}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

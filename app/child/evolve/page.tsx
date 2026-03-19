'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { POKEMON_NAMES, POKEMON_TYPES } from '@/lib/game-logic'
import { getSoundManager } from '@/lib/sound-manager'

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

interface EvolutionData {
  pokemon: {
    id: number
    speciesId: number
    name: string
    level: number
    evolutionStage: number
  }
  allPokemons?: {
    id: number
    speciesId: number
    name: string
    level: number
    evolutionStage: number
    isActive: boolean
    source: string
  }[]
  canEvolve: boolean
  requirements: {
    level: number
    fragments: number
    currentLevel: number
    currentFragments: number
    levelMet: boolean
    fragmentsMet: boolean
  }
  targets: { speciesId: number; name: string }[]
  chain: {
    stages: { speciesId: number; name: string; stage: number; isCurrent: boolean; isBranch?: boolean }[]
    maxStage: number
  }
  history: {
    fromSpeciesId: number; fromName: string
    toSpeciesId: number; toName: string
    fromStage: number; toStage: number
    evolvedAt: string
  }[]
}

export default function EvolvePage() {
  const [data, setData] = useState<EvolutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [evolving, setEvolving] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null)
  const [showAnimation, setShowAnimation] = useState(false)
  const [currentPokemonId, setCurrentPokemonId] = useState<number | null>(null)
  const [evolutionResult, setEvolutionResult] = useState<{
    from: number; to: number; fromName: string; toName: string
    newSkills?: { name: string; type: string }[]
  } | null>(null)

  const loadData = (pokemonId?: number) => {
    const url = pokemonId ? `/api/pokemon/evolve?pokemonId=${pokemonId}` : '/api/pokemon/evolve'
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleEvolve = async () => {
    if (!data?.canEvolve) return
    setEvolving(true)

    try {
      const res = await fetch('/api/pokemon/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSpeciesId: selectedTarget || data.targets[0]?.speciesId,
          pokemonId: data.pokemon.id,
        }),
      })
      const result = await res.json()
      if (res.ok && result.evolution) {
        setEvolutionResult({
          ...result.evolution,
          newSkills: result.newSkills || [],
        })
        setShowAnimation(true)

        // Evolution sound sequence
        const sm = getSoundManager()
        sm.playEvolveStart()
        setTimeout(() => sm.playEvolveTransform(), 1200)
        setTimeout(() => {
          sm.playCry(result.evolution.to)
          sm.playEvolveFanfare()
        }, 2000)

        // Reload after animation
        setTimeout(() => {
          loadData()
        }, 5000)
      }
    } catch (e) {
      console.error(e)
    }
    setEvolving(false)
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-3xl animate-pulse">加载中...</div>
      </div>
    )
  }

  if (!data?.pokemon) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-2xl mb-6">还没有宝可梦！</p>
        <Link href="/" className="bg-teal-500 text-white px-8 py-4 rounded-full font-bold text-2xl">选择宝可梦</Link>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Evolution Animation Overlay */}
      <AnimatePresence>
        {showAnimation && evolutionResult && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'radial-gradient(ellipse, rgba(255,255,255,0.95) 0%, rgba(147,51,234,0.3) 100%)' }}
          >
            <div className="text-center">
              {/* From Pokemon */}
              <motion.div
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: [1, 1.2, 0], opacity: [1, 1, 0] }}
                transition={{ duration: 1.5, times: [0, 0.4, 1] }}
                className="mb-4"
              >
                <img
                  src={HOME_SPRITE(evolutionResult.from)}
                  alt={evolutionResult.fromName}
                  width={200} height={200}
                  style={{ width: 200, height: 200, objectFit: 'contain', margin: '0 auto',
                    filter: 'drop-shadow(0 0 30px rgba(147,51,234,0.6))' }}
                />
                <p className="font-bold text-2xl text-gray-800 mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  {evolutionResult.fromName}
                </p>
              </motion.div>

              {/* Light burst */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 3, 1], opacity: [0, 1, 0] }}
                transition={{ delay: 1.2, duration: 1.5 }}
                className="absolute inset-0 flex items-center justify-center"
                style={{ pointerEvents: 'none' }}
              >
                <div className="w-40 h-40 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.8) 0%, rgba(147,51,234,0.4) 50%, transparent 70%)' }} />
              </motion.div>

              {/* To Pokemon */}
              <motion.div
                initial={{ scale: 0, opacity: 0, y: 50 }}
                animate={{ scale: [0, 1.3, 1], opacity: [0, 0, 1], y: [50, 0, 0] }}
                transition={{ delay: 2, duration: 1.5 }}
              >
                <img
                  src={HOME_SPRITE(evolutionResult.to)}
                  alt={evolutionResult.toName}
                  width={260} height={260}
                  style={{ width: 260, height: 260, objectFit: 'contain', margin: '0 auto',
                    filter: 'drop-shadow(0 0 40px rgba(251,191,36,0.7)) drop-shadow(0 12px 20px rgba(0,0,0,0.3))' }}
                />
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3 }}
                  className="font-bold text-4xl mt-4"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", color: '#7c3aed' }}
                >
                  {evolutionResult.toName}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3.2 }}
                  className="text-xl text-gray-500 mt-2"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                >
                  ✨ 进化成功！
                </motion.p>
              </motion.div>

              {/* New Skills Display */}
              {evolutionResult.newSkills && evolutionResult.newSkills.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 3.4 }}
                  className="mt-4 px-6 py-4 rounded-2xl"
                  style={{ background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(147,51,234,0.3)' }}
                >
                  <p className="font-bold text-purple-300 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                    🎯 习得新技能！
                  </p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {evolutionResult.newSkills.map(skill => {
                      const typeColors: Record<string, string> = {
                        fire: '#EF4444', water: '#3B82F6', grass: '#22C55E', electric: '#EAB308',
                        ground: '#A16207', ice: '#06B6D4', flying: '#8B5CF6', bug: '#84CC16',
                        normal: '#6B7280', fairy: '#EC4899',
                      }
                      const color = typeColors[skill.type] || '#6B7280'
                      return (
                        <motion.span
                          key={skill.name}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 3.6, type: 'spring', stiffness: 300 }}
                          className="px-4 py-1.5 rounded-full font-bold text-white text-sm"
                          style={{
                            background: `${color}cc`,
                            border: `1px solid ${color}`,
                            fontFamily: "'ZCOOL KuaiLe', sans-serif",
                            boxShadow: `0 2px 8px ${color}44`,
                          }}
                        >
                          {skill.name}
                        </motion.span>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 4.0 }}
                onClick={() => setShowAnimation(false)}
                className="mt-8 bg-purple-500 hover:bg-purple-600 text-white font-bold px-8 py-4 rounded-2xl text-xl transition-all relative z-10"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", boxShadow: '0 4px 0 #6b21a8' }}
              >
                太棒了！
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="border-b-4 border-purple-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)' }}>
        <h1 className="game-title-green leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#6b21a8' }}>
          进化工坊 ✨
        </h1>
        <p className="text-purple-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
          让宝可梦变得更强大！
        </p>
      </div>

      <div className="px-4 md:px-8 py-8 space-y-8">
        {/* Pokemon Selector */}
        {data.allPokemons && data.allPokemons.length > 1 && (
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-5" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
              选择宝可梦
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {data.allPokemons.map(p => (
                <motion.button
                  key={p.id}
                  onClick={() => {
                    setCurrentPokemonId(p.id)
                    setSelectedTarget(null)
                    loadData(p.id)
                  }}
                  className={`flex flex-col items-center p-3 rounded-2xl border-2 flex-shrink-0 transition-all ${
                    data.pokemon.id === p.id
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 bg-gray-50 hover:border-purple-300'
                  }`}
                  style={{ minWidth: 90 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <img
                    src={HOME_SPRITE(p.speciesId)}
                    alt={p.name}
                    width={56} height={56}
                    style={{
                      width: 56, height: 56, objectFit: 'contain',
                      filter: data.pokemon.id === p.id
                        ? 'drop-shadow(0 3px 6px rgba(147,51,234,0.3))'
                        : 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                    }}
                  />
                  <span className="font-bold text-xs mt-1 truncate max-w-[80px]" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {p.name}
                  </span>
                  <span className="text-xs text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    Lv.{p.level}
                  </span>
                  {p.isActive && (
                    <span className="text-xs text-amber-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>★</span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        )}
        {/* Current Pokemon + Evolution Chain */}
        <div className="bg-white rounded-3xl border-2 border-gray-200 p-8" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
          <h2 className="font-bold text-gray-800 mb-6" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
            进化路线
          </h2>

          {/* Evolution Chain Visual */}
          <div className="flex items-center justify-center gap-4 flex-wrap overflow-x-auto">
            {data.chain.stages.filter(s => !s.isBranch).map((stage, i, arr) => (
              <div key={stage.speciesId} className="flex items-center gap-4">
                <motion.div
                  className={`flex flex-col items-center p-5 rounded-3xl border-3 transition-all ${
                    stage.isCurrent
                      ? 'border-purple-400 bg-purple-50'
                      : stage.stage <= (data.pokemon.evolutionStage)
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                  }`}
                  style={{
                    boxShadow: stage.isCurrent ? '0 4px 0 #9333ea, 0 8px 20px rgba(147,51,234,0.15)' : '0 3px 0 rgba(0,0,0,0.06)',
                    minWidth: 100,
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  <img
                    src={HOME_SPRITE(stage.speciesId)}
                    alt={stage.name}
                    width={100} height={100}
                    style={{
                      width: 100, height: 100, objectFit: 'contain',
                      filter: stage.stage <= (data.pokemon.evolutionStage)
                        ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
                        : 'grayscale(0.6) brightness(0.7)',
                    }}
                  />
                  <p className={`font-bold mt-2 ${stage.isCurrent ? 'text-purple-700' : stage.stage <= (data.pokemon.evolutionStage) ? 'text-green-700' : 'text-gray-400'}`}
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
                    {stage.name}
                  </p>
                  <p className="text-gray-400 text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {POKEMON_TYPES[stage.speciesId] || '???'}
                  </p>
                  {stage.isCurrent && (
                    <span className="mt-2 px-3 py-1 bg-purple-500 text-white rounded-full text-sm font-bold"
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      当前形态
                    </span>
                  )}
                  {stage.stage <= (data.pokemon.evolutionStage) && !stage.isCurrent && (
                    <span className="mt-2 text-green-500 text-sm font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      ✓ 已经历
                    </span>
                  )}
                </motion.div>

                {i < arr.length - 1 && (
                  <div className="flex flex-col items-center">
                    <span className="text-3xl text-gray-300">→</span>
                    <span className="text-gray-400 text-xs mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      Lv.{i === 0 ? 10 : 20}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Branch options for Eevee */}
          {data.chain.stages.some(s => s.isBranch) && (
            <div className="mt-6 pt-6 border-t-2 border-gray-100">
              <p className="text-gray-500 font-bold mb-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                🔀 分支进化选择
              </p>
              <div className="flex gap-4 justify-center">
                {data.chain.stages.filter(s => s.isBranch).map(stage => (
                  <div
                    key={stage.speciesId}
                    className={`flex flex-col items-center p-4 rounded-2xl border-2 ${
                      stage.isCurrent ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50'
                    }`}
                    style={{ minWidth: 120 }}
                  >
                    <img
                      src={HOME_SPRITE(stage.speciesId)}
                      alt={stage.name}
                      width={80} height={80}
                      style={{
                        width: 80, height: 80, objectFit: 'contain',
                        filter: stage.isCurrent ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 'grayscale(0.4) brightness(0.8)',
                      }}
                    />
                    <p className="font-bold mt-2 text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>
                      {stage.name}
                    </p>
                    <p className="text-gray-400 text-xs" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      {POKEMON_TYPES[stage.speciesId]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Evolution Requirements + Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Requirements */}
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-7" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold text-gray-800 mb-5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
              进化条件
            </h2>

            {data.chain.maxStage <= data.pokemon.evolutionStage ? (
              <div className="text-center py-8">
                <div className="text-7xl mb-4">👑</div>
                <p className="text-2xl font-bold text-purple-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  已到达最终形态！
                </p>
                <p className="text-gray-400 mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                  你的宝可梦已经完全进化了
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Level requirement */}
                <div className={`rounded-2xl p-5 border-2 ${
                  data.requirements.levelMet ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                      ⬆️ 等级要求
                    </span>
                    <span className={`font-bold ${data.requirements.levelMet ? 'text-green-600' : 'text-gray-500'}`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
                      {data.requirements.levelMet ? '✅ 已达成' : `Lv.${data.requirements.currentLevel} / Lv.${data.requirements.level}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <motion.div
                      className={`h-4 rounded-full ${data.requirements.levelMet ? 'bg-green-400' : 'bg-blue-400'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (data.requirements.currentLevel / data.requirements.level) * 100)}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>

                {/* Fragment requirement */}
                <div className={`rounded-2xl p-5 border-2 ${
                  data.requirements.fragmentsMet ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                      🪨 进化石碎片
                    </span>
                    <span className={`font-bold ${data.requirements.fragmentsMet ? 'text-green-600' : 'text-gray-500'}`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
                      {data.requirements.fragmentsMet ? '✅ 已达成' : `${data.requirements.currentFragments} / ${data.requirements.fragments}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <motion.div
                      className={`h-4 rounded-full ${data.requirements.fragmentsMet ? 'bg-green-400' : 'bg-amber-400'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (data.requirements.currentFragments / data.requirements.fragments) * 100)}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <p className="text-gray-400 text-sm mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    💡 完成任务获得满分可以获得进化石碎片
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Evolve Action */}
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-7" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold text-gray-800 mb-5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
              进化操作
            </h2>

            {data.canEvolve ? (
              <div className="text-center">
                <div className="mb-4">
                  <motion.img
                    src={HOME_SPRITE(data.pokemon.speciesId)}
                    alt={data.pokemon.name}
                    width={160} height={160}
                    style={{
                      width: 160, height: 160, objectFit: 'contain', margin: '0 auto',
                      filter: 'drop-shadow(0 0 20px rgba(147,51,234,0.5)) drop-shadow(0 8px 12px rgba(0,0,0,0.3))',
                    }}
                    animate={{ y: [0, -12, 0], scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  />
                </div>

                {/* Target selection for branch evolution */}
                {data.targets.length > 1 && (
                  <div className="mb-6">
                    <p className="text-gray-500 font-bold mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                      选择进化目标：
                    </p>
                    <div className="flex gap-3 justify-center">
                      {data.targets.map(t => (
                        <button
                          key={t.speciesId}
                          onClick={() => setSelectedTarget(t.speciesId)}
                          className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all ${
                            (selectedTarget || data.targets[0].speciesId) === t.speciesId
                              ? 'border-purple-400 bg-purple-50'
                              : 'border-gray-200 bg-gray-50 hover:border-purple-300'
                          }`}
                        >
                          <img
                            src={HOME_SPRITE(t.speciesId)}
                            alt={t.name}
                            width={60} height={60}
                            style={{ width: 60, height: 60, objectFit: 'contain',
                              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}
                          />
                          <span className="font-bold text-sm mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            {t.name}
                          </span>
                          <span className="text-gray-400 text-xs" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            {POKEMON_TYPES[t.speciesId]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <motion.button
                  onClick={handleEvolve}
                  disabled={evolving}
                  className="w-full text-white font-bold py-6 rounded-2xl transition-all disabled:opacity-50"
                  style={{
                    fontFamily: "'ZCOOL KuaiLe', sans-serif",
                    fontSize: '1.75rem',
                    background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
                    boxShadow: '0 6px 0 #6b21a8, 0 10px 25px rgba(147,51,234,0.3)',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97, y: 3 }}
                >
                  {evolving ? '进化中...' : '✨ 开始进化！'}
                </motion.button>

                <p className="text-gray-400 mt-3 text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  将消耗 {data.requirements.fragments} 个进化石碎片
                </p>
              </div>
            ) : data.chain.maxStage <= data.pokemon.evolutionStage ? (
              <div className="text-center py-6">
                <motion.img
                  src={HOME_SPRITE(data.pokemon.speciesId)}
                  alt={data.pokemon.name}
                  width={160} height={160}
                  style={{
                    width: 160, height: 160, objectFit: 'contain', margin: '0 auto',
                    filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.5)) drop-shadow(0 8px 12px rgba(0,0,0,0.3))',
                  }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                />
                <p className="text-2xl font-bold text-purple-600 mt-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  最终形态 👑
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <img
                  src={HOME_SPRITE(data.pokemon.speciesId)}
                  alt={data.pokemon.name}
                  width={140} height={140}
                  style={{
                    width: 140, height: 140, objectFit: 'contain', margin: '0 auto',
                    filter: 'grayscale(0.2) drop-shadow(0 6px 10px rgba(0,0,0,0.2))',
                  }}
                />
                <p className="text-xl font-bold text-gray-500 mt-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  条件不足，继续努力！
                </p>
                <p className="text-gray-400 mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                  完成更多任务来达成进化条件
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Evolution History */}
        {data.history.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-7" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold text-gray-800 mb-5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
              进化记录 📖
            </h2>
            <div className="space-y-4">
              {data.history.map((h, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-purple-50 border border-purple-100"
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <img
                    src={HOME_SPRITE(h.fromSpeciesId)}
                    alt={h.fromName}
                    width={50} height={50}
                    style={{ width: 50, height: 50, objectFit: 'contain' }}
                  />
                  <span className="text-2xl text-purple-400">→</span>
                  <img
                    src={HOME_SPRITE(h.toSpeciesId)}
                    alt={h.toName}
                    width={50} height={50}
                    style={{ width: 50, height: 50, objectFit: 'contain' }}
                  />
                  <div className="flex-1">
                    <p className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}>
                      {h.fromName} → {h.toName}
                    </p>
                    <p className="text-gray-400 text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      阶段 {h.fromStage} → {h.toStage}
                    </p>
                  </div>
                  <span className="text-gray-400 text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {h.evolvedAt?.slice(0, 10)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-yellow-50 rounded-2xl border-2 border-yellow-200 p-6">
          <p className="text-yellow-700 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
            💡 进化小贴士
          </p>
          <ul className="space-y-1 text-yellow-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
            <li>• 第一次进化需要 Lv.10 + 3个进化石碎片</li>
            <li>• 第二次进化需要 Lv.20 + 5个进化石碎片</li>
            <li>• 完成任务获得满分(5星)可以获得进化石碎片</li>
            <li>• 连续打卡30天也能获得额外碎片奖励</li>
            <li>• 伊布有多种进化形态可以选择！</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

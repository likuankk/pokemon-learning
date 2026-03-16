'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSession } from '@/components/SessionProvider'

const STARTER_POKEMON = [
  { id: 1, name: '妙蛙种子', type: '草/毒' },
  { id: 4, name: '小火龙', type: '火' },
  { id: 7, name: '杰尼龟', type: '水' },
  { id: 25, name: '皮卡丘', type: '电' },
  { id: 133, name: '伊布', type: '一般' },
  { id: 39, name: '胖丁', type: '一般/妖精' },
]

const DISPLAY_POKEMON = [25, 1, 7, 4, 39, 133]
const HOME_SPRITE = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

export default function HomePage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useSession()
  const [showPokemonSelect, setShowPokemonSelect] = useState(false)
  const [selectedPokemon, setSelectedPokemon] = useState<typeof STARTER_POKEMON[0] | null>(null)
  const [loading, setLoading] = useState(false)

  // Already logged in → redirect to role page
  useEffect(() => {
    if (!sessionLoading && user) {
      router.replace(user.role === 'parent' ? '/parent' : '/child')
    }
  }, [user, sessionLoading, router])

  const handlePokemonSelect = async (pokemon: typeof STARTER_POKEMON[0]) => {
    setSelectedPokemon(pokemon)
    setLoading(true)
    try {
      await fetch('/api/pokemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speciesId: pokemon.id, name: pokemon.name }),
      })
      router.push('/child')
    } catch {
      setLoading(false)
    }
  }

  if (showPokemonSelect) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-400">
        {/* Left: preview */}
        <div className="w-1/2 flex flex-col items-center justify-center p-10">
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center">
            <div className="text-9xl mb-6">🌟</div>
            <h1
              className="game-title mb-4 leading-tight"
              style={{ fontSize: '3.5rem' }}
            >
              选择你的伙伴！
            </h1>
            <p className="text-white/80 text-3xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              它将和你一起踏上学习之旅
            </p>
            <p className="text-white/60 text-2xl mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              完成任务可以让它变得更强哦 ✨
            </p>
          </motion.div>

          {selectedPokemon && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-8 flex flex-col items-center">
              <div className="pokemon-3d-container">
                <motion.img
                  src={HOME_SPRITE(selectedPokemon.id)}
                  alt={selectedPokemon.name}
                  width={260}
                  height={260}
                  style={{
                    width: 260,
                    height: 260,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.7)) drop-shadow(0 16px 24px rgba(0,0,0,0.4))',
                  }}
                  animate={{ y: [0, -18, 0] }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
                />
              </div>
              <p className="game-title mt-4" style={{ fontSize: '2.5rem' }}>{selectedPokemon.name}</p>
            </motion.div>
          )}
        </div>

        {/* Right: grid */}
        <div className="w-1/2 bg-white flex flex-col justify-center px-10">
          <h2
            className="game-title-indigo mb-8"
            style={{ fontSize: '2.5rem', color: '#4f46e5' }}
          >
            选择一只宝可梦
          </h2>
          <div className="grid grid-cols-3 gap-5 mb-8">
            {STARTER_POKEMON.map((p) => (
              <motion.button
                key={p.id}
                onClick={() => handlePokemonSelect(p)}
                disabled={loading}
                className="flex flex-col items-center p-5 rounded-3xl border-3 transition-all game-card"
                style={{
                  border: selectedPokemon?.id === p.id ? '3px solid #f59e0b' : '2px solid #e5e7eb',
                  background: selectedPokemon?.id === p.id ? '#fefce8' : '#fff',
                  boxShadow: selectedPokemon?.id === p.id
                    ? '0 6px 0 #d97706, 0 10px 20px rgba(0,0,0,0.12)'
                    : '0 4px 0 rgba(0,0,0,0.1), 0 6px 16px rgba(0,0,0,0.08)',
                }}
                whileHover={{ scale: 1.06, y: -4 }}
                whileTap={{ scale: 0.94, y: 2 }}
              >
                <img
                  src={HOME_SPRITE(p.id)}
                  alt={p.name}
                  width={130}
                  height={130}
                  style={{
                    width: 130,
                    height: 130,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.25))',
                  }}
                />
                <span className="game-label text-xl mt-2 font-bold">{p.name}</span>
                <span className="text-base text-gray-400 mt-1 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{p.type}</span>
              </motion.button>
            ))}
          </div>
          <button
            onClick={() => setShowPokemonSelect(false)}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold text-left"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
          >
            ← 返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: hero */}
      <div className="w-3/5 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl" />

        <motion.div
          className="text-center z-10"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7 }}
        >
          <h1
            className="game-title mb-4 drop-shadow-lg leading-tight"
            style={{ fontSize: '5rem' }}
          >
            宝可梦学习乐园
          </h1>
          <p
            className="text-white/80 mb-14"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '2.25rem' }}
          >
            学习让伙伴更强大！
          </p>

          {/* 3D Pokemon display — top row */}
          <div className="flex justify-center gap-6 mb-4">
            {DISPLAY_POKEMON.slice(0, 3).map((id, i) => (
              <motion.div key={id} className="pokemon-3d-container">
                <motion.img
                  src={HOME_SPRITE(id)}
                  alt=""
                  width={150}
                  height={150}
                  style={{
                    width: 150,
                    height: 150,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.35))',
                  }}
                  animate={{ y: [0, -20, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.4, ease: 'easeInOut' }}
                />
              </motion.div>
            ))}
          </div>
          {/* bottom row */}
          <div className="flex justify-center gap-6">
            {DISPLAY_POKEMON.slice(3, 6).map((id, i) => (
              <motion.div key={id} className="pokemon-3d-container">
                <motion.img
                  src={HOME_SPRITE(id)}
                  alt=""
                  width={120}
                  height={120}
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.3))',
                  }}
                  animate={{ y: [0, -16, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 + 0.2, ease: 'easeInOut' }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.p
          className="absolute bottom-8 text-white/40 text-xl"
          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          宝可梦学习乐园 · Demo 版本
        </motion.p>
      </div>

      {/* Right: entry */}
      <div className="w-2/5 bg-white flex flex-col items-center justify-center px-16">
        <motion.div
          className="w-full"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <h2
            className="game-label mb-3 leading-tight"
            style={{ fontSize: '3.5rem' }}
          >
            欢迎回来！
          </h2>
          <p
            className="text-gray-400 mb-12"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}
          >
            请选择你的身份进入
          </p>

          <div className="space-y-6">
            <motion.button
              onClick={() => router.push('/parent')}
              className="w-full bg-indigo-50 hover:bg-indigo-100 rounded-3xl p-8 flex items-center gap-6 transition-all group game-card"
              style={{
                border: '3px solid #c7d2fe',
                boxShadow: '0 6px 0 #a5b4fc, 0 10px 20px rgba(99,102,241,0.15)',
              }}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98, y: 3 }}
            >
              <span className="text-7xl">👩‍👦</span>
              <div className="text-left flex-1">
                <div
                  className="game-label font-bold group-hover:text-indigo-700"
                  style={{ fontSize: '2.25rem' }}
                >
                  我是家长
                </div>
                <div
                  className="text-gray-500 mt-1"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}
                >
                  出题 · 审核 · 守护成长
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-indigo-500 text-5xl">›</span>
            </motion.button>

            <motion.button
              onClick={() => setShowPokemonSelect(true)}
              className="w-full bg-yellow-50 hover:bg-yellow-100 rounded-3xl p-8 flex items-center gap-6 transition-all group game-card"
              style={{
                border: '3px solid #fde68a',
                boxShadow: '0 6px 0 #fcd34d, 0 10px 20px rgba(245,158,11,0.2)',
              }}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98, y: 3 }}
            >
              <span className="text-7xl">🧒</span>
              <div className="text-left flex-1">
                <div
                  className="game-label font-bold group-hover:text-yellow-700"
                  style={{ fontSize: '2.25rem' }}
                >
                  我是小朋友
                </div>
                <div
                  className="text-gray-500 mt-1"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}
                >
                  学习 · 成长 · 和宝可梦冒险
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-yellow-600 text-5xl">›</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

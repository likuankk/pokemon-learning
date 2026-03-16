'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import PokemonDisplay from '@/components/PokemonDisplay'
import StatsBar from '@/components/StatsBar'
import { getPokemonStatus, statusLabels, itemEmojis, itemLabels } from '@/lib/game-logic'
import Link from 'next/link'

interface PokemonData {
  id: number
  child_id: number
  species_id: number
  name: string
  vitality: number
  wisdom: number
  affection: number
  level: number
  status: string
}

interface InventoryItem {
  item_type: string
  quantity: number
}

export default function ChildPage() {
  const [pokemon, setPokemon] = useState<PokemonData | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [todayProgress, setTodayProgress] = useState({ completed: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    fetch('/api/pokemon?childId=2')
      .then(r => r.json())
      .then(data => {
        setPokemon(data.pokemon)
        setInventory(data.inventory || [])
        setTodayProgress(data.todayProgress || { completed: 0, total: 0 })
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-3xl animate-pulse">加载中...</div>
      </div>
    )
  }

  if (!pokemon) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-2xl mb-6">还没有宝可梦！</p>
        <Link href="/" className="bg-teal-500 text-white px-8 py-4 rounded-full font-bold text-2xl">选择宝可梦</Link>
      </div>
    )
  }

  const status = getPokemonStatus(pokemon.vitality, pokemon.wisdom, pokemon.affection)

  const bgColors: Record<string, string> = {
    energetic: 'from-yellow-50 to-amber-50',
    good: 'from-teal-50 to-cyan-50',
    tired: 'from-gray-50 to-slate-100',
    sad: 'from-gray-100 to-slate-100',
  }

  const getInventoryQty = (itemType: string) => {
    const item = inventory.find(i => i.item_type === itemType)
    return item ? Math.floor(item.quantity) : 0
  }

  const progressPct = todayProgress.total > 0
    ? Math.round((todayProgress.completed / todayProgress.total) * 100)
    : 0

  return (
    <div className={`min-h-full bg-gradient-to-br ${bgColors[status] || bgColors.good}`}>
      {/* Header */}
      <div className="border-b-4 border-white/50 px-8 py-6 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)' }}>
        <div>
          <h1 className="game-title-green leading-tight" style={{ fontSize: '3.5rem', color: '#065f46' }}>小明的宝可梦小屋 🏠</h1>
          <p className="text-emerald-600 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>今天也要加油哦！</p>
        </div>
        <button onClick={loadData} className="text-gray-400 hover:text-gray-600 text-xl transition-colors font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
          刷新 ↻
        </button>
      </div>

      <div className="px-8 py-8">
        <div className="flex gap-8">
          {/* Left: Pokemon + Stats */}
          <div className="w-[400px] flex-shrink-0 space-y-6">
            {/* Pokemon display */}
            <div className="bg-white/70 backdrop-blur rounded-3xl p-8 flex flex-col items-center shadow-sm">
              <PokemonDisplay
                speciesId={pokemon.species_id}
                name={pokemon.name}
                vitality={pokemon.vitality}
                wisdom={pokemon.wisdom}
                affection={pokemon.affection}
                level={pokemon.level}
                size="xlarge"
              />
              <div className="mt-5 bg-white rounded-full px-6 py-3 shadow-sm border-2 border-gray-100"
                style={{ boxShadow: '0 3px 0 rgba(0,0,0,0.1)' }}>
                <span className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', color: '#374151' }}>
                  {statusLabels[status as keyof typeof statusLabels]}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm space-y-5">
              <h3 className="game-label uppercase tracking-widest" style={{ fontSize: '1.5rem', color: '#374151' }}>宝可梦状态</h3>
              <StatsBar label="体力" value={pokemon.vitality} color="bg-red-400" emoji="❤️" />
              <StatsBar label="智慧" value={pokemon.wisdom} color="bg-blue-400" emoji="💡" />
              <StatsBar label="亲密度" value={pokemon.affection} color="bg-pink-400" emoji="💕" />
            </div>
          </div>

          {/* Right: Progress + Inventory + Nav */}
          <div className="flex-1 space-y-6">
            {/* Today's progress */}
            <div className="bg-white/70 backdrop-blur rounded-2xl p-7 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="game-label font-bold" style={{ fontSize: '1.75rem' }}>今日学习进度</h3>
                <span className="text-5xl font-bold text-teal-600">{progressPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden mb-4">
                <motion.div
                  className="h-8 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xl text-gray-500 font-semibold">
                已完成 {todayProgress.completed} / 共 {todayProgress.total} 个任务
              </p>
            </div>

            {/* Inventory */}
            <div className="bg-white/70 backdrop-blur rounded-2xl p-7 shadow-sm">
              <h3 className="game-label font-bold mb-5" style={{ fontSize: '1.75rem' }}>道具背包</h3>
              <div className="grid grid-cols-4 gap-5">
                {['food', 'crystal', 'candy', 'fragment'].map(itemType => (
                  <div key={itemType} className="bg-white rounded-2xl p-5 text-center shadow-sm border-2 border-gray-100">
                    <div className="text-5xl mb-3">{itemEmojis[itemType]}</div>
                    <div className="text-lg text-gray-500 font-semibold mb-1">{itemLabels[itemType]}</div>
                    <div className="text-4xl font-bold text-gray-800">{getInventoryQty(itemType)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation cards */}
            <div className="grid grid-cols-3 gap-5">
              <Link href="/child/tasks">
                <motion.div
                  className="bg-white/70 backdrop-blur rounded-2xl p-7 cursor-pointer hover:bg-white/90 transition-all shadow-sm h-52 flex flex-col justify-between"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-6xl">📋</div>
                  <div>
                    <div className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>今日任务</div>
                    <div className="text-gray-400 mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>查看和完成学习任务</div>
                  </div>
                </motion.div>
              </Link>
              <Link href="/child/planner">
                <motion.div
                  className="bg-white/70 backdrop-blur rounded-2xl p-7 cursor-pointer hover:bg-white/90 transition-all shadow-sm h-52 flex flex-col justify-between"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-6xl">🗓️</div>
                  <div>
                    <div className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>时间规划</div>
                    <div className="text-gray-400 mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>安排今天的学习时间</div>
                  </div>
                </motion.div>
              </Link>
              <Link href="/child/feed">
                <motion.div
                  className="bg-white/70 backdrop-blur rounded-2xl p-7 cursor-pointer hover:bg-white/90 transition-all shadow-sm h-52 flex flex-col justify-between"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-6xl">🍖</div>
                  <div>
                    <div className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>喂养伙伴</div>
                    <div className="text-gray-400 mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>用道具让它更强！</div>
                  </div>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

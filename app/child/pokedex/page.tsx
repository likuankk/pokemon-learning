'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { POKEMON_NAMES } from '@/lib/game-logic'

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

interface Achievement {
  id: string; title: string; description: string; category: string
  icon: string; tier: number; condition_type: string; condition_value: number
  unlocked: boolean; unlocked_at: string | null
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  habit: { label: '学习习惯', icon: '📚' },
  subject: { label: '学科均衡', icon: '⚖️' },
  pokemon: { label: '宝可梦养成', icon: '✨' },
  time: { label: '时间管理', icon: '🗓️' },
  family: { label: '亲子互动', icon: '💌' },
  battle: { label: '战斗系统', icon: '⚔️' },
}

const TIER_COLORS = [
  '', // tier 0
  'border-gray-300 bg-gray-50',      // tier 1 - bronze
  'border-blue-300 bg-blue-50',       // tier 2 - silver
  'border-yellow-300 bg-yellow-50',   // tier 3 - gold
  'border-purple-300 bg-purple-50',   // tier 4 - diamond
]

const TIER_LABELS = ['', '铜', '银', '金', '钻石']

// Build pokedex from POKEMON_NAMES, sorted by ID
const POKEDEX_POKEMON = Object.entries(POKEMON_NAMES)
  .map(([id, name]) => ({ id: Number(id), name }))
  .sort((a, b) => a.id - b.id)

export default function PokedexPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [totalUnlocked, setTotalUnlocked] = useState(0)
  const [totalAchievements, setTotalAchievements] = useState(0)
  const [tab, setTab] = useState<'pokedex' | 'achievements'>('pokedex')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [myPokemon, setMyPokemon] = useState<any>(null)
  const [discoveredIds, setDiscoveredIds] = useState<number[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/achievements').then(r => r.json()),
      fetch('/api/pokemon').then(r => r.json()),
      fetch('/api/pokemon/evolve').then(r => r.json()).catch(() => ({})),
      fetch('/api/battle/species').then(r => r.json()).catch(() => ({ species: [] })),
    ]).then(([achData, pokeData, evolveData, speciesData]) => {
      setAchievements(achData.achievements || [])
      setTotalUnlocked(achData.totalUnlocked || 0)
      setTotalAchievements(achData.totalAchievements || 0)
      setMyPokemon(pokeData.pokemon)
      // Collect all discovered species from multiple sources
      const discovered = new Set<number>()
      // 1. Current pokemon
      if (pokeData.pokemon?.species_id) discovered.add(pokeData.pokemon.species_id)
      // 2. Evolution history
      if (evolveData?.history) {
        for (const h of evolveData.history) {
          discovered.add(h.fromSpeciesId)
          discovered.add(h.toSpeciesId)
        }
      }
      // 3. Battle system discovered_species (catches, encounters)
      if (speciesData?.species) {
        for (const sp of speciesData.species) {
          if (sp.discovered) discovered.add(sp.id)
        }
      }
      setDiscoveredIds(Array.from(discovered))
      setLoading(false)
    })
  }, [])

  const categories = Object.keys(CATEGORY_LABELS)
  const filteredAch = filterCategory === 'all' ? achievements : achievements.filter(a => a.category === filterCategory)

  const ownedSpeciesIds = discoveredIds.length > 0 ? discoveredIds : (myPokemon ? [myPokemon.species_id] : [])

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-teal-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <h1 className="game-title-green leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#065f46' }}>
          图鉴与成就 🏅
        </h1>
        <p className="text-emerald-500 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          收集宝可梦，解锁成就徽章！
        </p>
      </div>

      {/* Tab switch */}
      <div className="px-4 md:px-8 pt-6">
        <div className="flex gap-3 bg-white rounded-2xl border-2 border-gray-200 p-2 w-fit mb-6">
          {[
            { key: 'pokedex', label: '宝可梦图鉴', icon: '📖' },
            { key: 'achievements', label: '成就徽章', icon: '🏅' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-6 py-3 rounded-xl text-xl font-bold transition-all flex items-center gap-2 ${
                tab === t.key ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 pb-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : tab === 'pokedex' ? (
          /* Pokedex Tab */
          <div>
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 mb-6">
              <h2 className="game-label mb-2" style={{ fontSize: '1.75rem' }}>我的宝可梦</h2>
              <p className="text-gray-500 mb-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                已发现 {ownedSpeciesIds.length} / {POKEDEX_POKEMON.length} 种
              </p>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div className="h-4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                  style={{ width: `${(ownedSpeciesIds.length / POKEDEX_POKEMON.length) * 100}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {POKEDEX_POKEMON.map(p => {
                const owned = ownedSpeciesIds.includes(p.id)
                return (
                  <motion.div
                    key={p.id}
                    className={`rounded-2xl p-4 text-center border-2 transition-all ${
                      owned ? 'bg-white border-emerald-200 shadow-sm' : 'bg-gray-100 border-gray-200'
                    }`}
                    whileHover={owned ? { scale: 1.05 } : {}}
                  >
                    <div className="relative">
                      <img
                        src={HOME_SPRITE(p.id)}
                        alt={p.name}
                        width={80} height={80}
                        style={{
                          width: 80, height: 80, objectFit: 'contain', margin: '0 auto',
                          filter: owned ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' : 'grayscale(1) brightness(0.3)',
                        }}
                      />
                    </div>
                    <p className={`mt-2 font-bold ${owned ? 'text-gray-800' : 'text-gray-400'}`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                      {owned ? p.name : '???'}
                    </p>
                    <p className="text-gray-400 text-sm">#{String(p.id).padStart(3, '0')}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Achievements Tab */
          <div>
            {/* Stats */}
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-3xl p-6 mb-6 text-white flex items-center justify-between"
              style={{ boxShadow: '0 6px 0 #b45309' }}>
              <div>
                <p className="text-2xl font-bold opacity-90" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>成就进度</p>
                <p className="font-bold mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '3rem' }}>
                  {totalUnlocked} / {totalAchievements}
                </p>
              </div>
              <div className="text-7xl">🏆</div>
            </div>

            {/* Category filter */}
            <div className="flex gap-3 mb-6 flex-wrap">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-4 py-2 rounded-xl font-bold border-2 transition-all ${
                  filterCategory === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200'
                }`}
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
              >
                全部
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-4 py-2 rounded-xl font-bold border-2 transition-all flex items-center gap-1 ${
                    filterCategory === cat ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
                >
                  {CATEGORY_LABELS[cat].icon} {CATEGORY_LABELS[cat].label}
                </button>
              ))}
            </div>

            {/* Achievement grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredAch.map(ach => (
                <motion.div
                  key={ach.id}
                  className={`rounded-2xl p-5 border-2 transition-all ${
                    ach.unlocked ? TIER_COLORS[ach.tier] : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                  whileHover={{ scale: ach.unlocked ? 1.02 : 1 }}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-4xl ${ach.unlocked ? '' : 'grayscale opacity-40'}`}>{ach.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold ${ach.unlocked ? 'text-gray-800' : 'text-gray-400'}`}
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                          {ach.title}
                        </p>
                        {ach.unlocked && (
                          <span className="text-emerald-500 text-lg">✓</span>
                        )}
                      </div>
                      <p className={`mt-1 ${ach.unlocked ? 'text-gray-500' : 'text-gray-400'}`}
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                        {ach.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          ach.tier === 4 ? 'bg-purple-100 text-purple-700' :
                          ach.tier === 3 ? 'bg-yellow-100 text-yellow-700' :
                          ach.tier === 2 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {TIER_LABELS[ach.tier]}
                        </span>
                        <span className="text-xs text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          {CATEGORY_LABELS[ach.category]?.label}
                        </span>
                      </div>
                      {ach.unlocked && ach.unlocked_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          解锁于 {ach.unlocked_at.slice(0, 10)}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

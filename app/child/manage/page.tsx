'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PokemonDisplay from '@/components/PokemonDisplay'
import StatsBar from '@/components/StatsBar'
import {
  getPokemonStatus, statusLabels, itemEmojis, itemLabels,
  getEvolutionRequirements, getEvolutionTargets, POKEMON_NAMES, POKEMON_TYPES,
} from '@/lib/game-logic'
import { useToast } from '@/components/ToastProvider'
import Link from 'next/link'

interface PokemonData {
  id: number
  species_id: number
  name: string
  vitality: number
  wisdom: number
  affection: number
  level: number
  battle_level: number
  display_level: number
  evolution_stage: number
  is_active: number
  source: string
  status: string
  battle_power?: number
  defense?: number
  hp?: number
  speed?: number
  streak_days?: number
  created_at?: string
}

interface InventoryItem {
  item_type: string
  quantity: number
}

type SortKey = 'level' | 'vitality' | 'affection' | 'wisdom'
type FilterKey = 'all' | 'starter' | 'captured'

const FEED_GAINS: Record<string, { vitality: number; wisdom: number; affection: number }> = {
  food:     { vitality: 10, wisdom: 0,  affection: 1 },
  crystal:  { vitality: 0,  wisdom: 8,  affection: 1 },
  candy:    { vitality: 5,  wisdom: 5,  affection: 3 },
  fragment: { vitality: 3,  wisdom: 3,  affection: 5 },
}

export default function ManagePage() {
  const { showToast } = useToast()
  const [pokemons, setPokemons] = useState<PokemonData[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null) // mobile feed expand
  const [sortBy, setSortBy] = useState<SortKey>('level')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [feedingId, setFeedingId] = useState<number | null>(null)
  const [releasing, setReleasing] = useState<number | null>(null)
  const [confirmRelease, setConfirmRelease] = useState<number | null>(null)

  const loadData = async () => {
    try {
      const res = await fetch('/api/pokemon')
      const data = await res.json()
      if (data.allPokemons) {
        setPokemons(data.allPokemons)
        if (!selectedId && data.allPokemons.length > 0) {
          const active = data.allPokemons.find((p: PokemonData) => p.is_active === 1)
          setSelectedId(active?.id || data.allPokemons[0].id)
        }
      }
      if (data.inventory) setInventory(data.inventory)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const getInvQty = (itemType: string) => {
    const item = inventory.find(i => i.item_type === itemType)
    return item ? Math.floor(item.quantity) : 0
  }

  const handleFeed = async (pokemonId: number, itemType: string) => {
    if (getInvQty(itemType) <= 0) {
      showToast('道具不足！', 'error')
      return
    }
    setFeedingId(pokemonId)
    try {
      const res = await fetch('/api/pokemon/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pokemonId, itemType }),
      })
      const data = await res.json()
      if (data.success) {
        const gains = FEED_GAINS[itemType]
        const gainParts: string[] = []
        if (gains.vitality > 0) gainParts.push(`体力+${gains.vitality}`)
        if (gains.wisdom > 0) gainParts.push(`智慧+${gains.wisdom}`)
        if (gains.affection > 0) gainParts.push(`亲密度+${gains.affection}`)

        const pokeName = pokemons.find(p => p.id === pokemonId)?.name || '宝可梦'
        showToast(`${pokeName} 吃了${itemLabels[itemType]}，${gainParts.join('，')}！`, 'success')
        await loadData()
      } else {
        showToast(data.error || '投喂失败', 'error')
      }
    } catch {
      showToast('投喂失败', 'error')
    }
    setFeedingId(null)
  }

  const handleSetActive = async (pokemonId: number) => {
    try {
      const res = await fetch('/api/battle/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActive', pokemonId }),
      })
      const data = await res.json()
      if (data.success) {
        const pokeName = pokemons.find(p => p.id === pokemonId)?.name || '宝可梦'
        showToast(`${pokeName} 成为了你的当前伙伴！`, 'success')
        await loadData()
      } else {
        showToast(data.error || '切换失败', 'error')
      }
    } catch {
      showToast('切换失败', 'error')
    }
  }

  const handleRelease = async (pokemonId: number) => {
    setReleasing(pokemonId)
    try {
      const res = await fetch('/api/battle/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release', pokemonId }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || '已释放宝可梦', 'success')
        setConfirmRelease(null)
        if (selectedId === pokemonId) setSelectedId(null)
        await loadData()
      } else {
        showToast(data.error || '释放失败', 'error')
      }
    } catch {
      showToast('释放失败', 'error')
    }
    setReleasing(null)
  }

  // Sort and filter
  const filtered = pokemons
    .filter(p => {
      if (filterBy === 'starter') return p.source === 'starter'
      if (filterBy === 'captured') return p.source === 'captured'
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'level') return (b.display_level || b.level) - (a.display_level || a.level)
      if (sortBy === 'vitality') return b.vitality - a.vitality
      if (sortBy === 'wisdom') return b.wisdom - a.wisdom
      if (sortBy === 'affection') return b.affection - a.affection
      return 0
    })

  const selected = pokemons.find(p => p.id === selectedId) || null

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-3xl animate-pulse" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
          加载中...
        </div>
      </div>
    )
  }

  const renderFeedButtons = (pokemon: PokemonData, compact = false) => (
    <div className={`grid grid-cols-4 ${compact ? 'gap-2' : 'gap-3'}`}>
      {(['food', 'crystal', 'candy', 'fragment'] as const).map(itemType => {
        const qty = getInvQty(itemType)
        const disabled = qty <= 0 || feedingId === pokemon.id
        return (
          <motion.button
            key={itemType}
            onClick={() => handleFeed(pokemon.id, itemType)}
            disabled={disabled}
            className={`flex flex-col items-center ${compact ? 'py-2 px-1' : 'py-3 px-2'} rounded-xl border-2 transition-all ${
              disabled
                ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-700 cursor-pointer'
            }`}
            style={{ boxShadow: disabled ? 'none' : '0 2px 0 rgba(0,0,0,0.06)' }}
            whileHover={disabled ? {} : { scale: 1.05 }}
            whileTap={disabled ? {} : { scale: 0.95 }}
          >
            <span className={compact ? 'text-xl' : 'text-2xl'}>{itemEmojis[itemType]}</span>
            <span className="font-bold mt-0.5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: compact ? '0.7rem' : '0.8rem' }}>
              {itemLabels[itemType]}
            </span>
            <span className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: compact ? '0.8rem' : '0.9rem', color: qty > 0 ? '#d97706' : '#d1d5db' }}>
              x{qty}
            </span>
          </motion.button>
        )
      })}
    </div>
  )

  const renderPokemonCard = (p: PokemonData) => {
    const isSelected = selectedId === p.id
    const isExpanded = expandedId === p.id
    const displayLevel = p.display_level || Math.max(p.level || 1, p.battle_level || 1)
    const pokemonStatus = p.status || getPokemonStatus(p.vitality, p.wisdom, p.affection)
    const canEvolve = (() => {
      const stage = p.evolution_stage ?? 1
      const reqs = getEvolutionRequirements(stage)
      const targets = getEvolutionTargets(p.species_id, stage)
      const fragmentQty = getInvQty('fragment')
      return displayLevel >= reqs.level && fragmentQty >= reqs.fragments && targets.length > 0
    })()

    return (
      <motion.div
        key={p.id}
        layout
        className={`bg-white rounded-2xl border-2 transition-all cursor-pointer ${
          isSelected
            ? p.is_active ? 'border-amber-400 ring-2 ring-amber-200' : 'border-indigo-400 ring-2 ring-indigo-200'
            : p.is_active ? 'border-amber-300' : 'border-gray-200'
        }`}
        style={{
          boxShadow: isSelected
            ? '0 4px 12px rgba(0,0,0,0.1)'
            : '0 2px 0 rgba(0,0,0,0.04)',
        }}
        onClick={() => {
          setSelectedId(p.id)
          // On mobile, toggle expand
          if (window.innerWidth < 768) {
            setExpandedId(isExpanded ? null : p.id)
          }
        }}
        whileHover={{ scale: 1.01 }}
      >
        <div className="p-4">
          <div className="flex items-center gap-3">
            {/* Mini pokemon sprite */}
            <div className="flex-shrink-0">
              <img
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${p.species_id}.png`}
                alt={p.name}
                className="w-14 h-14 md:w-16 md:h-16 object-contain"
                style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.2))' }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-800 truncate" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                  {p.name}
                </span>
                <span className="font-bold text-indigo-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.9rem' }}>
                  Lv.{displayLevel}
                </span>
                {p.is_active === 1 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    ★ 伙伴
                  </span>
                )}
                {canEvolve && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-300"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    ✨ 可进化
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{
                    fontFamily: "'ZCOOL KuaiLe', sans-serif",
                    background: p.source === 'starter' ? '#fef3c7' : '#dbeafe',
                    color: p.source === 'starter' ? '#92400e' : '#1d4ed8',
                  }}>
                  {p.source === 'starter' ? '🌟 初始' : '🎯 捕获'}
                </span>
                {POKEMON_TYPES[p.species_id] && (
                  <span className="text-xs text-gray-400 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {POKEMON_TYPES[p.species_id]}
                  </span>
                )}
              </div>

              {/* Mini stats bars */}
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs">❤️</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${p.vitality}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs">💡</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${p.wisdom}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs">💕</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-400 rounded-full" style={{ width: `${p.affection}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile expanded feed section */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden md:hidden"
              >
                <div className="pt-4 mt-3 border-t border-gray-100 space-y-3">
                  <p className="text-gray-500 font-bold text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    投喂道具
                  </p>
                  {renderFeedButtons(p, true)}
                  <div className="flex gap-2">
                    {p.is_active !== 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSetActive(p.id) }}
                        className="flex-1 py-2 rounded-xl font-bold text-sm bg-amber-50 text-amber-700 border-2 border-amber-200 hover:bg-amber-100 transition-all"
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                      >
                        ★ 设为伙伴
                      </button>
                    )}
                    {canEvolve && (
                      <Link href="/child/evolve" className="flex-1" onClick={(e) => e.stopPropagation()}>
                        <button className="w-full py-2 rounded-xl font-bold text-sm bg-purple-50 text-purple-700 border-2 border-purple-200 hover:bg-purple-100 transition-all"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          ✨ 进化
                        </button>
                      </Link>
                    )}
                    {p.source !== 'starter' && pokemons.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmRelease(p.id) }}
                        className="py-2 px-3 rounded-xl font-bold text-sm bg-gray-50 text-gray-400 border-2 border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                      >
                        放归
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    )
  }

  const renderDetailPanel = () => {
    if (!selected) {
      return (
        <div className="flex items-center justify-center h-full text-gray-300">
          <p className="text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
            选择一只宝可梦查看详情
          </p>
        </div>
      )
    }

    const displayLevel = selected.display_level || Math.max(selected.level || 1, selected.battle_level || 1)
    const stage = selected.evolution_stage ?? 1
    const reqs = getEvolutionRequirements(stage)
    const targets = getEvolutionTargets(selected.species_id, stage)
    const fragmentQty = getInvQty('fragment')
    const canEvolve = displayLevel >= reqs.level && fragmentQty >= reqs.fragments && targets.length > 0
    const isMaxStage = targets.length === 0

    return (
      <div className="space-y-5">
        {/* Pokemon display */}
        <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl p-6 flex flex-col items-center">
          <PokemonDisplay
            speciesId={selected.species_id}
            name={selected.name}
            vitality={selected.vitality}
            wisdom={selected.wisdom}
            affection={selected.affection}
            level={displayLevel}
            size="large"
          />
          <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
            {selected.is_active === 1 && (
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700 border border-amber-300"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                ★ 当前伙伴
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-sm font-bold"
              style={{
                fontFamily: "'ZCOOL KuaiLe', sans-serif",
                background: selected.source === 'starter' ? '#fef3c7' : '#dbeafe',
                color: selected.source === 'starter' ? '#92400e' : '#1d4ed8',
              }}>
              {selected.source === 'starter' ? '🌟 初始伙伴' : '🎯 战斗捕获'}
            </span>
            {POKEMON_TYPES[selected.species_id] && (
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-600"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                {POKEMON_TYPES[selected.species_id]}属性
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-5 border-2 border-gray-100 space-y-4" style={{ boxShadow: '0 2px 0 rgba(0,0,0,0.04)' }}>
          <h3 className="font-bold text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
            属性状态
          </h3>
          <StatsBar label="体力" value={selected.vitality} color="bg-red-400" emoji="❤️" />
          <StatsBar label="智慧" value={selected.wisdom} color="bg-blue-400" emoji="💡" />
          <StatsBar label="亲密度" value={selected.affection} color="bg-pink-400" emoji="💕" />
          <div className="mt-2 text-center">
            <span className="px-4 py-1.5 rounded-full font-bold text-sm"
              style={{
                fontFamily: "'ZCOOL KuaiLe', sans-serif",
                background: selected.status === 'joyful' ? '#fef3c7' :
                            selected.status === 'happy' ? '#d1fae5' :
                            selected.status === 'calm' ? '#e0f2fe' :
                            selected.status === 'tired' ? '#f1f5f9' :
                            selected.status === 'sad' ? '#dbeafe' :
                            selected.status === 'anxious' ? '#fef9c3' :
                            selected.status === 'exhausted' ? '#e2e8f0' :
                            selected.status === 'lonely' ? '#e0e7ff' :
                            selected.status === 'sleeping' ? '#ede9fe' : '#f1f5f9',
                color: selected.status === 'joyful' ? '#78350f' :
                       selected.status === 'happy' ? '#064e3b' :
                       selected.status === 'calm' ? '#0c4a6e' :
                       selected.status === 'tired' ? '#334155' :
                       selected.status === 'sad' ? '#1e3a5f' :
                       selected.status === 'anxious' ? '#713f12' :
                       selected.status === 'exhausted' ? '#1f2937' :
                       selected.status === 'lonely' ? '#312e81' :
                       selected.status === 'sleeping' ? '#4c1d95' : '#374151',
              }}>
              {statusLabels[selected.status as keyof typeof statusLabels] || '精神良好'}
            </span>
          </div>
        </div>

        {/* Battle stats */}
        {(selected.battle_power || selected.hp) && (
          <div className="bg-white rounded-2xl p-5 border-2 border-gray-100" style={{ boxShadow: '0 2px 0 rgba(0,0,0,0.04)' }}>
            <h3 className="font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
              战斗属性
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '攻击力', value: selected.battle_power, emoji: '⚔️', color: '#ef4444' },
                { label: '防御力', value: selected.defense, emoji: '🛡️', color: '#3b82f6' },
                { label: '生命值', value: selected.hp, emoji: '💚', color: '#22c55e' },
                { label: '速度', value: selected.speed, emoji: '💨', color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <span className="text-lg">{s.emoji}</span>
                  <p className="text-xs text-gray-400 font-bold mt-0.5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {s.label}
                  </p>
                  <p className="font-bold text-lg" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", color: s.color }}>
                    {Math.round(s.value || 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evolution progress */}
        <div className="bg-white rounded-2xl p-5 border-2 border-gray-100" style={{ boxShadow: '0 2px 0 rgba(0,0,0,0.04)' }}>
          <h3 className="font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
            进化进度
          </h3>
          {isMaxStage ? (
            <div className="text-center py-3">
              <span className="text-2xl">👑</span>
              <p className="text-gray-500 font-bold mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                已达最终形态！
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  ⬆️ 等级 Lv.{displayLevel} / Lv.{reqs.level}
                </span>
                <span>{displayLevel >= reqs.level ? '✅' : `差 ${reqs.level - displayLevel} 级`}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className={`h-full rounded-full ${displayLevel >= reqs.level ? 'bg-green-400' : 'bg-blue-400'}`}
                  style={{ width: `${Math.min(100, (displayLevel / reqs.level) * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  🪨 碎片 {fragmentQty} / {reqs.fragments}
                </span>
                <span>{fragmentQty >= reqs.fragments ? '✅' : `差 ${reqs.fragments - fragmentQty} 个`}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className={`h-full rounded-full ${fragmentQty >= reqs.fragments ? 'bg-green-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, (fragmentQty / reqs.fragments) * 100)}%` }} />
              </div>
              {targets.length > 0 && (
                <p className="text-xs text-gray-400 font-bold mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  进化目标：{targets.map(id => POKEMON_NAMES[id] || `#${id}`).join('、')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Feed section */}
        <div className="bg-white rounded-2xl p-5 border-2 border-gray-100" style={{ boxShadow: '0 2px 0 rgba(0,0,0,0.04)' }}>
          <h3 className="font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
            投喂道具
          </h3>
          {renderFeedButtons(selected)}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {selected.is_active !== 1 && (
            <motion.button
              onClick={() => handleSetActive(selected.id)}
              className="flex-1 py-3 rounded-xl font-bold bg-amber-50 text-amber-700 border-2 border-amber-300 hover:bg-amber-100 transition-all"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem', boxShadow: '0 3px 0 #fbbf24' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              ★ 设为伙伴
            </motion.button>
          )}
          {canEvolve && (
            <Link href="/child/evolve" className="flex-1">
              <motion.button
                className="w-full py-3 rounded-xl font-bold bg-purple-50 text-purple-700 border-2 border-purple-300 hover:bg-purple-100 transition-all"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem', boxShadow: '0 3px 0 #a855f7' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ✨ 进化
              </motion.button>
            </Link>
          )}
          {selected.source !== 'starter' && pokemons.length > 1 && (
            <motion.button
              onClick={() => setConfirmRelease(selected.id)}
              className="py-3 px-4 rounded-xl font-bold bg-gray-50 text-gray-400 border-2 border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-all"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              放归
            </motion.button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-5"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', color: '#4338ca' }}>
              我的宝可梦 📦
            </h1>
            <p className="text-indigo-400 mt-1 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: 'clamp(0.9rem, 2vw, 1.3rem)' }}>
              共 {pokemons.length} 只宝可梦
            </p>
          </div>

          {/* Inventory summary */}
          <div className="flex items-center gap-3 flex-wrap">
            {(['food', 'crystal', 'candy', 'fragment'] as const).map(itemType => (
              <div key={itemType} className="flex items-center gap-1 bg-white/80 rounded-full px-3 py-1.5 border border-gray-200">
                <span className="text-lg">{itemEmojis[itemType]}</span>
                <span className="font-bold text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}>
                  {getInvQty(itemType)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sort and Filter */}
      <div className="px-4 md:px-8 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-bold text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>排序:</span>
          {([
            { key: 'level' as SortKey, label: '等级' },
            { key: 'vitality' as SortKey, label: '体力' },
            { key: 'wisdom' as SortKey, label: '智慧' },
            { key: 'affection' as SortKey, label: '亲密度' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${
                sortBy === s.key ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-gray-400 font-bold text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>筛选:</span>
          {([
            { key: 'all' as FilterKey, label: '全部' },
            { key: 'starter' as FilterKey, label: '初始' },
            { key: 'captured' as FilterKey, label: '捕获' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilterBy(f.key)}
              className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${
                filterBy === f.key ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 md:px-8 py-5">
        {pokemons.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl">📭</span>
            <p className="text-gray-400 text-xl mt-4 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              还没有宝可梦，去战斗中捕获吧！
            </p>
            <Link href="/child/battle">
              <motion.button
                className="mt-5 px-8 py-3 rounded-2xl font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-all"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem', boxShadow: '0 4px 0 #3730a3' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ⚔️ 去战斗
              </motion.button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-5">
            {/* Pokemon list */}
            <div className="flex-1 space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-400 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    没有符合筛选条件的宝可梦
                  </p>
                </div>
              ) : (
                filtered.map(p => renderPokemonCard(p))
              )}
            </div>

            {/* Desktop detail panel */}
            <div className="hidden md:block w-[420px] flex-shrink-0">
              <div className="sticky top-5 bg-gray-50 rounded-2xl border-2 border-gray-200 p-5"
                style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.04)', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                {renderDetailPanel()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Release confirmation modal */}
      <AnimatePresence>
        {confirmRelease && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmRelease(null)}
          >
            <motion.div
              className="bg-white rounded-3xl p-7 max-w-sm w-full"
              style={{ boxShadow: '0 8px 0 rgba(0,0,0,0.1)' }}
              initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const p = pokemons.find(p => p.id === confirmRelease)
                if (!p) return null
                const candyReturn = (p.battle_level || 1) * 2
                return (
                  <>
                    <div className="text-center mb-5">
                      <img
                        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${p.species_id}.png`}
                        alt={p.name}
                        className="w-20 h-20 mx-auto object-contain"
                        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}
                      />
                      <h3 className="font-bold text-gray-800 mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.4rem' }}>
                        确定要放归 {p.name} 吗？
                      </h3>
                      <p className="text-gray-500 mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                        放归后将无法找回，你将获得 <span className="text-amber-600 font-bold">{candyReturn} ⭐星星糖</span>
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmRelease(null)}
                        className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleRelease(confirmRelease)}
                        disabled={releasing === confirmRelease}
                        className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50"
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem', boxShadow: '0 3px 0 #b91c1c' }}
                      >
                        {releasing === confirmRelease ? '放归中...' : '确定放归'}
                      </button>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

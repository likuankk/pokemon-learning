'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getPokemonStatus, statusLabels, itemEmojis, itemLabels } from '@/lib/game-logic'
import { useToast } from '@/components/ToastProvider'

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

interface Pokemon {
  species_id: number; name: string
  vitality: number; wisdom: number; affection: number; level: number
}
interface InventoryItem { item_type: string; quantity: number }

const ITEM_EFFECTS = {
  food:     { vitality: 10, wisdom: 0,  affection: 1,  desc: '恢复体力！' },
  crystal:  { vitality: 0,  wisdom: 8,  affection: 1,  desc: '增加智慧！' },
  candy:    { vitality: 5,  wisdom: 5,  affection: 3,  desc: '均衡成长！' },
  fragment: { vitality: 3,  wisdom: 3,  affection: 5,  desc: '加深感情！' },
}

interface FloatingText { id: number; text: string; color: string }

export default function FeedPage() {
  const { showToast } = useToast()
  const [pokemon, setPokemon] = useState<Pokemon | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [feeding, setFeeding] = useState<string | null>(null)
  const [bounce, setBounce] = useState(false)
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([])
  let floatId = 0

  const load = () => {
    fetch('/api/pokemon')
      .then(r => r.json())
      .then(d => {
        setPokemon(d.pokemon)
        setInventory(d.inventory || [])
      })
  }

  useEffect(() => { load() }, [])

  const getQty = (type: string) => {
    const item = inventory.find(i => i.item_type === type)
    return item ? Math.floor(item.quantity) : 0
  }

  const handleFeed = async (itemType: string) => {
    if (feeding) return
    if (getQty(itemType) < 1) {
      showToast('道具不足！完成任务来获得更多', 'error', '😢')
      return
    }
    setFeeding(itemType)
    try {
      const res = await fetch('/api/pokemon/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType }),
      })
      const data = await res.json()
      if (res.ok) {
        setPokemon(data.pokemon)
        setInventory(data.inventory)
        setBounce(true)
        setTimeout(() => setBounce(false), 600)

        // Floating gain texts
        const gains = data.gains
        const newFloats: FloatingText[] = []
        if (gains.vitality > 0) newFloats.push({ id: floatId++, text: `❤️ +${gains.vitality}`, color: '#f43f5e' })
        if (gains.wisdom   > 0) newFloats.push({ id: floatId++, text: `💡 +${gains.wisdom}`,   color: '#3b82f6' })
        if (gains.affection> 0) newFloats.push({ id: floatId++, text: `💕 +${gains.affection}`,color: '#ec4899' })
        setFloatingTexts(prev => [...prev, ...newFloats])
        setTimeout(() => setFloatingTexts(prev => prev.filter(f => !newFloats.find(n => n.id === f.id))), 1500)

        showToast(`${pokemon?.name} 很开心！${ITEM_EFFECTS[itemType as keyof typeof ITEM_EFFECTS]?.desc}`, 'success', itemEmojis[itemType])
      } else {
        showToast(data.error || '喂食失败', 'error', '❌')
      }
    } catch {
      showToast('网络错误', 'error', '❌')
    }
    setFeeding(null)
  }

  const status = pokemon ? getPokemonStatus(pokemon.vitality, pokemon.wisdom, pokemon.affection) : 'good'

  const bgColors: Record<string, string> = {
    energetic: 'from-yellow-50 via-amber-50 to-orange-50',
    good:      'from-teal-50 via-cyan-50 to-emerald-50',
    tired:     'from-gray-50 via-slate-50 to-gray-100',
    sad:       'from-gray-100 via-slate-100 to-gray-100',
  }

  return (
    <div className={`min-h-full bg-gradient-to-br ${bgColors[status]}`}>
      <div className="border-b-4 border-white/50 px-4 md:px-8 py-6"
        style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)' }}>
        <h1 className="game-title-green leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#065f46' }}>喂养宝可梦 🍖</h1>
        <p className="text-emerald-600 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
          用道具让你的伙伴更强壮！
        </p>
      </div>

      <div className="px-4 md:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left: Pokemon showcase */}
          <div className="w-full md:w-[400px] md:flex-shrink-0">
            <div className="bg-white/70 backdrop-blur rounded-3xl p-8 flex flex-col items-center"
              style={{ boxShadow: '0 6px 0 rgba(0,0,0,0.08), 0 12px 24px rgba(0,0,0,0.08)' }}>
              {pokemon ? (
                <>
                  {/* Pokemon with floating texts */}
                  <div className="relative flex justify-center items-center" style={{ height: 320 }}>
                    {/* Aura */}
                    <div className="absolute inset-0 rounded-full"
                      style={{
                        background: status === 'energetic'
                          ? 'radial-gradient(ellipse, rgba(251,191,36,0.35) 0%, transparent 70%)'
                          : 'radial-gradient(ellipse, rgba(52,211,153,0.25) 0%, transparent 70%)',
                        filter: 'blur(16px)',
                        transform: 'scale(1.2)',
                      }}
                    />
                    <motion.img
                      src={HOME_SPRITE(pokemon.species_id)}
                      alt={pokemon.name}
                      width={260} height={260}
                      style={{
                        width: 260, height: 260, objectFit: 'contain', position: 'relative', zIndex: 1,
                        filter: 'drop-shadow(0 16px 20px rgba(0,0,0,0.3))',
                      }}
                      animate={bounce
                        ? { y: [0, -30, 0], scale: [1, 1.1, 1] }
                        : { y: [0, -12, 0] }
                      }
                      transition={bounce
                        ? { duration: 0.5, ease: 'easeOut' }
                        : { repeat: Infinity, duration: 2.5, ease: 'easeInOut' }
                      }
                    />
                    {/* Ground shadow */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2"
                      style={{ width: 160, height: 20, background: 'radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%)', borderRadius: '50%' }} />

                    {/* Floating gain texts */}
                    <AnimatePresence>
                      {floatingTexts.map((f, i) => (
                        <motion.div
                          key={f.id}
                          className="absolute font-bold pointer-events-none"
                          style={{
                            fontFamily: "'ZCOOL KuaiLe', sans-serif",
                            fontSize: '1.5rem',
                            color: f.color,
                            textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            left: `${30 + i * 30}%`,
                            top: '20%',
                            zIndex: 10,
                          }}
                          initial={{ opacity: 0, y: 0, scale: 0.5 }}
                          animate={{ opacity: 1, y: -60, scale: 1.2 }}
                          exit={{ opacity: 0, y: -90, scale: 0.8 }}
                          transition={{ duration: 1.2 }}
                        >
                          {f.text}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <p className="game-label font-bold mt-2" style={{ fontSize: '2rem' }}>{pokemon.name}</p>
                  <p className="font-bold mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', color: '#6366f1' }}>
                    Lv.{pokemon.level}
                  </p>
                  <div className="mt-3 px-5 py-2 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '2px solid rgba(0,0,0,0.06)' }}>
                    <span className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem', color: '#374151' }}>
                      {statusLabels[status as keyof typeof statusLabels]}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="w-full mt-5 space-y-4">
                    {[
                      { label: '❤️ 体力', value: pokemon.vitality, color: '#f43f5e', bg: '#fee2e2' },
                      { label: '💡 智慧', value: pokemon.wisdom,   color: '#3b82f6', bg: '#dbeafe' },
                      { label: '💕 亲密', value: pokemon.affection,color: '#ec4899', bg: '#fce7f3' },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="flex justify-between mb-2">
                          <span className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', color: '#374151' }}>{s.label}</span>
                          <span className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', color: s.color }}>{Math.round(s.value)}/100</span>
                        </div>
                        <div className="w-full rounded-full overflow-hidden border border-white"
                          style={{ height: 20, background: s.bg, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${s.color}99, ${s.color})`, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)' }}
                            animate={{ width: `${s.value}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-400 text-2xl py-16" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</p>
              )}
            </div>
          </div>

          {/* Right: Items */}
          <div className="flex-1 space-y-6">
            <div className="bg-white/70 backdrop-blur rounded-3xl p-7"
              style={{ boxShadow: '0 6px 0 rgba(0,0,0,0.08), 0 12px 24px rgba(0,0,0,0.08)' }}>
              <h2 className="game-label mb-6" style={{ fontSize: '2rem' }}>道具背包</h2>
              <div className="grid grid-cols-2 gap-5">
                {(['food', 'crystal', 'candy', 'fragment'] as const).map(itemType => {
                  const qty = getQty(itemType)
                  const effect = ITEM_EFFECTS[itemType]
                  const canUse = qty > 0 && !feeding
                  return (
                    <motion.button
                      key={itemType}
                      onClick={() => handleFeed(itemType)}
                      disabled={!canUse}
                      className={`rounded-2xl p-6 text-left transition-all ${canUse ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                      style={{
                        background: canUse ? 'linear-gradient(135deg, #fff 0%, #f8faff 100%)' : '#f9fafb',
                        border: feeding === itemType ? '3px solid #6366f1' : '2px solid #e5e7eb',
                        boxShadow: canUse ? '0 5px 0 rgba(0,0,0,0.08)' : 'none',
                      }}
                      whileHover={canUse ? { scale: 1.03, y: -3 } : {}}
                      whileTap={canUse ? { scale: 0.97, y: 1 } : {}}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-5xl">{itemEmojis[itemType]}</span>
                        <span className="font-bold text-3xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", color: qty > 0 ? '#4f46e5' : '#9ca3af' }}>
                          ×{qty}
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.4rem' }}>
                        {itemLabels[itemType]}
                      </p>
                      <div className="space-y-1">
                        {effect.vitality  > 0 && <p className="text-red-500 font-bold"  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>❤️ 体力 +{effect.vitality}</p>}
                        {effect.wisdom    > 0 && <p className="text-blue-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>💡 智慧 +{effect.wisdom}</p>}
                        {effect.affection > 0 && <p className="text-pink-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>💕 亲密 +{effect.affection}</p>}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            <div className="bg-white/60 rounded-2xl p-5 border-2 border-dashed border-gray-200">
              <p className="font-bold text-gray-500 text-center" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
                💡 完成学习任务可以获得更多道具
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

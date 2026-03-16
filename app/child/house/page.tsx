'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Decoration {
  id: string; name: string; category: string; price: number
  icon: string; description: string; rarity: string
}

interface HouseItem {
  id: number; child_id: number; decoration_id: string; placed: number; slot: string
}

const CATEGORY_LABELS: Record<string, string> = {
  furniture: '家具', floor: '地板', wall: '墙壁装饰', toy: '玩具', plant: '植物', outdoor: '室外',
}

const RARITY_COLORS: Record<string, string> = {
  common: 'border-gray-200 bg-white',
  uncommon: 'border-green-200 bg-green-50',
  rare: 'border-blue-200 bg-blue-50',
  epic: 'border-purple-200 bg-purple-50',
}

const RARITY_LABELS: Record<string, string> = {
  common: '普通', uncommon: '优质', rare: '稀有', epic: '史诗',
}

export default function HousePage() {
  const [catalog, setCatalog] = useState<Decoration[]>([])
  const [owned, setOwned] = useState<HouseItem[]>([])
  const [candyBalance, setCandyBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'house' | 'shop'>('house')
  const [shopCategory, setShopCategory] = useState('all')
  const [buying, setBuying] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = () => {
    fetch('/api/decorations?childId=2').then(r => r.json()).then(data => {
      setCatalog(data.catalog || [])
      setOwned(data.owned || [])
      setCandyBalance(data.candyBalance || 0)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleBuy = async (decorationId: string) => {
    setBuying(decorationId)
    setMessage('')
    const res = await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: 2, action: 'buy', decorationId }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(data.message || '购买成功！')
      load()
    } else {
      setMessage(data.error || '购买失败')
    }
    setBuying(null)
  }

  const handleTogglePlace = async (item: HouseItem) => {
    const action = item.placed ? 'remove' : 'place'
    await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: 2, action, houseItemId: item.id, slot: 'main' }),
    })
    load()
  }

  const getDecoInfo = (decorId: string) => catalog.find(d => d.id === decorId)
  const placedItems = owned.filter(i => i.placed)
  const unplacedItems = owned.filter(i => !i.placed)

  const filteredCatalog = shopCategory === 'all'
    ? catalog
    : catalog.filter(d => d.category === shopCategory)

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-teal-200 px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="game-title-green leading-tight" style={{ fontSize: '3.5rem', color: '#065f46' }}>小屋装饰 🏠</h1>
            <p className="text-emerald-500 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
              打造你和宝可梦的温馨小窝！
            </p>
          </div>
          <div className="flex items-center gap-2 bg-yellow-100 border-2 border-yellow-300 rounded-2xl px-5 py-3">
            <span className="text-3xl">⭐</span>
            <span className="font-bold text-yellow-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
              {candyBalance} 星星糖
            </span>
          </div>
        </div>
      </div>

      {/* Tab switch */}
      <div className="px-8 pt-6">
        <div className="flex gap-3 bg-white rounded-2xl border-2 border-gray-200 p-2 w-fit mb-6">
          {[
            { key: 'house', label: '我的小屋', icon: '🏠' },
            { key: 'shop', label: '装饰商店', icon: '🛍️' },
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

        {message && (
          <motion.div
            className="bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-3 mb-4 text-green-700 font-bold"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
          >
            {message}
          </motion.div>
        )}
      </div>

      <div className="px-8 pb-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : tab === 'house' ? (
          <div>
            {/* Placed items - house view */}
            <div className="bg-gradient-to-b from-sky-100 to-green-100 rounded-3xl border-2 border-sky-200 p-8 mb-6 min-h-[300px]">
              <h2 className="game-label mb-4" style={{ fontSize: '1.75rem' }}>我的小屋</h2>
              {placedItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-6xl mb-3">🏠</div>
                  <p className="text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>小屋还空空的，去商店购买装饰品吧！</p>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-4">
                  {placedItems.map(item => {
                    const info = getDecoInfo(item.decoration_id)
                    return info ? (
                      <motion.button
                        key={item.id}
                        onClick={() => handleTogglePlace(item)}
                        className="bg-white/80 rounded-2xl p-4 text-center border-2 border-white/50 hover:border-red-200 transition-all"
                        whileHover={{ scale: 1.05 }}
                        title="点击移除"
                      >
                        <div className="text-4xl mb-2">{info.icon}</div>
                        <p className="text-sm font-bold text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{info.name}</p>
                      </motion.button>
                    ) : null
                  })}
                </div>
              )}
            </div>

            {/* Unplaced items - inventory */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-7">
              <h2 className="game-label mb-4" style={{ fontSize: '1.75rem' }}>仓库 ({unplacedItems.length})</h2>
              {unplacedItems.length === 0 ? (
                <p className="text-gray-400 text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>仓库是空的</p>
              ) : (
                <div className="grid grid-cols-6 gap-4">
                  {unplacedItems.map(item => {
                    const info = getDecoInfo(item.decoration_id)
                    return info ? (
                      <motion.button
                        key={item.id}
                        onClick={() => handleTogglePlace(item)}
                        className="bg-gray-50 rounded-2xl p-4 text-center border-2 border-gray-200 hover:border-emerald-300 transition-all"
                        whileHover={{ scale: 1.05 }}
                        title="点击放置"
                      >
                        <div className="text-4xl mb-2">{info.icon}</div>
                        <p className="text-sm font-bold text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{info.name}</p>
                      </motion.button>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Shop Tab */
          <div>
            {/* Category filter */}
            <div className="flex gap-3 mb-6 flex-wrap">
              <button
                onClick={() => setShopCategory('all')}
                className={`px-4 py-2 rounded-xl font-bold border-2 transition-all ${
                  shopCategory === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200'
                }`}
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
              >
                全部
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setShopCategory(key)}
                  className={`px-4 py-2 rounded-xl font-bold border-2 transition-all ${
                    shopCategory === key ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-4">
              {filteredCatalog.map(d => {
                const alreadyOwned = owned.some(o => o.decoration_id === d.id)
                const canAfford = candyBalance >= d.price
                return (
                  <motion.div
                    key={d.id}
                    className={`rounded-2xl p-5 border-2 ${RARITY_COLORS[d.rarity]}`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-5xl text-center mb-3">{d.icon}</div>
                    <p className="font-bold text-gray-800 text-center" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}>{d.name}</p>
                    <p className="text-gray-500 text-center text-sm mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{d.description}</p>
                    <div className="flex justify-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        d.rarity === 'epic' ? 'bg-purple-100 text-purple-600' :
                        d.rarity === 'rare' ? 'bg-blue-100 text-blue-600' :
                        d.rarity === 'uncommon' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>{RARITY_LABELS[d.rarity]}</span>
                    </div>
                    <div className="mt-3 text-center">
                      {alreadyOwned ? (
                        <span className="text-emerald-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>✓ 已拥有</span>
                      ) : (
                        <button
                          onClick={() => handleBuy(d.id)}
                          disabled={!canAfford || buying === d.id}
                          className={`px-4 py-2 rounded-xl font-bold text-white transition-all ${
                            canAfford ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-gray-300 cursor-not-allowed'
                          }`}
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                        >
                          {buying === d.id ? '购买中...' : `⭐ ${d.price}`}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

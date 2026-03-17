'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Challenge {
  id: number; title: string; description: string; subject: string
  difficulty: number; bonus_candy: number; status: string
  created_at: string
}

const CHALLENGE_TYPES = [
  { type: 'math_adventure', label: '数学大冒险', icon: '🔢', desc: '趣味数学挑战题' },
  { type: 'reading_quest', label: '阅读探险', icon: '📖', desc: '完成一篇阅读理解' },
  { type: 'science_lab', label: '科学实验室', icon: '🔬', desc: '做一个小实验并记录' },
  { type: 'art_creation', label: '创意工坊', icon: '🎨', desc: '完成一幅创意作品' },
  { type: 'writing_challenge', label: '写作挑战', icon: '✍️', desc: '写一篇短文或日记' },
  { type: 'exercise_mission', label: '运动任务', icon: '🏃', desc: '完成体育锻炼目标' },
]

export default function WeekendChallengePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = () => {
    fetch('/api/weekend-challenge').then(r => r.json()).then(data => {
      setChallenges(data.challenges || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (type: string) => {
    setCreating(true)
    setMessage('')
    const challengeInfo = CHALLENGE_TYPES.find(c => c.type === type)
    const res = await fetch('/api/weekend-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        title: challengeInfo?.label || type,
        description: challengeInfo?.desc || '',
        bonusCandy: 5,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('周末挑战创建成功！')
      setSelectedType(null)
      load()
    } else {
      setMessage(data.error || '创建失败')
    }
    setCreating(false)
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#4338ca' }}>周末挑战 🎯</h1>
        <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
          为孩子创建有趣的周末特别任务！
        </p>
      </div>

      <div className="px-4 md:px-8 py-8">
        {message && (
          <motion.div
            className="bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-3 mb-6 text-green-700 font-bold"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
          >
            {message}
          </motion.div>
        )}

        {/* Create new challenge */}
        <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 mb-8" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
          <h2 className="game-label mb-4" style={{ fontSize: '1.75rem' }}>创建新挑战</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CHALLENGE_TYPES.map(ct => (
              <motion.button
                key={ct.type}
                onClick={() => setSelectedType(ct.type)}
                className={`p-5 rounded-2xl border-2 text-left transition-all ${
                  selectedType === ct.type ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'
                }`}
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-4xl mb-2">{ct.icon}</div>
                <p className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
                  {ct.label}
                </p>
                <p className="text-gray-500 text-sm mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  {ct.desc}
                </p>
              </motion.button>
            ))}
          </div>

          {selectedType && (
            <motion.div className="mt-6 flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={() => handleCreate(selectedType)}
                disabled={creating}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-8 py-4 rounded-2xl transition-all disabled:opacity-50"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', boxShadow: '0 5px 0 #3730a3' }}
              >
                {creating ? '创建中...' : '发布周末挑战 🚀'}
              </button>
            </motion.div>
          )}
        </div>

        {/* Existing challenges */}
        <h2 className="game-label mb-4" style={{ fontSize: '1.75rem' }}>已创建的挑战</h2>
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : challenges.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-12 text-center">
            <div className="text-6xl mb-3">🎯</div>
            <p className="text-gray-400 text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>还没有周末挑战</p>
            <p className="text-gray-400 mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>选择上方的挑战类型来创建吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {challenges.map((ch, i) => (
              <motion.div
                key={ch.id}
                className="bg-white rounded-2xl border-2 border-gray-200 p-6"
                style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
                    {ch.title}
                  </p>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    ch.status === 'completed' ? 'bg-green-100 text-green-700' :
                    ch.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`} style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {ch.status === 'completed' ? '已完成' : ch.status === 'submitted' ? '待审核' : '进行中'}
                  </span>
                </div>
                <p className="text-gray-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{ch.description}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-sm text-gray-400">{ch.created_at?.slice(0, 10)}</span>
                  <span className="text-sm text-yellow-600 font-bold">⭐ +{ch.bonus_candy} 糖果</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

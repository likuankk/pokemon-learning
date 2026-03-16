'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Honor {
  metric: string; value: number | string; unit: string; icon: string; description: string
}

export default function HonorPage() {
  const [honors, setHonors] = useState<Honor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/honor').then(r => r.json()).then(data => {
      setHonors(data.honors || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: '3.5rem', color: '#4338ca' }}>家庭荣誉榜 🏆</h1>
        <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
          小明的正向成长记录
        </p>
      </div>

      <div className="px-8 py-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-7 text-white mb-8"
              style={{ boxShadow: '0 6px 0 rgba(79,46,220,0.4)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '2rem' }}>
                    小明的成长旅程
                  </h2>
                  <p className="opacity-80 mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                    每一点进步都值得骄傲
                  </p>
                </div>
                <div className="text-7xl">🌟</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {honors.map((h, i) => (
                <motion.div
                  key={h.metric}
                  className="bg-white rounded-2xl p-6 border-2 border-gray-200"
                  style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">{h.icon}</div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                        {h.metric}
                      </p>
                      <p className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '2.5rem' }}>
                        {h.value}<span className="text-lg text-gray-400 ml-1">{h.unit}</span>
                      </p>
                      <p className="text-gray-400 text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                        {h.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 bg-yellow-50 rounded-2xl border-2 border-yellow-200 p-6 text-center">
              <p className="text-yellow-700 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
                💡 荣誉榜只记录正向进步，不与他人比较。每个孩子都有自己的节奏！
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

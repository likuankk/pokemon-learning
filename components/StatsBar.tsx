'use client'

import { motion } from 'framer-motion'

interface Props {
  label: string
  value: number
  max?: number
  color: string
  emoji: string
}

const colorToGradient: Record<string, string> = {
  'bg-red-400': 'linear-gradient(90deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%)',
  'bg-blue-400': 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
  'bg-pink-400': 'linear-gradient(90deg, #f472b6 0%, #ec4899 50%, #db2777 100%)',
  'bg-green-400': 'linear-gradient(90deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
  'bg-yellow-400': 'linear-gradient(90deg, #facc15 0%, #eab308 50%, #ca8a04 100%)',
  'bg-teal-400': 'linear-gradient(90deg, #2dd4bf 0%, #14b8a6 50%, #0d9488 100%)',
}

export default function StatsBar({ label, value, max = 100, color, emoji }: Props) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const gradient = colorToGradient[color] || colorToGradient['bg-blue-400']

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="game-label text-2xl font-bold">{emoji} {label}</span>
        <span
          className="font-bold text-xl"
          style={{
            fontFamily: "'ZCOOL KuaiLe', sans-serif",
            color: '#374151',
            textShadow: '1px 1px 0 rgba(0,0,0,0.1)',
          }}
        >
          {Math.round(value)}/{max}
        </span>
      </div>
      {/* 3D track */}
      <div
        className="w-full rounded-full overflow-hidden stat-bar-3d"
        style={{
          height: 28,
          background: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
          boxShadow: 'inset 0 3px 5px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(255,255,255,0.5)',
          border: '2px solid rgba(0,0,0,0.08)',
        }}
      >
        <motion.div
          className="h-full rounded-full stat-bar-fill-3d"
          style={{
            background: gradient,
            boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.15)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

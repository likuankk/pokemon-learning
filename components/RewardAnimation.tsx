'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ItemReward, itemLabels, itemEmojis } from '@/lib/game-logic'
import { useEffect, useState } from 'react'

interface Props {
  visible: boolean
  rewards: ItemReward | null
  pokemonSpeciesId?: number
  onClose: () => void
}

export default function RewardAnimation({ visible, rewards, pokemonSpeciesId = 25, onClose }: Props) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; emoji: string }[]>([])

  useEffect(() => {
    if (visible && rewards) {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 500 - 250,
        y: Math.random() * -300 - 80,
        emoji: ['⭐', '✨', '🎉', '💫', '🌟', '🎊', '🎈'][Math.floor(Math.random() * 7)],
      }))
      setParticles(newParticles)
    }
  }, [visible, rewards])

  if (!rewards) return null

  const rewardEntries = Object.entries(rewards).filter(([, qty]) => qty > 0)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative bg-white rounded-3xl p-10 max-w-lg w-full mx-4 text-center shadow-2xl"
            initial={{ scale: 0.5, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.6 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Particles */}
            {particles.map(p => (
              <motion.div
                key={p.id}
                className="absolute text-2xl pointer-events-none"
                style={{ left: '50%', top: '50%' }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{ x: p.x, y: p.y, opacity: 0, scale: 1.5 }}
                transition={{ duration: 1.2, delay: Math.random() * 0.3 }}
              >
                {p.emoji}
              </motion.div>
            ))}

            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-6xl mb-4"
            >
              🎊
            </motion.div>

            <motion.h2
              className="text-3xl font-bold text-yellow-600 mb-1"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              获得奖励！
            </motion.h2>

            <motion.p
              className="text-gray-500 text-sm mb-6"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              宝可梦为你感到骄傲 ✨
            </motion.p>

            <motion.div
              className="grid grid-cols-4 gap-4 mb-8"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {rewardEntries.map(([item, qty]) => (
                <div key={item} className="bg-yellow-50 rounded-2xl p-4 text-center border border-yellow-100">
                  <div className="text-3xl mb-1.5">{itemEmojis[item] || '🎁'}</div>
                  <div className="text-xs font-semibold text-gray-600">{itemLabels[item]}</div>
                  <div className="text-xl font-bold text-yellow-600 mt-1">+{qty}</div>
                </div>
              ))}
            </motion.div>

            <motion.button
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl transition-colors text-base"
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              太棒了！
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

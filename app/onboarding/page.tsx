'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

const STEPS = [
  {
    title: '欢迎来到宝可梦学习乐园！',
    description: '在这里，学习变成了一场精彩的冒险。完成任务，让你的宝可梦伙伴变得更强大！',
    image: '🌟',
    bg: 'from-blue-500 to-purple-600',
  },
  {
    title: '选择你的宝可梦伙伴',
    description: '每只宝可梦都有独特的性格。它会陪你一起学习、成长，还会给你写信鼓励你！',
    image: '✨',
    bg: 'from-yellow-400 to-orange-500',
    showPokemon: true,
  },
  {
    title: '完成任务获得奖励',
    description: '家长会为你设置学习任务。认真完成后，你的宝可梦会获得经验值和星星糖！',
    image: '📋',
    bg: 'from-green-400 to-emerald-600',
  },
  {
    title: '装饰你的小屋',
    description: '用星星糖购买家具和装饰品，打造属于你和宝可梦的温馨小窝！',
    image: '🏠',
    bg: 'from-pink-400 to-rose-600',
  },
  {
    title: '准备好了吗？',
    description: '让我们开始这段奇妙的学习冒险之旅吧！',
    image: '🚀',
    bg: 'from-indigo-500 to-violet-600',
  },
]

const STARTER_POKEMON = [
  { id: 25, name: '皮卡丘' },
  { id: 1, name: '妙蛙种子' },
  { id: 4, name: '小火龙' },
  { id: 7, name: '杰尼龟' },
  { id: 133, name: '伊布' },
  { id: 39, name: '胖丁' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedPokemon, setSelectedPokemon] = useState<typeof STARTER_POKEMON[0] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    }
  }

  const handlePrev = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleFinish = async () => {
    setLoading(true)
    if (selectedPokemon) {
      await fetch('/api/pokemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speciesId: selectedPokemon.id, name: selectedPokemon.name }),
      })
    }
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'completed' }),
    })
    router.push('/child')
  }

  const currentStep = STEPS[step]

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${currentStep.bg} transition-all duration-500`}>
      <motion.div
        className="bg-white rounded-3xl p-10 w-full max-w-xl shadow-2xl text-center"
        key={step}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i === step ? 'bg-indigo-500 w-8' : i < step ? 'bg-indigo-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="text-8xl mb-6">{currentStep.image}</div>

        <h1 className="game-label mb-4" style={{ fontSize: '2.5rem' }}>
          {currentStep.title}
        </h1>
        <p className="text-gray-500 mb-8" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
          {currentStep.description}
        </p>

        {/* Pokemon selection on step 1 */}
        {currentStep.showPokemon && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {STARTER_POKEMON.map(p => (
              <motion.button
                key={p.id}
                onClick={() => setSelectedPokemon(p)}
                className={`p-3 rounded-2xl border-2 transition-all ${
                  selectedPokemon?.id === p.id
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-white hover:border-yellow-200'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <img
                  src={HOME_SPRITE(p.id)}
                  alt={p.name}
                  width={70} height={70}
                  style={{ width: 70, height: 70, objectFit: 'contain', margin: '0 auto' }}
                />
                <p className="font-bold text-gray-800 mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                  {p.name}
                </p>
              </motion.button>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={handlePrev}
            disabled={step === 0}
            className="text-gray-400 hover:text-gray-600 font-bold disabled:opacity-30"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}
          >
            ← 上一步
          </button>

          {step === STEPS.length - 1 ? (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-8 py-4 rounded-2xl transition-all disabled:opacity-50"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', boxShadow: '0 5px 0 #3730a3' }}
            >
              {loading ? '准备中...' : '开始冒险！🚀'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-8 py-4 rounded-2xl transition-all"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', boxShadow: '0 5px 0 #3730a3' }}
            >
              下一步 →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

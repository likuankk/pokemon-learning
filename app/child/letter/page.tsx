'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

interface Letter {
  id: number; child_id: number; content: string; week_start: string
  read: number; created_at: string
}

export default function LetterPage() {
  const [letters, setLetters] = useState<Letter[]>([])
  const [selected, setSelected] = useState<Letter | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [pokemon, setPokemon] = useState<any>(null)

  const load = () => {
    Promise.all([
      fetch('/api/pokemon-letter').then(r => r.json()),
      fetch('/api/pokemon').then(r => r.json()),
    ]).then(([letterData, pokeData]) => {
      setLetters(letterData.letters || [])
      setPokemon(pokeData.pokemon)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    const res = await fetch('/api/pokemon-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (data.letter) {
      setLetters(prev => [data.letter, ...prev])
      setSelected(data.letter)
    }
    setGenerating(false)
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-teal-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="game-title-green leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#065f46' }}>宝可梦的信 💌</h1>
            <p className="text-emerald-500 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
              来自你的宝可梦伙伴的鼓励信！
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold px-6 py-3 rounded-2xl transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', boxShadow: '0 4px 0 #7e22ce' }}
          >
            {generating ? '写信中...' : '📮 收取新信'}
          </button>
        </div>
      </div>

      <div className="px-4 md:px-8 py-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : (
          <div className="flex gap-6">
            {/* Letter list */}
            <div className="w-96 flex-shrink-0 space-y-3">
              <h2 className="game-label mb-4" style={{ fontSize: '1.5rem' }}>收件箱 ({letters.length})</h2>
              {letters.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
                  <div className="text-6xl mb-3">📭</div>
                  <p className="text-gray-400 text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>还没有信件</p>
                  <p className="text-gray-400 mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>点击"收取新信"获取宝可梦的鼓励！</p>
                </div>
              ) : (
                letters.map(letter => (
                  <motion.button
                    key={letter.id}
                    onClick={() => setSelected(letter)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      selected?.id === letter.id
                        ? 'border-pink-400 bg-pink-50'
                        : 'border-gray-200 bg-white hover:border-pink-200'
                    }`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-center gap-3">
                      {pokemon && (
                        <img src={HOME_SPRITE(pokemon.species_id)} alt="" width={40} height={40}
                          style={{ width: 40, height: 40, objectFit: 'contain' }} />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                          来自{pokemon?.name || '宝可梦'}的信
                        </p>
                        <p className="text-gray-400 text-sm">{letter.week_start} 周报</p>
                      </div>
                      {!letter.read && <span className="w-3 h-3 bg-pink-400 rounded-full" />}
                    </div>
                  </motion.button>
                ))
              )}
            </div>

            {/* Letter content */}
            <div className="flex-1">
              {selected ? (
                <motion.div
                  key={selected.id}
                  className="bg-white rounded-3xl border-2 border-pink-200 p-8"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ boxShadow: '0 4px 0 rgba(236,72,153,0.2)' }}
                >
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-pink-100">
                    {pokemon && (
                      <img src={HOME_SPRITE(pokemon.species_id)} alt="" width={60} height={60}
                        style={{ width: 60, height: 60, objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }} />
                    )}
                    <div>
                      <p className="font-bold text-pink-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
                        来自{pokemon?.name || '宝可梦'}的信 💌
                      </p>
                      <p className="text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                        {selected.week_start} 周 · {selected.created_at.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                    {selected.content}
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-8xl mb-4 opacity-20">💌</div>
                  <p className="text-gray-400 text-2xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>从左侧选择一封信查看</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

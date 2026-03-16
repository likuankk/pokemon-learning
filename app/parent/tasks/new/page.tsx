'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { subjectColors } from '@/lib/game-logic'

const SUBJECTS = ['语文', '数学', '英语', '科学', '其他']

export default function NewTaskPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    subject: '数学',
    description: '',
    difficulty: 3,
    estimatedMinutes: 30,
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('请填写任务标题'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, familyId: 1, createdBy: 1 }),
      })
      if (res.ok) { router.push('/parent/tasks') }
      else { const d = await res.json(); setError(d.error || '创建失败'); setLoading(false) }
    } catch { setError('网络错误，请重试'); setLoading(false) }
  }

  const difficultyLabel = ['', '⭐ 简单', '⭐⭐ 较易', '⭐⭐⭐ 适中', '⭐⭐⭐⭐ 较难', '⭐⭐⭐⭐⭐ 困难'][form.difficulty]

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: '3.5rem', color: '#4338ca' }}>创建任务 ➕</h1>
        <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>为小明布置一个新的学习任务</p>
      </div>

      <div className="px-8 py-6">
        <div className="flex gap-8">
          {/* Form */}
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border-2 border-gray-200 p-8 space-y-7">

              <div>
                <label className="block text-2xl font-bold text-gray-700 mb-3">
                  任务标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="例如：完成数学练习册第15页"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-800 text-2xl focus:outline-none focus:ring-4 focus:ring-indigo-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-2xl font-bold text-gray-700 mb-3">科目</label>
                  <div className="flex gap-3 flex-wrap">
                    {SUBJECTS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, subject: s })}
                        className={`px-5 py-3 rounded-2xl text-xl font-bold border-2 transition-all ${
                          form.subject === s
                            ? 'bg-indigo-500 text-white border-indigo-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-2xl font-bold text-gray-700 mb-3">预计时长</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[15, 20, 30, 45, 60, 90].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm({ ...form, estimatedMinutes: m })}
                        className={`py-3 rounded-xl text-xl font-bold border-2 transition-all ${
                          form.estimatedMinutes === m
                            ? 'bg-indigo-500 text-white border-indigo-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {m}分
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-2xl font-bold text-gray-700 mb-3">任务说明</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="具体要求、注意事项..."
                  rows={3}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-800 text-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-2xl font-bold text-gray-700 mb-3">
                    难度：{difficultyLabel}
                  </label>
                  <input
                    type="range" min={1} max={5}
                    value={form.difficulty}
                    onChange={e => setForm({ ...form, difficulty: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500 h-4"
                  />
                  <div className="flex justify-between text-lg text-gray-400 mt-2 font-semibold">
                    <span>简单</span><span>困难</span>
                  </div>
                </div>

                <div>
                  <label className="block text-2xl font-bold text-gray-700 mb-3">截止日期</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-800 text-xl focus:outline-none focus:ring-4 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-xl bg-red-50 rounded-xl px-5 py-3 font-semibold">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-5 rounded-2xl transition-colors disabled:opacity-50 text-2xl"
              >
                {loading ? '发布中...' : '发布任务 🚀'}
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="w-96 flex-shrink-0">
            <h2 className="text-2xl font-bold text-gray-500 uppercase tracking-widest mb-4">实时预览</h2>
            <motion.div className="bg-white rounded-3xl border-2 border-gray-200 p-6 sticky top-8" layout>
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="font-bold text-gray-800 flex-1 text-2xl leading-snug">
                  {form.title || <span className="text-gray-300">任务标题...</span>}
                </h3>
                <span className={`text-base px-3 py-1.5 rounded-full border-2 font-bold flex-shrink-0 ${subjectColors[form.subject] || subjectColors['其他']}`}>
                  {form.subject}
                </span>
              </div>

              {form.description && (
                <p className="text-lg text-gray-500 mb-4">{form.description}</p>
              )}

              <div className="flex items-center gap-3 text-xl text-gray-400 mb-5 flex-wrap">
                <span>{'⭐'.repeat(form.difficulty)}</span>
                <span>⏱ {form.estimatedMinutes}分钟</span>
                <span>📅 {form.dueDate}</span>
              </div>

              <div className="bg-indigo-50 rounded-2xl p-4">
                <p className="text-lg text-indigo-600 font-bold mb-3">完成奖励预估（满分）</p>
                <div className="flex gap-4 text-xl text-gray-600 font-semibold">
                  <span>🍖 食物×3</span>
                  <span>💎 结晶×2</span>
                  <span>⭐ 糖×2</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

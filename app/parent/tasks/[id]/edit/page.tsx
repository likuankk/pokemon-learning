'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { subjectColors } from '@/lib/game-logic'

const SUBJECTS = ['语文', '数学', '英语', '科学', '其他']

export default function EditTaskPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [form, setForm] = useState({
    title: '', subject: '数学', description: '',
    difficulty: 3, estimatedMinutes: 30, dueDate: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then(r => r.json())
      .then(d => {
        if (d.task) {
          setForm({
            title: d.task.title,
            subject: d.task.subject,
            description: d.task.description || '',
            difficulty: d.task.difficulty,
            estimatedMinutes: d.task.estimated_minutes,
            dueDate: d.task.due_date,
          })
        }
        setLoading(false)
      })
  }, [taskId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('请填写任务标题'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          subject: form.subject,
          description: form.description,
          difficulty: form.difficulty,
          estimatedMinutes: form.estimatedMinutes,
          dueDate: form.dueDate,
        }),
      })
      if (res.ok) {
        router.push(`/parent/tasks/${taskId}`)
      } else {
        const d = await res.json()
        setError(d.error || '保存失败')
        setSaving(false)
      }
    } catch {
      setError('网络错误，请重试')
      setSaving(false)
    }
  }

  const difficultyLabel = ['', '⭐ 简单', '⭐⭐ 较易', '⭐⭐⭐ 适中', '⭐⭐⭐⭐ 较难', '⭐⭐⭐⭐⭐ 困难'][form.difficulty]

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-gray-400 text-3xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <Link href={`/parent/tasks/${taskId}`} className="text-indigo-400 hover:text-indigo-600 font-bold mb-2 flex items-center gap-2"
          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
          ← 返回任务详情
        </Link>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#4338ca' }}>编辑任务 ✏️</h1>
      </div>

      <div className="px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* Form */}
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border-2 border-gray-200 p-8 space-y-7"
              style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.05)' }}>

              <div>
                <label className="block font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
                  任务标题 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="例如：完成数学练习册第15页"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-300"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>科目</label>
                  <div className="flex gap-3 flex-wrap">
                    {SUBJECTS.map(s => (
                      <button key={s} type="button" onClick={() => setForm({ ...form, subject: s })}
                        className="px-5 py-3 rounded-2xl font-bold border-2 transition-all"
                        style={{
                          fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem',
                          ...(form.subject === s
                            ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderColor: '#4f46e5', boxShadow: '0 3px 0 #3730a3' }
                            : { background: '#fff', color: '#4b5563', borderColor: '#e5e7eb' })
                        }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>预计时长</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[15, 20, 30, 45, 60, 90].map(m => (
                      <button key={m} type="button" onClick={() => setForm({ ...form, estimatedMinutes: m })}
                        className="py-3 rounded-xl font-bold border-2 transition-all"
                        style={{
                          fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem',
                          ...(form.estimatedMinutes === m
                            ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderColor: '#4f46e5', boxShadow: '0 3px 0 #3730a3' }
                            : { background: '#fff', color: '#4b5563', borderColor: '#e5e7eb' })
                        }}>
                        {m}分
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>任务说明</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="具体要求、注意事项..." rows={3}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-300 resize-none"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
                    难度：{difficultyLabel}
                  </label>
                  <input type="range" min={1} max={5} value={form.difficulty}
                    onChange={e => setForm({ ...form, difficulty: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500 h-4" />
                  <div className="flex justify-between mt-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem', color: '#9ca3af' }}>
                    <span>简单</span><span>困难</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>截止日期</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-300"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 bg-red-50 rounded-xl px-5 py-3 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>{error}</p>}

              <button type="submit" disabled={saving}
                className="w-full text-white font-bold py-5 rounded-2xl transition-all disabled:opacity-50"
                style={{
                  fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  boxShadow: '0 5px 0 #3730a3',
                }}>
                {saving ? '保存中...' : '保存修改 ✓'}
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="w-96 flex-shrink-0">
            <h2 className="font-bold mb-4 uppercase tracking-widest"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.4rem', color: '#6b7280' }}>实时预览</h2>
            <motion.div className="bg-white rounded-3xl border-2 border-gray-200 p-6 sticky top-8"
              style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.05)' }} layout>
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="game-label flex-1 leading-snug" style={{ fontSize: '1.5rem' }}>
                  {form.title || <span className="text-gray-300">任务标题...</span>}
                </h3>
                <span className={`text-base px-3 py-1.5 rounded-full border-2 font-bold flex-shrink-0 ${subjectColors[form.subject] || subjectColors['其他']}`}
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  {form.subject}
                </span>
              </div>
              {form.description && <p className="text-gray-500 mb-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>{form.description}</p>}
              <div className="flex items-center gap-3 text-gray-400 mb-5 flex-wrap font-bold"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
                <span>{'⭐'.repeat(form.difficulty)}</span>
                <span>⏱ {form.estimatedMinutes}分钟</span>
                <span>📅 {form.dueDate}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

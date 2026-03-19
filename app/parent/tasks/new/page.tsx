'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { subjectColors } from '@/lib/game-logic'

const SUBJECTS = ['语文', '数学', '英语', '科学', '其他']

interface Template {
  id: number
  familyId: number
  title: string
  subject: string
  description: string
  difficulty: number
  estimatedMinutes: number
  isBuiltin: boolean
  sortOrder: number
}

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
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateFilter, setTemplateFilter] = useState<string>('全部')
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch {
      // ignore
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('请填写任务标题'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      if (res.ok) { router.push('/parent/tasks') }
      else { const d = await res.json(); setError(d.error || '创建失败'); setLoading(false) }
    } catch { setError('网络错误，请重试'); setLoading(false) }
  }

  const applyTemplate = (t: Template) => {
    setForm(f => ({ ...f, title: t.title, subject: t.subject, description: t.description, difficulty: t.difficulty, estimatedMinutes: t.estimatedMinutes }))
    setShowTemplates(false)
  }

  const handleSaveAsTemplate = async () => {
    if (!form.title.trim()) { setError('请先填写标题再保存模板'); return }
    setSavingTemplate(true); setError('')
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          subject: form.subject,
          description: form.description,
          difficulty: form.difficulty,
          estimatedMinutes: form.estimatedMinutes,
        }),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
        loadTemplates()
      } else {
        const d = await res.json()
        setError(d.error || '保存模板失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSavingTemplate(false)
    }
  }

  const customTemplates = templates.filter(t => !t.isBuiltin)
  const builtinTemplates = templates.filter(t => t.isBuiltin)
  const filterTemplates = (list: Template[]) =>
    templateFilter === '全部' ? list : list.filter(t => t.subject === templateFilter)

  const difficultyLabel = ['', '⭐ 简单', '⭐⭐ 较易', '⭐⭐⭐ 适中', '⭐⭐⭐⭐ 较难', '⭐⭐⭐⭐⭐ 困难'][form.difficulty]

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#4338ca' }}>创建任务 ➕</h1>
            <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>为孩子布置一个新的学习任务</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/parent/templates')}
              className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-600 font-bold px-5 py-3 rounded-2xl transition-all flex items-center gap-2"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}
            >
              ⚙️ 管理模板
            </button>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="bg-white border-2 border-indigo-300 hover:border-indigo-500 text-indigo-600 font-bold px-6 py-3 rounded-2xl transition-all flex items-center gap-2"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}
            >
              📚 使用模板
            </button>
          </div>
        </div>
      </div>

      {/* Template panel */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            className="border-b-4 border-indigo-100 bg-indigo-50 px-4 md:px-8 py-5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="font-bold text-indigo-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>按科目筛选：</span>
              {['全部', ...SUBJECTS].map(s => (
                <button key={s} onClick={() => setTemplateFilter(s)}
                  className={`px-4 py-2 rounded-xl font-bold border-2 transition-all text-base ${
                    templateFilter === s ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  {s}
                </button>
              ))}
            </div>

            {templatesLoading ? (
              <div className="text-center py-8 text-indigo-400 font-bold text-xl">加载模板中...</div>
            ) : (
              <>
                {/* Custom templates section */}
                {customTemplates.length > 0 && (
                  <div className="mb-5">
                    <h3 className="font-bold text-purple-600 mb-3 flex items-center gap-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                      ⭐ 我的模板
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {filterTemplates(customTemplates).map(t => (
                        <TemplateCard key={t.id} template={t} onApply={applyTemplate} isCustom />
                      ))}
                    </div>
                    {filterTemplates(customTemplates).length === 0 && (
                      <p className="text-gray-400 text-center py-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>该科目下没有自定义模板</p>
                    )}
                  </div>
                )}

                {/* Builtin templates section */}
                <div>
                  <h3 className="font-bold text-indigo-600 mb-3 flex items-center gap-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                    📚 系统模板
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {filterTemplates(builtinTemplates).map(t => (
                      <TemplateCard key={t.id} template={t} onApply={applyTemplate} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 md:px-8 py-6">
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-5 rounded-2xl transition-colors disabled:opacity-50 text-2xl"
                >
                  {loading ? '发布中...' : '发布任务 🚀'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  disabled={savingTemplate}
                  className={`px-8 py-5 rounded-2xl font-bold text-xl border-2 transition-all ${
                    saveSuccess
                      ? 'bg-green-100 border-green-400 text-green-600'
                      : 'bg-purple-50 border-purple-300 hover:border-purple-500 text-purple-600'
                  }`}
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                >
                  {saveSuccess ? '✅ 已保存' : savingTemplate ? '保存中...' : '💾 存为模板'}
                </button>
              </div>
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

function TemplateCard({ template: t, onApply, isCustom }: { template: Template; onApply: (t: Template) => void; isCustom?: boolean }) {
  return (
    <motion.button
      onClick={() => onApply(t)}
      className="text-left bg-white border-2 border-indigo-100 hover:border-indigo-400 rounded-2xl p-4 transition-all"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-gray-800 flex-1 leading-snug" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>{t.title}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isCustom && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-500 border border-purple-200 font-bold">自定义</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${subjectColors[t.subject] || subjectColors['其他']}`}>
            {t.subject}
          </span>
        </div>
      </div>
      <p className="text-gray-400 text-sm leading-snug" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{t.description?.slice(0, 25)}...</p>
      <div className="flex gap-2 mt-2 text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.875rem' }}>
        <span>{'⭐'.repeat(t.difficulty)}</span>
        <span>⏱{t.estimatedMinutes}分</span>
      </div>
    </motion.button>
  )
}

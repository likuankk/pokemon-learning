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

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<string>('全部')

  // Form state for add/edit
  const [form, setForm] = useState({
    title: '', subject: '语文', description: '', difficulty: 3, estimatedMinutes: 30,
  })
  const [saving, setSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const resetForm = () => {
    setForm({ title: '', subject: '语文', description: '', difficulty: 3, estimatedMinutes: 30 })
  }

  const handleAdd = async () => {
    if (!form.title.trim()) { setError('请填写标题'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowAddForm(false)
        resetForm()
        loadTemplates()
      } else {
        const d = await res.json()
        setError(d.error || '创建失败')
      }
    } catch { setError('网络错误') }
    finally { setSaving(false) }
  }

  const handleEdit = async (id: number) => {
    if (!form.title.trim()) { setError('请填写标题'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setEditingId(null)
        resetForm()
        loadTemplates()
      } else {
        const d = await res.json()
        setError(d.error || '更新失败')
      }
    } catch { setError('网络错误') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`确定删除模板「${title}」？`)) return
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadTemplates()
      } else {
        const d = await res.json()
        setError(d.error || '删除失败')
      }
    } catch { setError('网络错误') }
  }

  const startEdit = (t: Template) => {
    setEditingId(t.id)
    setForm({
      title: t.title,
      subject: t.subject,
      description: t.description,
      difficulty: t.difficulty,
      estimatedMinutes: t.estimatedMinutes,
    })
    setShowAddForm(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  const customTemplates = templates.filter(t => !t.isBuiltin)
  const builtinTemplates = templates.filter(t => t.isBuiltin)
  const filterList = (list: Template[]) =>
    filter === '全部' ? list : list.filter(t => t.subject === filter)

  const difficultyLabel = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐']

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <p className="text-2xl text-gray-400 font-bold">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b-4 border-purple-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#7c3aed', fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              模板管理 📋
            </h1>
            <p className="text-purple-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
              管理你的自定义任务模板
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); resetForm() }}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-6 py-3 rounded-2xl transition-all flex items-center gap-2"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}
            >
              ➕ 新增模板
            </button>
            <button
              onClick={() => router.push('/parent/tasks/new')}
              className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-600 font-bold px-5 py-3 rounded-2xl transition-all"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}
            >
              ← 返回创建任务
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 md:px-8 pt-5 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-gray-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}>筛选科目：</span>
          {['全部', ...SUBJECTS].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl font-bold border-2 transition-all text-base ${
                filter === s ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
              }`}
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 md:mx-8 mt-3">
          <p className="text-red-500 text-xl bg-red-50 rounded-xl px-5 py-3 font-semibold">{error}</p>
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            className="mx-4 md:mx-8 mt-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TemplateForm
              form={form}
              setForm={setForm}
              onSave={handleAdd}
              onCancel={() => { setShowAddForm(false); resetForm() }}
              saving={saving}
              title="新增自定义模板"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 md:px-8 py-5 space-y-8">
        {/* Custom templates */}
        <section>
          <h2 className="text-2xl font-bold text-purple-600 mb-4 flex items-center gap-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
            ⭐ 我的模板 <span className="text-lg text-purple-400">({customTemplates.length})</span>
          </h2>
          {customTemplates.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-8 text-center">
              <p className="text-gray-400 text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                还没有自定义模板，点击上方「新增模板」创建
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterList(customTemplates).map(t => (
                <div key={t.id}>
                  {editingId === t.id ? (
                    <TemplateForm
                      form={form}
                      setForm={setForm}
                      onSave={() => handleEdit(t.id)}
                      onCancel={cancelEdit}
                      saving={saving}
                      title="编辑模板"
                    />
                  ) : (
                    <TemplateCard
                      template={t}
                      onEdit={() => startEdit(t)}
                      onDelete={() => handleDelete(t.id, t.title)}
                      difficultyLabel={difficultyLabel}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Builtin templates */}
        <section>
          <h2 className="text-2xl font-bold text-indigo-600 mb-4 flex items-center gap-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
            📚 系统模板 <span className="text-lg text-indigo-400">({builtinTemplates.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterList(builtinTemplates).map(t => (
              <TemplateCard key={t.id} template={t} readOnly difficultyLabel={difficultyLabel} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function TemplateCard({ template: t, onEdit, onDelete, readOnly, difficultyLabel }: {
  template: Template
  onEdit?: () => void
  onDelete?: () => void
  readOnly?: boolean
  difficultyLabel: string[]
}) {
  return (
    <motion.div
      className={`bg-white rounded-2xl border-2 p-5 ${readOnly ? 'border-gray-100' : 'border-purple-100'}`}
      whileHover={{ scale: 1.01 }}
      layout
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-bold text-gray-800 flex-1 text-xl leading-snug" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
          {t.title}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {readOnly && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200 font-bold">系统</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${subjectColors[t.subject] || subjectColors['其他']}`}>
            {t.subject}
          </span>
        </div>
      </div>

      {t.description && (
        <p className="text-gray-500 text-base mb-3 leading-relaxed" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
          {t.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-gray-400 text-base" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
          <span>{difficultyLabel[t.difficulty]}</span>
          <span>⏱ {t.estimatedMinutes}分</span>
        </div>

        {!readOnly && (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 rounded-xl text-sm font-bold border-2 border-blue-200 text-blue-500 hover:bg-blue-50 transition-all"
            >
              ✏️ 编辑
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 rounded-xl text-sm font-bold border-2 border-red-200 text-red-400 hover:bg-red-50 transition-all"
            >
              🗑️ 删除
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function TemplateForm({ form, setForm, onSave, onCancel, saving, title }: {
  form: { title: string; subject: string; description: string; difficulty: number; estimatedMinutes: number }
  setForm: (fn: (prev: any) => any) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  title: string
}) {
  return (
    <div className="bg-white rounded-2xl border-2 border-purple-200 p-5">
      <h3 className="font-bold text-purple-600 text-xl mb-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{title}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-lg font-bold text-gray-600 mb-1">标题 *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
            placeholder="模板标题"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-lg focus:outline-none focus:ring-3 focus:ring-purple-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-lg font-bold text-gray-600 mb-1">科目</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((f: any) => ({ ...f, subject: s }))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${
                    form.subject === s ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-lg font-bold text-gray-600 mb-1">预计时长</label>
            <div className="flex gap-2 flex-wrap">
              {[15, 20, 30, 45, 60].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((f: any) => ({ ...f, estimatedMinutes: m }))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${
                    form.estimatedMinutes === m ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  {m}分
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-lg font-bold text-gray-600 mb-1">说明</label>
          <textarea
            value={form.description}
            onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
            placeholder="任务详细说明..."
            rows={2}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-3 focus:ring-purple-300 resize-none"
          />
        </div>

        <div>
          <label className="block text-lg font-bold text-gray-600 mb-1">
            难度：{'⭐'.repeat(form.difficulty)}
          </label>
          <input
            type="range" min={1} max={5}
            value={form.difficulty}
            onChange={e => setForm((f: any) => ({ ...f, difficulty: parseInt(e.target.value) }))}
            className="w-full accent-purple-500 h-3"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 text-lg"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
          >
            {saving ? '保存中...' : '💾 保存'}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-xl font-bold text-lg border-2 border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

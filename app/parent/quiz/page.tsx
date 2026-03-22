'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SUBJECTS = ['数学', '语文', '英语', '科学']
const DIFFICULTIES = [
  { value: 1, label: '简单', emoji: '🌱', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 2, label: '中等', emoji: '🌿', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 3, label: '困难', emoji: '🔥', color: 'bg-red-100 text-red-700 border-red-300' },
]
const OPTION_LABELS = ['A', 'B', 'C', 'D']

const AI_GENERATE_EXAMPLES = [
  '生成 10 道三年级数学加减法题目，简单难度',
  '出 5 道关于唐诗的语文题，适合四年级',
  '生成 8 道英语单词拼写题，动物主题，难度中等',
  '出 5 道科学常识题，关于太阳系的行星',
  '读取这个网页的题目并导入：粘贴网页链接即可',
]

const AI_BATCH_EXAMPLES = [
  '把所有数学题的答题时间改为 15 秒',
  '删除所有难度为简单的英语题',
  '把科学分类下"物理"的题目难度全部改为困难',
  '将所有没有分类的题目分类设为"综合"',
  '把年级范围是 1-2 年级的所有题目删除',
]

interface QuizQuestion {
  id: number
  subject: string
  gradeMin: number
  gradeMax: number
  difficulty: number
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctIndex: number
  timeLimit: number
  category: string
}

interface FormState {
  subject: string
  gradeMin: number
  gradeMax: number
  difficulty: number
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctIndex: number
  timeLimit: number
  category: string
}

interface AiBatchOperation {
  type: 'delete' | 'update'
  description: string
  filter: Record<string, any>
  changes?: Record<string, any>
  affectedCount?: number
}

const emptyForm: FormState = {
  subject: '数学',
  gradeMin: 3,
  gradeMax: 6,
  difficulty: 1,
  question: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctIndex: -1,
  timeLimit: 10,
  category: '',
}

export default function QuizManagePage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterSubject, setFilterSubject] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [searchText, setSearchText] = useState('')
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Expanded question detail
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // AI panel state
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiMode, setAiMode] = useState<'generate' | 'batch'>('generate')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [aiStatus, setAiStatus] = useState('')
  const [aiWorking, setAiWorking] = useState(false)
  const [aiResult, setAiResult] = useState<{
    questions?: QuizQuestion[]
    totalGenerated?: number
    totalSaved?: number
    errors?: string[]
    searchUsed?: boolean
    searchCount?: number
    fetchUsed?: boolean
    fetchCount?: number
  } | null>(null)
  const [aiBatchPlan, setAiBatchPlan] = useState<{
    operations: AiBatchOperation[]
    summary: string
    warning: string
  } | null>(null)
  const [aiBatchExecuting, setAiBatchExecuting] = useState(false)
  const [aiEnableSearch, setAiEnableSearch] = useState(true)
  const [aiBatchResult, setAiBatchResult] = useState<{
    results: { description: string; affected: number; success: boolean; error?: string }[]
    totalAffected: number
  } | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (filterSubject) params.set('subject', filterSubject)
      if (filterDifficulty) params.set('difficulty', filterDifficulty)
      if (filterCategory) params.set('category', filterCategory)
      if (searchText) params.set('search', searchText)

      const res = await fetch(`/api/quiz/manage?${params}`)
      if (res.ok) {
        const data = await res.json()
        setQuestions(data.questions)
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setAvailableSubjects(data.filters.subjects)
        setAvailableCategories(data.filters.categories)
      }
    } catch (e) {
      console.error('Failed to load questions:', e)
    }
    setLoading(false)
  }, [page, filterSubject, filterDifficulty, filterCategory, searchText])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filterSubject, filterDifficulty, filterCategory, searchText])

  const openAddForm = () => {
    setForm({ ...emptyForm })
    setEditingId(null)
    setFormError('')
    setShowForm(true)
  }

  const openEditForm = (q: QuizQuestion) => {
    setForm({
      subject: q.subject,
      gradeMin: q.gradeMin,
      gradeMax: q.gradeMax,
      difficulty: q.difficulty,
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctIndex: q.correctIndex,
      timeLimit: q.timeLimit,
      category: q.category,
    })
    setEditingId(q.id)
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.question.trim()) { setFormError('请填写题目内容'); return }
    if (!form.optionA.trim() || !form.optionB.trim() || !form.optionC.trim() || !form.optionD.trim()) {
      setFormError('请填写所有四个选项'); return
    }
    if (form.correctIndex < 0 || form.correctIndex > 3) { setFormError('请选择正确答案'); return }

    setSaving(true)
    try {
      const url = editingId ? `/api/quiz/manage/${editingId}` : '/api/quiz/manage'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        loadQuestions()
      } else {
        const data = await res.json()
        setFormError(data.error || '保存失败')
      }
    } catch {
      setFormError('网络错误，请重试')
    }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/quiz/manage/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingId(null)
        loadQuestions()
      }
    } catch {
      console.error('Delete failed')
    }
  }

  // === AI Generate ===
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiWorking) return
    setAiWorking(true)
    setAiStatus('🤔 AI 正在思考中...')
    setAiResult(null)

    if (aiAbortRef.current) aiAbortRef.current.abort()
    const abortController = new AbortController()
    aiAbortRef.current = abortController

    try {
      const res = await fetch('/api/quiz/manage/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim(), count: aiCount, enableSearch: aiEnableSearch }),
        signal: abortController.signal,
      })

      if (!res.ok || !res.body) {
        setAiStatus('❌ 请求失败，请重试')
        setAiWorking(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (abortController.signal.aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'status') {
              setAiStatus(parsed.message)
            } else if (parsed.type === 'result') {
              setAiResult({
                questions: parsed.questions,
                totalGenerated: parsed.totalGenerated,
                totalSaved: parsed.totalSaved,
                errors: parsed.errors,
                searchUsed: parsed.searchUsed,
                searchCount: parsed.searchCount,
                fetchUsed: parsed.fetchUsed,
                fetchCount: parsed.fetchCount,
              })
              const searchInfo = parsed.searchUsed ? `（联网搜索了 ${parsed.searchCount} 次）` : ''
              const fetchInfo = parsed.fetchUsed ? `（读取了 ${parsed.fetchCount} 个网页）` : ''
              setAiStatus(`✅ 成功生成 ${parsed.totalSaved} 道题目！${fetchInfo}${searchInfo}`)
              loadQuestions()
            } else if (parsed.type === 'error') {
              setAiStatus(`❌ ${parsed.message}`)
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setAiStatus('❌ 网络错误，请重试')
      }
    }
    setAiWorking(false)
  }

  // === AI Batch ===
  const handleAiBatch = async () => {
    if (!aiPrompt.trim() || aiWorking) return
    setAiWorking(true)
    setAiStatus('🤔 AI 正在分析指令...')
    setAiBatchPlan(null)
    setAiBatchResult(null)

    if (aiAbortRef.current) aiAbortRef.current.abort()
    const abortController = new AbortController()
    aiAbortRef.current = abortController

    try {
      const res = await fetch('/api/quiz/manage/ai-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: aiPrompt.trim() }),
        signal: abortController.signal,
      })

      if (!res.ok || !res.body) {
        setAiStatus('❌ 请求失败，请重试')
        setAiWorking(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (abortController.signal.aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'status') {
              setAiStatus(parsed.message)
            } else if (parsed.type === 'plan') {
              setAiBatchPlan({
                operations: parsed.operations,
                summary: parsed.summary,
                warning: parsed.warning,
              })
              if (parsed.operations.length === 0) {
                setAiStatus(`ℹ️ ${parsed.summary || 'AI 无法理解该指令'}`)
              } else {
                setAiStatus('📋 操作计划已生成，请确认执行')
              }
            } else if (parsed.type === 'error') {
              setAiStatus(`❌ ${parsed.message}`)
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setAiStatus('❌ 网络错误，请重试')
      }
    }
    setAiWorking(false)
  }

  const handleExecuteBatch = async () => {
    if (!aiBatchPlan || aiBatchExecuting) return
    setAiBatchExecuting(true)
    setAiStatus('⚡ 正在执行操作...')

    try {
      const res = await fetch('/api/quiz/manage/ai-batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: aiBatchPlan.operations }),
      })

      if (res.ok) {
        const data = await res.json()
        setAiBatchResult(data)
        setAiStatus(`✅ 操作完成，共影响 ${data.totalAffected} 道题目`)
        setAiBatchPlan(null)
        loadQuestions()
      } else {
        const data = await res.json()
        setAiStatus(`❌ ${data.error || '执行失败'}`)
      }
    } catch {
      setAiStatus('❌ 网络错误，请重试')
    }
    setAiBatchExecuting(false)
  }

  const handleAiCancel = () => {
    if (aiAbortRef.current) {
      aiAbortRef.current.abort()
      aiAbortRef.current = null
    }
    setAiWorking(false)
    setAiStatus('')
  }

  const resetAiPanel = () => {
    handleAiCancel()
    setAiPrompt('')
    setAiResult(null)
    setAiBatchPlan(null)
    setAiBatchResult(null)
    setAiStatus('')
  }

  const getDifficultyInfo = (d: number) => DIFFICULTIES.find(x => x.value === d) || DIFFICULTIES[0]

  const subjectEmojiMap: Record<string, string> = { '数学': '🔢', '语文': '📖', '英语': '🌍', '科学': '🔬' }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b-4 border-purple-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#7c3aed', fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              📝 题库管理
            </h1>
            <p className="text-purple-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
              共 {total} 道题目
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => { setShowAiPanel(true); resetAiPanel() }}
              className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', boxShadow: '0 4px 0 #c2410c' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95, y: 2 }}
            >
              🤖 AI 助手
            </motion.button>
            <motion.button
              onClick={openAddForm}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', boxShadow: '0 4px 0 #4338ca' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95, y: 2 }}
            >
              ➕ 添加题目
            </motion.button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 搜索题目..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-3 focus:ring-purple-200 focus:border-purple-400"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
              />
            </div>
            {/* Subject filter */}
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-3 focus:ring-purple-200 bg-white"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
            >
              <option value="">全部学科</option>
              {availableSubjects.map(s => (
                <option key={s} value={s}>{subjectEmojiMap[s] || '📚'} {s}</option>
              ))}
            </select>
            {/* Difficulty filter */}
            <select
              value={filterDifficulty}
              onChange={e => setFilterDifficulty(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-3 focus:ring-purple-200 bg-white"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
            >
              <option value="">全部难度</option>
              {DIFFICULTIES.map(d => (
                <option key={d.value} value={d.value}>{d.emoji} {d.label}</option>
              ))}
            </select>
            {/* Category filter */}
            {availableCategories.length > 0 && (
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-3 focus:ring-purple-200 bg-white"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
              >
                <option value="">全部分类</option>
                {availableCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 animate-bounce">📝</div>
            <p className="text-gray-400 text-xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-gray-100">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400 text-xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>没有找到题目</p>
            <button onClick={openAddForm} className="text-purple-500 text-lg mt-3 hover:underline font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              添加第一道题目 →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const diffInfo = getDifficultyInfo(q.difficulty)
              const isExpanded = expandedId === q.id
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Question header */}
                  <div
                    className="px-5 py-4 cursor-pointer flex items-start gap-4"
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-3xl">{subjectEmojiMap[q.subject] || '📚'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-bold text-lg leading-snug line-clamp-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                        {q.question}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="bg-purple-50 text-purple-600 px-2.5 py-0.5 rounded-lg text-sm font-bold">{q.subject}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-sm font-bold border ${diffInfo.color}`}>
                          {diffInfo.emoji} {diffInfo.label}
                        </span>
                        {q.category && (
                          <span className="bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-lg text-sm font-bold">{q.category}</span>
                        )}
                        <span className="text-gray-300 text-sm">年级 {q.gradeMin}-{q.gradeMax} | {q.timeLimit}秒</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); openEditForm(q) }}
                        className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl hover:bg-blue-100 transition-colors"
                        whileTap={{ scale: 0.9 }}
                        title="编辑"
                      >✏️</motion.button>
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(q.id) }}
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-xl hover:bg-red-100 transition-colors"
                        whileTap={{ scale: 0.9 }}
                        title="删除"
                      >🗑️</motion.button>
                      <span className={`text-gray-300 text-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 border-t border-gray-100 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[q.optionA, q.optionB, q.optionC, q.optionD].map((opt, i) => (
                              <div
                                key={i}
                                className={`px-4 py-3 rounded-xl border-2 font-bold flex items-center gap-3 ${
                                  i === q.correctIndex
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-600'
                                }`}
                                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
                              >
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  i === q.correctIndex
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-500'
                                }`}>
                                  {OPTION_LABELS[i]}
                                </span>
                                <span>{opt}</span>
                                {i === q.correctIndex && <span className="ml-auto text-green-500">✓ 正确</span>}
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-sm text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            <span>🆔 ID: {q.id}</span>
                            <span>⏱ 答题限时: {q.timeLimit}秒</span>
                            <span>📊 年级范围: {q.gradeMin}-{q.gradeMax}年级</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <motion.button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-5 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-300 transition-colors"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
              whileTap={{ scale: 0.95 }}
            >
              ← 上一页
            </motion.button>
            <span className="text-gray-500 font-bold px-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
              {page} / {totalPages}
            </span>
            <motion.button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-5 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-300 transition-colors"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
              whileTap={{ scale: 0.95 }}
            >
              下一页 →
            </motion.button>
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="px-6 py-5 border-b-2 border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {editingId ? '✏️ 编辑题目' : '➕ 添加新题目'}
                  </h2>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {formError && (
                    <div className="bg-red-50 border-2 border-red-200 text-red-600 rounded-xl px-4 py-3 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      ⚠️ {formError}
                    </div>
                  )}

                  {/* Subject & Difficulty row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>学科</label>
                      <div className="flex flex-wrap gap-2">
                        {SUBJECTS.map(s => (
                          <button
                            key={s}
                            onClick={() => setForm(f => ({ ...f, subject: s }))}
                            className={`px-4 py-2 rounded-xl border-2 font-bold transition-all ${
                              form.subject === s
                                ? 'bg-purple-500 text-white border-purple-500'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                            }`}
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                          >
                            {subjectEmojiMap[s] || '📚'} {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>难度</label>
                      <div className="flex gap-2">
                        {DIFFICULTIES.map(d => (
                          <button
                            key={d.value}
                            onClick={() => setForm(f => ({ ...f, difficulty: d.value }))}
                            className={`px-4 py-2 rounded-xl border-2 font-bold transition-all ${
                              form.difficulty === d.value
                                ? 'bg-purple-500 text-white border-purple-500'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                            }`}
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                          >
                            {d.emoji} {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Grade range & Time limit & Category */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>年级范围</label>
                      <div className="flex items-center gap-2">
                        <select
                          value={form.gradeMin}
                          onChange={e => setForm(f => ({ ...f, gradeMin: parseInt(e.target.value) }))}
                          className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 bg-white"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                        >
                          {[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}年级</option>)}
                        </select>
                        <span className="text-gray-400">~</span>
                        <select
                          value={form.gradeMax}
                          onChange={e => setForm(f => ({ ...f, gradeMax: parseInt(e.target.value) }))}
                          className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 bg-white"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                        >
                          {[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}年级</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>答题限时</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={5}
                          max={60}
                          value={form.timeLimit}
                          onChange={e => setForm(f => ({ ...f, timeLimit: parseInt(e.target.value) || 10 }))}
                          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                        />
                        <span className="text-gray-400 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>秒</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>分类（可选）</label>
                      <input
                        type="text"
                        placeholder="如：加减法、诗词..."
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2"
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                      />
                    </div>
                  </div>

                  {/* Question text */}
                  <div>
                    <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>题目内容</label>
                    <textarea
                      rows={3}
                      placeholder="请输入题目内容..."
                      value={form.question}
                      onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-3 focus:ring-purple-200 focus:border-purple-400"
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
                    />
                  </div>

                  {/* Options */}
                  <div>
                    <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>
                      选项 <span className="text-purple-400 text-sm">（点击圆圈标记正确答案）</span>
                    </label>
                    <div className="space-y-3">
                      {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((key, i) => (
                        <div key={key} className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, correctIndex: i }))}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all flex-shrink-0 ${
                              form.correctIndex === i
                                ? 'bg-green-500 text-white border-green-500 shadow-lg'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-green-300'
                            }`}
                          >
                            {OPTION_LABELS[i]}
                          </button>
                          <input
                            type="text"
                            placeholder={`选项 ${OPTION_LABELS[i]}`}
                            value={form[key]}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            className={`flex-1 border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-3 focus:ring-purple-200 transition-colors ${
                              form.correctIndex === i
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200'
                            }`}
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
                          />
                          {form.correctIndex === i && (
                            <span className="text-green-500 font-bold text-sm flex-shrink-0" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>✓ 正确答案</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Form actions */}
                <div className="px-6 py-4 border-t-2 border-gray-100 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
                  >
                    取消
                  </button>
                  <motion.button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold disabled:opacity-50 transition-all"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem', boxShadow: '0 3px 0 #4338ca' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97, y: 2 }}
                  >
                    {saving ? '保存中...' : (editingId ? '💾 保存修改' : '✅ 添加题目')}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId !== null && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="text-5xl mb-4">🗑️</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>确认删除？</h3>
                <p className="text-gray-400 mb-6" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>删除后无法恢复，请确认</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-6 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  >
                    取消
                  </button>
                  <motion.button
                    onClick={() => handleDelete(deletingId)}
                    className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-bold"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", boxShadow: '0 3px 0 #991b1b' }}
                    whileTap={{ scale: 0.95, y: 2 }}
                  >
                    🗑️ 确认删除
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* AI Assistant Panel */}
      <AnimatePresence>
        {showAiPanel && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!aiWorking) setShowAiPanel(false) }}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 py-5 border-b-2 border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      🤖 AI 题库助手
                    </h2>
                    {!aiWorking && (
                      <button onClick={() => setShowAiPanel(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                    )}
                  </div>

                  {/* Mode tabs */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setAiMode('generate'); resetAiPanel() }}
                      className={`px-5 py-2.5 rounded-xl font-bold transition-all ${
                        aiMode === 'generate'
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
                    >
                      ✨ AI 生成题目
                    </button>
                    <button
                      onClick={() => { setAiMode('batch'); resetAiPanel() }}
                      className={`px-5 py-2.5 rounded-xl font-bold transition-all ${
                        aiMode === 'batch'
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
                    >
                      ⚡ AI 批量操作
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                  {/* Prompt input */}
                  <div>
                    <label className="block text-gray-600 font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>
                      {aiMode === 'generate' ? '告诉 AI 你想生成什么题目' : '告诉 AI 你想批量执行什么操作'}
                    </label>
                    <textarea
                      rows={3}
                      placeholder={aiMode === 'generate' ? '例如：生成 10 道三年级数学加减法题目...' : '例如：把所有数学题的答题时间改为 15 秒...'}
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      disabled={aiWorking}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-3 focus:ring-amber-200 focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400"
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !aiWorking) {
                          e.preventDefault()
                          aiMode === 'generate' ? handleAiGenerate() : handleAiBatch()
                        }
                      }}
                    />
                  </div>

                  {/* Count selector & search toggle for generate mode */}
                  {aiMode === 'generate' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-gray-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>生成数量：</label>
                        <div className="flex gap-2">
                          {[3, 5, 10, 15, 20].map(n => (
                            <button
                              key={n}
                              onClick={() => setAiCount(n)}
                              disabled={aiWorking}
                              className={`px-4 py-1.5 rounded-xl font-bold transition-all text-sm ${
                                aiCount === n
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              } disabled:opacity-50`}
                              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                            >
                              {n} 道
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-gray-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>联网搜索：</label>
                        <button
                          onClick={() => !aiWorking && setAiEnableSearch(!aiEnableSearch)}
                          disabled={aiWorking}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                            aiEnableSearch ? 'bg-amber-500' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                            aiEnableSearch ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                        <span className="text-sm text-gray-400 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          {aiEnableSearch ? '🌐 AI 可搜索互联网 + 读取网页链接' : '💡 AI 仅使用自身知识出题'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Example prompts */}
                  <div>
                    <p className="text-gray-400 text-sm font-bold mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>💡 试试这些：</p>
                    <div className="flex flex-wrap gap-2">
                      {(aiMode === 'generate' ? AI_GENERATE_EXAMPLES : AI_BATCH_EXAMPLES).map((ex, i) => (
                        <button
                          key={i}
                          onClick={() => !aiWorking && setAiPrompt(ex)}
                          disabled={aiWorking}
                          className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50 font-bold"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status display */}
                  {aiStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl px-4 py-3 font-bold text-sm ${
                        aiStatus.startsWith('❌')
                          ? 'bg-red-50 border-2 border-red-200 text-red-600'
                          : aiStatus.startsWith('✅')
                          ? 'bg-green-50 border-2 border-green-200 text-green-600'
                          : aiStatus.startsWith('ℹ️')
                          ? 'bg-blue-50 border-2 border-blue-200 text-blue-600'
                          : 'bg-amber-50 border-2 border-amber-200 text-amber-700'
                      }`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                    >
                      {aiStatus}
                      {aiWorking && (
                        <motion.span
                          className="inline-block ml-2"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        >
                          ⏳
                        </motion.span>
                      )}
                    </motion.div>
                  )}

                  {/* AI Generate Result */}
                  {aiMode === 'generate' && aiResult && aiResult.questions && aiResult.questions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-gray-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          📝 已生成 {aiResult.totalSaved}/{aiResult.totalGenerated} 道题目：
                        </p>
                        {aiResult.fetchUsed && (
                          <span className="bg-green-50 text-green-600 px-3 py-1 rounded-lg text-xs font-bold border border-green-200" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            📄 网页读取 ×{aiResult.fetchCount}
                          </span>
                        )}
                        {aiResult.searchUsed && (
                          <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold border border-blue-200" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            🌐 联网搜索 ×{aiResult.searchCount}
                          </span>
                        )}
                      </div>
                      <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                        {aiResult.questions.map((q, i) => (
                          <div key={q.id} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                            <div className="flex items-start gap-2">
                              <span className="flex-shrink-0 text-lg">{subjectEmojiMap[q.subject] || '📚'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-800 font-bold text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                                  {i + 1}. {q.question}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md text-xs font-bold">{q.subject}</span>
                                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${getDifficultyInfo(q.difficulty).color}`}>
                                    {getDifficultyInfo(q.difficulty).emoji} {getDifficultyInfo(q.difficulty).label}
                                  </span>
                                  {q.category && <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md text-xs font-bold">{q.category}</span>}
                                  <span className="text-gray-400 text-xs">答案: {OPTION_LABELS[q.correctIndex]}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {aiResult.errors && aiResult.errors.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2">
                          <p className="text-yellow-700 text-xs font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            ⚠️ 部分问题: {aiResult.errors.join('；')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Batch Plan */}
                  {aiMode === 'batch' && aiBatchPlan && aiBatchPlan.operations.length > 0 && (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3">
                        <p className="text-blue-700 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          📋 {aiBatchPlan.summary}
                        </p>
                      </div>
                      {aiBatchPlan.warning && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3">
                          <p className="text-red-600 font-bold text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            ⚠️ {aiBatchPlan.warning}
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        {aiBatchPlan.operations.map((op, i) => (
                          <div key={i} className={`rounded-xl px-4 py-3 border-2 ${
                            op.type === 'delete' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{op.type === 'delete' ? '🗑️' : '✏️'}</span>
                                <span className="font-bold text-sm text-gray-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                                  {op.description}
                                </span>
                              </div>
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                op.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                              }`} style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                                影响 {op.affectedCount ?? '?'} 题
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          onClick={() => { setAiBatchPlan(null); setAiStatus('') }}
                          className="px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                        >
                          取消
                        </button>
                        <motion.button
                          onClick={handleExecuteBatch}
                          disabled={aiBatchExecuting}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold disabled:opacity-50"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", boxShadow: '0 3px 0 #c2410c' }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97, y: 2 }}
                        >
                          {aiBatchExecuting ? '执行中...' : '⚡ 确认执行'}
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {/* AI Batch Execution Result */}
                  {aiMode === 'batch' && aiBatchResult && (
                    <div className="space-y-2">
                      <p className="text-gray-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                        📊 执行结果（共影响 {aiBatchResult.totalAffected} 道题目）：
                      </p>
                      {aiBatchResult.results.map((r, i) => (
                        <div key={i} className={`rounded-xl px-4 py-2 border text-sm font-bold ${
                          r.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
                        }`} style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          {r.success ? '✅' : '❌'} {r.description} — {r.success ? `影响 ${r.affected} 题` : r.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t-2 border-gray-100 flex items-center justify-between">
                  <p className="text-gray-300 text-xs" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    由 MiniMax AI 驱动 · 深度思考 + 联网搜索
                  </p>
                  <div className="flex gap-3">
                    {aiWorking && (
                      <button
                        onClick={handleAiCancel}
                        className="px-5 py-2.5 rounded-xl border-2 border-red-200 text-red-500 font-bold hover:bg-red-50"
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                      >
                        ⏹ 停止
                      </button>
                    )}
                    {!aiWorking && (
                      <motion.button
                        onClick={aiMode === 'generate' ? handleAiGenerate : handleAiBatch}
                        disabled={!aiPrompt.trim()}
                        className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold disabled:opacity-40 transition-all"
                        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem', boxShadow: '0 3px 0 #c2410c' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97, y: 2 }}
                      >
                        {aiMode === 'generate' ? '✨ 开始生成' : '⚡ 分析指令'}
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

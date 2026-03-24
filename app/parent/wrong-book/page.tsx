'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const DIFFICULTIES = [
  { value: 1, label: '简单', emoji: '🌱', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 2, label: '中等', emoji: '🌿', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 3, label: '困难', emoji: '🔥', color: 'bg-red-100 text-red-700 border-red-300' },
]

const subjectEmojiMap: Record<string, string> = { '数学': '🔢', '语文': '📖', '英语': '🌍', '科学': '🔬' }

interface WrongAnswer {
  questionId: number
  subject: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctIndex: number
  difficulty: number
  category: string
  timeLimit: number
  wrongCount: number
  lastWrongAt: string
  lastWrongAnswer: number
  correctCount: number
  mastered: boolean
}

interface Child {
  id: number
  name: string
}

export default function ParentWrongBookPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterSubject, setFilterSubject] = useState('')
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [stats, setStats] = useState<{ totalWrongQuestions: number; totalWrongAnswers: number; totalCorrectAnswers: number } | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Load children list
  useEffect(() => {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_invite_code' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.members) {
          const childMembers = data.members.filter((m: any) => m.role === 'child')
          setChildren(childMembers)
          if (childMembers.length > 0 && !selectedChild) {
            setSelectedChild(childMembers[0].id)
          }
        }
      })
      .catch(() => {})
  }, [])

  const loadWrongAnswers = useCallback(async () => {
    if (!selectedChild) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        childId: String(selectedChild),
      })
      if (filterSubject) params.set('subject', filterSubject)

      const res = await fetch(`/api/quiz/wrong?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWrongAnswers(data.wrongAnswers)
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setAvailableSubjects(data.filters.subjects)
        setStats(data.stats)
      }
    } catch (e) {
      console.error('Failed to load wrong answers:', e)
    }
    setLoading(false)
  }, [page, filterSubject, selectedChild])

  useEffect(() => {
    loadWrongAnswers()
  }, [loadWrongAnswers])

  useEffect(() => {
    setPage(1)
  }, [filterSubject, selectedChild])

  const getDifficultyInfo = (d: number) => DIFFICULTIES.find(x => x.value === d) || DIFFICULTIES[0]

  const timeAgo = (dateStr: string) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}小时前`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}天前`
    return `${Math.floor(diffDays / 30)}个月前`
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b-4 border-red-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#dc2626', fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              📕 错题查看
            </h1>
            <p className="text-red-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
              查看孩子做错的题目，了解薄弱环节
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6">
        {/* Child selector */}
        {children.length > 1 && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>选择孩子：</span>
              <div className="flex gap-2">
                {children.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChild(c.id)}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${
                      selectedChild === c.id
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  >
                    🧒 {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border-2 border-red-100 p-4 text-center shadow-sm">
              <div className="text-3xl mb-1">❌</div>
              <div className="text-2xl font-bold text-red-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                {stats.totalWrongQuestions}
              </div>
              <div className="text-gray-400 text-sm font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                错题总数
              </div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-orange-100 p-4 text-center shadow-sm">
              <div className="text-3xl mb-1">🔄</div>
              <div className="text-2xl font-bold text-orange-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                {stats.totalWrongAnswers}
              </div>
              <div className="text-gray-400 text-sm font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                错误次数
              </div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-green-100 p-4 text-center shadow-sm">
              <div className="text-3xl mb-1">✅</div>
              <div className="text-2xl font-bold text-green-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                {stats.totalCorrectAnswers}
              </div>
              <div className="text-gray-400 text-sm font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                正确次数
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-3 focus:ring-red-200 bg-white"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
            >
              <option value="">全部学科</option>
              {availableSubjects.map(s => (
                <option key={s} value={s}>{subjectEmojiMap[s] || '📚'} {s}</option>
              ))}
            </select>
            <span className="text-gray-400 text-sm ml-auto font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              共 {total} 道错题
            </span>
          </div>
        </div>

        {/* Wrong answers list */}
        {!selectedChild ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-gray-100">
            <div className="text-6xl mb-4">👶</div>
            <p className="text-gray-400 text-xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              家庭中还没有孩子账号
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 animate-bounce">📕</div>
            <p className="text-gray-400 text-xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</p>
          </div>
        ) : wrongAnswers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-gray-100">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-gray-400 text-xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
              {total === 0 ? '孩子还没有做错过题呢！' : '没有符合条件的错题'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {wrongAnswers.map((w, idx) => {
              const diffInfo = getDifficultyInfo(w.difficulty)
              const isExpanded = expandedId === w.questionId
              return (
                <motion.div
                  key={w.questionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`bg-white rounded-2xl border-2 overflow-hidden hover:shadow-md transition-shadow ${
                    w.mastered ? 'border-green-100' : 'border-red-100'
                  }`}
                >
                  {/* Question header */}
                  <div
                    className="px-5 py-4 cursor-pointer flex items-start gap-4"
                    onClick={() => setExpandedId(isExpanded ? null : w.questionId)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-3xl">{subjectEmojiMap[w.subject] || '📚'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-bold text-lg leading-snug line-clamp-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                        {w.question}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="bg-purple-50 text-purple-600 px-2.5 py-0.5 rounded-lg text-sm font-bold">{w.subject}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-sm font-bold border ${diffInfo.color}`}>
                          {diffInfo.emoji} {diffInfo.label}
                        </span>
                        {w.category && (
                          <span className="bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-lg text-sm font-bold">{w.category}</span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-lg text-sm font-bold ${
                          w.mastered ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'
                        }`}>
                          {w.mastered ? '✅ 已掌握' : `❌ 错${w.wrongCount}次`}
                        </span>
                        <span className="text-gray-300 text-sm">{timeAgo(w.lastWrongAt)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center">
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
                            {[w.optionA, w.optionB, w.optionC, w.optionD].map((opt, i) => {
                              const isCorrect = i === w.correctIndex
                              const isWrongPick = i === w.lastWrongAnswer && !isCorrect
                              return (
                                <div
                                  key={i}
                                  className={`px-4 py-3 rounded-xl border-2 font-bold flex items-center gap-3 ${
                                    isCorrect
                                      ? 'bg-green-50 border-green-300 text-green-700'
                                      : isWrongPick
                                      ? 'bg-red-50 border-red-300 text-red-600'
                                      : 'bg-gray-50 border-gray-200 text-gray-600'
                                  }`}
                                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
                                >
                                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    isCorrect
                                      ? 'bg-green-500 text-white'
                                      : isWrongPick
                                      ? 'bg-red-500 text-white'
                                      : 'bg-gray-200 text-gray-500'
                                  }`}>
                                    {OPTION_LABELS[i]}
                                  </span>
                                  <span>{opt}</span>
                                  {isCorrect && <span className="ml-auto text-green-500">✓ 正确答案</span>}
                                  {isWrongPick && <span className="ml-auto text-red-500">✗ 孩子选的</span>}
                                </div>
                              )
                            })}
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-sm text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            <span>❌ 错误 {w.wrongCount} 次</span>
                            <span>✅ 正确 {w.correctCount} 次</span>
                            <span>⏱ 限时 {w.timeLimit}秒</span>
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
              className="px-5 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-red-300 transition-colors"
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
              className="px-5 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-red-300 transition-colors"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}
              whileTap={{ scale: 0.95 }}
            >
              下一页 →
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}

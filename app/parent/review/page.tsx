'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { itemEmojis, itemLabels } from '@/lib/game-logic'
import { useToast } from '@/components/ToastProvider'

interface Task {
  id: number
  title: string
  subject: string
  description?: string
  difficulty: number
  estimated_minutes: number
  due_date: string
  status: string
}

interface ReviewResult {
  message: string
  rewards: Record<string, number> | null
  statUpdates: {
    vitality: number; wisdom: number; affection: number
    gains: { vitality: number; wisdom: number; affection: number }
  } | null
  levelUp: { from: number; to: number } | null
  streakUpdate: { days: number; milestone?: string } | null
  evolution: { from: number; to: number; fromStage: number; toStage: number } | null
}

const subjectColorMap: Record<string, string> = {
  '语文': 'bg-red-100 text-red-700 border-red-200',
  '数学': 'bg-blue-100 text-blue-700 border-blue-200',
  '英语': 'bg-green-100 text-green-700 border-green-200',
  '科学': 'bg-purple-100 text-purple-700 border-purple-200',
  '其他': 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function ReviewPage() {
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'partial' | 'rejected'>('approved')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)

  const loadTasks = () => {
    setLoading(true)
    fetch('/api/tasks?status=submitted')
      .then(r => r.json())
      .then(data => {
        const list = data.tasks || []
        setTasks(list)
        setLoading(false)
        if (selectedTask && !list.find((t: Task) => t.id === selectedTask.id)) setSelectedTask(null)
      })
  }

  useEffect(() => { loadTasks() }, [])

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task); setScore(5); setComment(''); setReviewStatus('approved'); setResult(null)
  }

  const handleReview = async () => {
    if (!selectedTask) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualityScore: score, reviewComment: comment, reviewStatus }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        loadTasks()
        if (data.levelUp) {
          showToast(`🎉 宝可梦升级了！Lv.${data.levelUp.from} → Lv.${data.levelUp.to}`, 'reward', '⬆️')
        }
        if (data.streakUpdate?.milestone) {
          showToast(`${data.streakUpdate.milestone} 连续${data.streakUpdate.days}天！`, 'reward', '🔥')
        }
        if (data.evolution) {
          showToast(`✨ 宝可梦进化了！`, 'reward', '🌟')
        }
      }
    } catch (e) { console.error(e) }
    setSubmitting(false)
  }

  return (
    <div className="min-h-full flex flex-col bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-6 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#4338ca' }}>审核中心 📝</h1>
        <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
          {loading ? '加载中...' : tasks.length > 0 ? `${tasks.length} 个任务等待审核` : '暂无待审核任务'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left list */}
        <div className="w-full md:w-[440px] md:flex-shrink-0 border-r-4 border-gray-200 bg-white overflow-y-auto">
          <div className="p-5">
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-xl">加载中...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-7xl mb-4">🎉</div>
                <p className="text-gray-600 font-bold text-2xl">全部审核完成！</p>
                <p className="text-gray-400 text-xl mt-2">暂无待审核任务</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map(task => (
                  <motion.button
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    className={`w-full text-left p-5 rounded-2xl border-3 transition-all ${
                      selectedTask?.id === task.id
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-transparent bg-gray-50 hover:border-gray-300 hover:bg-white'
                    }`}
                    style={{ borderWidth: 3 }}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <p className="font-bold text-gray-800 flex-1 text-xl leading-snug">{task.title}</p>
                      <span className={`text-base px-3 py-1 rounded-full border-2 flex-shrink-0 font-bold ${subjectColorMap[task.subject] || subjectColorMap['其他']}`}>
                        {task.subject}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-lg text-gray-400 font-semibold">
                      <span>{'⭐'.repeat(task.difficulty)}</span>
                      <span>⏱ {task.estimated_minutes}分钟</span>
                      <span className="ml-auto">📅 {task.due_date}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {result ? (
            <motion.div
              className="flex flex-col items-center justify-center h-full text-center"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            >
              <div className="text-9xl mb-6">{result.rewards ? '🎉' : '📋'}</div>
              <h2 className="text-4xl font-bold text-gray-800 mb-4">{result.message}</h2>
              {result.levelUp && (
                <motion.div
                  className="mb-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-3xl px-10 py-5 text-white"
                  initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  style={{ boxShadow: '0 6px 0 #b45309' }}
                >
                  <p className="font-bold text-center" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '2rem' }}>
                    ⬆️ 宝可梦升级了！
                  </p>
                  <p className="text-center mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', opacity: 0.9 }}>
                    Lv.{result.levelUp.from} → Lv.{result.levelUp.to}
                  </p>
                </motion.div>
              )}
              {result.streakUpdate && result.streakUpdate.days > 0 && (
                <motion.div
                  className="mb-4 bg-gradient-to-r from-orange-400 to-red-400 rounded-3xl px-10 py-4 text-white"
                  initial={{ scale: 0 }} animate={{ scale: [0, 1.1, 1] }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  style={{ boxShadow: '0 4px 0 #b91c1c' }}
                >
                  <p className="font-bold text-center" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
                    🔥 连续打卡 {result.streakUpdate.days} 天！
                    {result.streakUpdate.milestone && ` ${result.streakUpdate.milestone}`}
                  </p>
                </motion.div>
              )}
              {result.evolution && (
                <motion.div
                  className="mb-4 bg-gradient-to-r from-purple-400 to-pink-400 rounded-3xl px-10 py-5 text-white"
                  initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  style={{ boxShadow: '0 6px 0 #7e22ce' }}
                >
                  <p className="font-bold text-center" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '2rem' }}>
                    ✨ 宝可梦进化了！
                  </p>
                  <p className="text-center mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.4rem', opacity: 0.9 }}>
                    阶段 {result.evolution.fromStage} → 阶段 {result.evolution.toStage}
                  </p>
                </motion.div>
              )}
              {result.rewards && (
                <div className="mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-3xl p-8 w-full max-w-lg">
                  <p className="text-2xl text-gray-600 font-bold mb-5">孩子获得的奖励</p>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(result.rewards).filter(([, qty]) => qty > 0).map(([item, qty]) => (
                      <div key={item} className="bg-white rounded-2xl p-5 text-center border border-yellow-100">
                        <div className="text-5xl mb-2">{itemEmojis[item]}</div>
                        <div className="text-xl text-gray-500 font-semibold">{itemLabels[item]}</div>
                        <div className="text-3xl font-bold text-yellow-600 mt-1">+{qty}</div>
                      </div>
                    ))}
                  </div>
                  {result.statUpdates?.gains && (
                    <div className="mt-5 pt-5 border-t-2 border-yellow-200 flex justify-center gap-8 text-xl text-gray-500 font-semibold">
                      <span>❤️ 体力 +{result.statUpdates.gains.vitality}</span>
                      <span>💡 智慧 +{result.statUpdates.gains.wisdom}</span>
                      <span>💕 亲密 +{result.statUpdates.gains.affection}</span>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => { setResult(null); setSelectedTask(null) }}
                className="mt-8 bg-indigo-500 hover:bg-indigo-600 text-white px-12 py-5 rounded-2xl text-2xl font-bold transition-colors"
              >
                继续审核
              </button>
            </motion.div>
          ) : !selectedTask ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-8xl mb-5 opacity-20">📝</div>
              <p className="text-gray-400 text-3xl font-bold">从左侧选择一个任务开始审核</p>
              <p className="text-gray-300 text-xl mt-3">对孩子的提交进行评分，并给予鼓励</p>
            </div>
          ) : (
            <motion.div key={selectedTask.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
              {/* Task info */}
              <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 mb-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-gray-800">{selectedTask.title}</h2>
                    {selectedTask.description && <p className="text-xl text-gray-500 mt-2">{selectedTask.description}</p>}
                  </div>
                  <span className={`text-xl px-4 py-2 rounded-full border-2 font-bold ${subjectColorMap[selectedTask.subject] || subjectColorMap['其他']}`}>
                    {selectedTask.subject}
                  </span>
                </div>
                <div className="flex items-center gap-5 text-xl text-gray-400 font-semibold">
                  <span>{'⭐'.repeat(selectedTask.difficulty)}</span>
                  <span>⏱ {selectedTask.estimated_minutes} 分钟</span>
                  <span>📅 {selectedTask.due_date}</span>
                  <span className="text-yellow-600 bg-yellow-50 px-4 py-2 rounded-full text-lg font-bold ml-auto">⏳ 等待审核</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 space-y-7">
                {/* Score */}
                <div>
                  <label className="block text-2xl font-bold text-gray-700 mb-4">质量评分</label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => setScore(s)}
                        className={`flex-1 py-6 rounded-2xl text-4xl transition-all font-medium ${
                          score >= s ? 'bg-yellow-400 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-xl text-gray-500 mt-3 font-semibold">
                    {score <= 3 ? '普通完成' : score === 4 ? '良好完成 👍' : '优秀完成！🌟'}
                  </p>
                </div>

                {/* Review Status */}
                <div>
                  <label className="block text-2xl font-bold text-gray-700 mb-4">审核结果</label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 'approved', label: '通过', emoji: '✅', color: 'bg-green-500' },
                      { value: 'partial', label: '部分完成', emoji: '🔶', color: 'bg-orange-500' },
                      { value: 'rejected', label: '退回重做', emoji: '❌', color: 'bg-red-500' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setReviewStatus(opt.value as 'approved' | 'partial' | 'rejected')}
                        className={`py-5 rounded-2xl text-xl font-bold transition-all border-2 ${
                          reviewStatus === opt.value
                            ? `${opt.color} text-white border-transparent shadow-lg`
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-3xl mb-2">{opt.emoji}</div>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-2xl font-bold text-gray-700 mb-3">评语（可选）</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="鼓励孩子，让 TA 更有动力..."
                    rows={3}
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-800 text-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 resize-none"
                  />
                </div>

                <button
                  onClick={handleReview}
                  disabled={submitting}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-6 rounded-2xl transition-colors disabled:opacity-50 text-2xl"
                >
                  {submitting ? '提交中...' : '确认审核 →'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

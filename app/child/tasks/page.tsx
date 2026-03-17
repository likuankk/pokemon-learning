'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import RewardAnimation from '@/components/RewardAnimation'
import { ItemReward, subjectColors } from '@/lib/game-logic'
import { useToast } from '@/components/ToastProvider'

interface Task {
  id: number; title: string; subject: string
  description?: string; difficulty: number
  estimated_minutes: number; due_date: string; status: string
}

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: '待完成',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  submitted: { label: '等待审核', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  approved:  { label: '已通过',   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  partial:   { label: '部分完成', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  rejected:  { label: '需重做',   bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
}

export default function ChildTasksPage() {
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showReward, setShowReward] = useState(false)
  const [rewardData, setRewardData] = useState<ItemReward | null>(null)

  const loadTasks = () => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => { setTasks(data.tasks || []); setLoading(false) })
  }

  useEffect(() => { loadTasks() }, [])

  const handleSubmit = async (taskId: number) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        showToast('任务已提交！等待家长审核 🎉', 'success', '✅')
        setSelectedTask(null)
        loadTasks()
      } else {
        showToast('提交失败，请重试', 'error', '❌')
      }
    } catch {
      showToast('网络错误', 'error', '❌')
    }
    setSubmitting(false)
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'rejected')
  const submittedTasks = tasks.filter(t => t.status === 'submitted')
  const completedTasks = tasks.filter(t => t.status === 'approved' || t.status === 'partial')

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      <div className="border-b-4 border-teal-200 px-4 md:px-8 py-4 md:py-6"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <h1 className="game-title-green leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#065f46' }}>今日任务 📋</h1>
        <p className="text-emerald-500 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
          完成任务，让宝可梦更强！
        </p>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left: task list */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-5 mb-7">
            {[
              { label: '待完成', value: pendingTasks.length,   emoji: '📋', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
              { label: '等待审核', value: submittedTasks.length, emoji: '⏳', bg: '#fefce8', border: '#fde68a', text: '#b45309' },
              { label: '已完成',  value: completedTasks.length, emoji: '✅', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-5 border-2"
                style={{ background: s.bg, borderColor: s.border, boxShadow: '0 3px 0 rgba(0,0,0,0.05)' }}>
                <div className="text-5xl mb-2">{s.emoji}</div>
                <div className="font-bold mb-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '3rem', color: s.text }}>{s.value}</div>
                <div className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem', color: '#6b7280' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400 text-2xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-7xl mb-4">🎉</div>
              <p className="font-bold text-gray-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '2rem' }}>今天没有任务！</p>
            </div>
          ) : (
            <div className="space-y-8">
              {pendingTasks.length > 0 && (
                <section>
                  <h2 className="font-bold uppercase tracking-widest mb-4"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', color: '#6b7280' }}>
                    待完成 ({pendingTasks.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {pendingTasks.map(task => (
                      <motion.button key={task.id}
                        onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                        className="text-left rounded-2xl p-5 border-2 transition-all"
                        style={{
                          background: selectedTask?.id === task.id ? '#f0fdf4' : '#fff',
                          borderColor: selectedTask?.id === task.id ? '#34d399' : '#e5e7eb',
                          boxShadow: selectedTask?.id === task.id
                            ? '0 4px 0 #34d399, 0 6px 16px rgba(52,211,153,0.15)'
                            : '0 3px 0 rgba(0,0,0,0.06)',
                        }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-bold text-gray-800 leading-snug flex-1"
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
                            {task.title}
                          </p>
                          <span className={`text-sm px-2 py-1 rounded-full border font-bold flex-shrink-0 ${subjectColors[task.subject] || subjectColors['其他']}`}
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            {task.subject}
                          </span>
                        </div>
                        <div className="flex gap-3 text-gray-400 font-bold flex-wrap"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                          <span>{'⭐'.repeat(task.difficulty)}</span>
                          <span>⏱ {task.estimated_minutes}分</span>
                          <span>📅 {task.due_date}</span>
                          {task.status === 'rejected' && (
                            <span className="text-red-500">❌ 需重做</span>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </section>
              )}

              {submittedTasks.length > 0 && (
                <section>
                  <h2 className="font-bold uppercase tracking-widest mb-4"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', color: '#6b7280' }}>
                    等待家长审核 ({submittedTasks.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {submittedTasks.map(task => (
                      <div key={task.id} className="rounded-2xl p-5 border-2 border-yellow-200 bg-yellow-50">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl">⏳</span>
                          <p className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>{task.title}</p>
                        </div>
                        <p className="font-bold text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                          {task.subject} · {'⭐'.repeat(task.difficulty)}
                        </p>
                        <div className="mt-3 inline-block px-4 py-2 rounded-xl bg-yellow-100 text-yellow-700 font-bold"
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                          已提交，等待家长审核...
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {completedTasks.length > 0 && (
                <section>
                  <h2 className="font-bold uppercase tracking-widest mb-4"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', color: '#6b7280' }}>
                    已完成 ({completedTasks.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-4 opacity-70">
                    {completedTasks.map(task => (
                      <div key={task.id} className="rounded-2xl p-5 border-2 border-green-200 bg-green-50">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl">✅</span>
                          <p className="font-bold text-gray-700 line-through decoration-green-400"
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>{task.title}</p>
                        </div>
                        <p className="font-bold text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>{task.subject}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Right: task detail panel */}
        <AnimatePresence>
          {selectedTask && (
            <motion.div
              className="w-full md:w-[420px] md:flex-shrink-0 border-l-4 border-teal-200 bg-white overflow-y-auto"
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              <div className="p-7">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="game-label" style={{ fontSize: '1.75rem' }}>任务详情</h2>
                  <button onClick={() => setSelectedTask(null)}
                    className="text-gray-400 hover:text-gray-600 text-3xl font-bold transition-colors">×</button>
                </div>

                {/* Task info */}
                <div className="bg-gray-50 rounded-2xl p-5 mb-5 border border-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="game-label flex-1" style={{ fontSize: '1.5rem' }}>{selectedTask.title}</h3>
                    <span className={`px-3 py-1 rounded-full border-2 font-bold flex-shrink-0 ${subjectColors[selectedTask.subject] || subjectColors['其他']}`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                      {selectedTask.subject}
                    </span>
                  </div>
                  {selectedTask.description && (
                    <p className="text-gray-600 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}>
                      {selectedTask.description}
                    </p>
                  )}
                  <div className="flex gap-3 text-gray-400 font-bold flex-wrap"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}>
                    <span>{'⭐'.repeat(selectedTask.difficulty)}</span>
                    <span>⏱ {selectedTask.estimated_minutes} 分钟</span>
                    <span>📅 {selectedTask.due_date}</span>
                  </div>
                </div>

                {/* Status badge */}
                {selectedTask.status === 'rejected' && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-5">
                    <p className="font-bold text-red-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                      ❌ 这个任务需要重做，加油！
                    </p>
                  </div>
                )}

                {/* Tips */}
                <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-5 mb-6">
                  <p className="font-bold text-teal-700 mb-2" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>💡 完成后记得：</p>
                  <ul className="space-y-1">
                    {['认真检查作业有没有错误', '整理好书桌和文具', '准备好汇报给家长'].map(tip => (
                      <li key={tip} className="text-teal-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                        ✓ {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Submit button */}
                <motion.button
                  onClick={() => handleSubmit(selectedTask.id)}
                  disabled={submitting}
                  className="w-full text-white font-bold py-6 rounded-2xl transition-all disabled:opacity-50"
                  style={{
                    fontFamily: "'ZCOOL KuaiLe', sans-serif",
                    fontSize: '1.5rem',
                    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                    boxShadow: '0 5px 0 #15803d',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97, y: 3 }}
                >
                  {submitting ? '提交中...' : '✅ 我完成了！提交给家长'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <RewardAnimation visible={showReward} rewards={rewardData} onClose={() => setShowReward(false)} />
    </div>
  )
}

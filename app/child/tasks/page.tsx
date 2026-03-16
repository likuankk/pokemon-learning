'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import TaskCard from '@/components/TaskCard'
import RewardAnimation from '@/components/RewardAnimation'
import { ItemReward } from '@/lib/game-logic'

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

export default function ChildTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [showReward, setShowReward] = useState(false)
  const [rewardData, setRewardData] = useState<ItemReward | null>(null)

  const loadTasks = () => {
    fetch('/api/tasks?familyId=1')
      .then(r => r.json())
      .then(data => {
        setTasks(data.tasks || [])
        setLoading(false)
      })
  }

  useEffect(() => { loadTasks() }, [])

  const handleSubmit = async (taskId: number) => {
    if (!confirm('确认提交这个任务吗？')) return
    setSubmitting(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: 2 }),
      })
      if (res.ok) loadTasks()
    } catch (e) { console.error(e) }
    setSubmitting(null)
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'rejected')
  const submittedTasks = tasks.filter(t => t.status === 'submitted')
  const completedTasks = tasks.filter(t => t.status === 'approved' || t.status === 'partial')

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b-4 border-teal-200 px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <h1 className="game-title-green leading-tight" style={{ fontSize: '3.5rem', color: '#065f46' }}>今日任务 📋</h1>
        <p className="text-emerald-500 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>完成任务，让宝可梦更强！</p>
      </div>

      <div className="px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            { label: '待完成', value: pendingTasks.length, emoji: '📋', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
            { label: '等待审核', value: submittedTasks.length, emoji: '⏳', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
            { label: '已完成', value: completedTasks.length, emoji: '✅', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border-2 ${s.border} rounded-2xl p-6`}>
              <div className="text-5xl mb-3">{s.emoji}</div>
              <div className={`text-6xl font-bold ${s.text} mb-2`}>{s.value}</div>
              <div className="text-xl text-gray-500 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-4">🎉</div>
            <p className="text-gray-600 font-bold text-3xl">今天没有任务！</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Pending / Rejected */}
            {pendingTasks.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-500 uppercase tracking-widest mb-5">
                  待完成 ({pendingTasks.length})
                </h2>
                <div className="grid grid-cols-2 gap-5">
                  {pendingTasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <TaskCard
                        task={task}
                        showStatus={task.status === 'rejected'}
                        onAction={() => handleSubmit(task.id)}
                        actionLabel={submitting === task.id ? '提交中...' : '完成任务 ✓'}
                        actionVariant="success"
                        disabled={submitting === task.id}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Submitted */}
            {submittedTasks.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-500 uppercase tracking-widest mb-5">
                  等待家长审核 ({submittedTasks.length})
                </h2>
                <div className="grid grid-cols-2 gap-5">
                  {submittedTasks.map(task => (
                    <div key={task.id} className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-yellow-500 text-3xl">⏳</span>
                        <h3 className="font-bold text-gray-800 text-xl">{task.title}</h3>
                      </div>
                      <div className="text-lg text-gray-400 font-semibold mb-4">{task.subject} · {'⭐'.repeat(task.difficulty)}</div>
                      <div className="text-lg text-yellow-600 bg-yellow-100 rounded-xl px-4 py-3 inline-block font-bold">
                        已提交，等待妈妈审核...
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {completedTasks.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-500 uppercase tracking-widest mb-5">
                  已完成 ({completedTasks.length})
                </h2>
                <div className="grid grid-cols-2 gap-5 opacity-70">
                  {completedTasks.map(task => (
                    <div key={task.id} className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-green-500 text-3xl">✅</span>
                        <h3 className="font-bold text-gray-700 text-xl line-through decoration-green-400">{task.title}</h3>
                      </div>
                      <div className="text-lg text-gray-400 font-semibold">{task.subject}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <RewardAnimation
        visible={showReward}
        rewards={rewardData}
        onClose={() => setShowReward(false)}
      />
    </div>
  )
}

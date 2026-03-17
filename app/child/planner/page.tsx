'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

interface Task {
  id: number
  title: string
  subject: string
  estimated_minutes: number
  difficulty: number
  status: string
}

const TIME_SLOTS = [
  { id: 'morning', label: '上午', emoji: '🌅', time: '8:00 – 12:00', color: 'border-orange-200 bg-orange-50' },
  { id: 'afternoon', label: '下午', emoji: '☀️', time: '14:00 – 18:00', color: 'border-yellow-200 bg-yellow-50' },
  { id: 'evening', label: '晚上', emoji: '🌙', time: '19:00 – 21:00', color: 'border-indigo-200 bg-indigo-50' },
]

const SUBJECT_COLORS: Record<string, string> = {
  '语文': 'bg-red-100 text-red-700',
  '数学': 'bg-blue-100 text-blue-700',
  '英语': 'bg-green-100 text-green-700',
  '科学': 'bg-purple-100 text-purple-700',
  '其他': 'bg-gray-100 text-gray-700',
}

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [plan, setPlan] = useState<Record<string, number[]>>({ morning: [], afternoon: [], evening: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Load tasks + saved plan
  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch(`/api/planner?date=${today}`).then(r => r.json()),
    ]).then(([taskData, planData]) => {
      const pending = (taskData.tasks || []).filter(
        (t: Task) => t.status === 'pending' || t.status === 'rejected'
      )
      setTasks(pending)
      if (planData.plan) {
        // Filter out task IDs that no longer exist in pending tasks
        const pendingIds = new Set(pending.map((t: Task) => t.id))
        const cleanPlan: Record<string, number[]> = { morning: [], afternoon: [], evening: [] }
        for (const slot of ['morning', 'afternoon', 'evening']) {
          cleanPlan[slot] = (planData.plan[slot] || []).filter((id: number) => pendingIds.has(id))
        }
        setPlan(cleanPlan)
      }
      setLoading(false)
    })
  }, [today])

  const getTasksForSlot = (slotId: string) =>
    plan[slotId].map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[]

  const getUnscheduledTasks = () => {
    const scheduled = Object.values(plan).flat()
    return tasks.filter(t => !scheduled.includes(t.id))
  }

  const addToSlot = (slotId: string, taskId: number) => {
    const newPlan = { ...plan }
    for (const slot of Object.keys(newPlan)) {
      newPlan[slot] = newPlan[slot].filter(id => id !== taskId)
    }
    newPlan[slotId] = [...newPlan[slotId], taskId]
    setPlan(newPlan)
    setSelectedTask(null)
    setSaved(false)
  }

  const removeFromSlot = (slotId: string, taskId: number) => {
    setPlan({ ...plan, [slotId]: plan[slotId].filter(id => id !== taskId) })
    setSaved(false)
  }

  const getTotalMinutes = (slotId: string) =>
    getTasksForSlot(slotId).reduce((sum, t) => sum + t.estimated_minutes, 0)

  const savePlan = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, plan }),
      })
      if (res.ok) {
        setSaved(true)
      }
    } catch (err) {
      console.error('Save plan error:', err)
    } finally {
      setSaving(false)
    }
  }, [today, plan])

  const unscheduled = getUnscheduledTasks()

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b-4 border-teal-200 px-4 md:px-8 py-6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <div>
          <h1 className="game-title-green leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#065f46' }}>时间规划 🗓️</h1>
          <p className="text-emerald-500 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>合理安排时间，轻松完成任务！</p>
        </div>
        <div className="flex items-center gap-4">
          {!saved && (
            <span className="text-amber-500 text-lg font-bold animate-pulse">未保存</span>
          )}
          <motion.button
            onClick={savePlan}
            disabled={saving || saved}
            className={`px-8 py-3 rounded-2xl text-xl font-bold shadow-lg transition-all ${
              saved
                ? 'bg-green-100 text-green-600 border-2 border-green-200 cursor-default'
                : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white border-2 border-emerald-300 hover:shadow-xl'
            }`}
            whileHover={!saved ? { scale: 1.05 } : {}}
            whileTap={!saved ? { scale: 0.95 } : {}}
          >
            {saving ? '保存中...' : saved ? '✓ 已保存' : '💾 保存计划'}
          </motion.button>
        </div>
      </div>

      <div className="px-4 md:px-8 py-8 space-y-7">
        {/* Unscheduled Tasks - horizontal scrolling pill bar */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-bold text-gray-500 uppercase tracking-widest">
              待安排任务
            </h2>
            {unscheduled.length > 0 && (
              <span className="bg-gray-200 text-gray-600 text-xl px-4 py-1 rounded-full font-bold">{unscheduled.length}</span>
            )}
          </div>

          {loading ? (
            <div className="text-gray-400 text-2xl py-4">加载中...</div>
          ) : unscheduled.length === 0 ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-6 py-4 inline-flex items-center gap-3">
              <span className="text-green-500 text-3xl">🎉</span>
              <span className="text-green-700 text-2xl font-bold">所有任务已安排到时间段！</span>
            </div>
          ) : (
            <div className="flex gap-4 flex-wrap">
              {unscheduled.map(task => (
                <motion.button
                  key={task.id}
                  onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all bg-white shadow-sm ${
                    selectedTask?.id === task.id
                      ? 'border-violet-500 bg-violet-50 shadow-md'
                      : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50'
                  }`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className={`text-base px-3 py-1 rounded-full font-bold ${SUBJECT_COLORS[task.subject] || SUBJECT_COLORS['其他']}`}>
                    {task.subject}
                  </span>
                  <span className="text-xl font-bold text-gray-800">{task.title}</span>
                  <span className="text-lg text-gray-400 font-semibold">⏱ {task.estimated_minutes}分</span>
                  {selectedTask?.id === task.id && (
                    <span className="text-violet-500 text-lg font-bold">← 点击时间段</span>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Three-column time slots */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIME_SLOTS.map(slot => (
            <div key={slot.id}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="font-bold text-gray-700 text-2xl">{slot.emoji} {slot.label}</span>
                  <span className="text-gray-400 text-xl ml-2">({slot.time})</span>
                </div>
                {getTotalMinutes(slot.id) > 0 && (
                  <span className="text-lg text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-semibold">
                    {getTotalMinutes(slot.id)}分钟
                  </span>
                )}
              </div>

              <motion.div
                className={`rounded-2xl border-2 p-4 min-h-[240px] transition-all ${
                  selectedTask
                    ? 'border-dashed border-violet-400 bg-violet-50 cursor-pointer hover:border-violet-500 hover:bg-violet-100'
                    : `border-2 ${slot.color}`
                }`}
                onClick={() => { if (selectedTask) addToSlot(slot.id, selectedTask.id) }}
                whileHover={selectedTask ? { scale: 1.01 } : {}}
              >
                {selectedTask && (
                  <p className="text-center text-violet-500 text-xl font-bold mb-3 py-1">
                    点击安排到{slot.label}
                  </p>
                )}

                {getTasksForSlot(slot.id).length === 0 && !selectedTask ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                    <div className="text-5xl mb-3">+</div>
                    <p className="text-xl font-semibold">选择任务后点击这里</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getTasksForSlot(slot.id).map(task => (
                      <div
                        key={task.id}
                        className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:bg-red-50 group"
                        onClick={e => { e.stopPropagation(); removeFromSlot(slot.id, task.id) }}
                      >
                        <span className={`text-base px-3 py-1 rounded-full font-bold ${SUBJECT_COLORS[task.subject] || SUBJECT_COLORS['其他']}`}>
                          {task.subject}
                        </span>
                        <span className="text-lg text-gray-700 flex-1 truncate font-semibold">{task.title}</span>
                        <span className="text-base text-gray-400 font-semibold">{task.estimated_minutes}分</span>
                        <span className="text-gray-200 group-hover:text-red-400 transition-colors text-xl font-bold">✕</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          ))}
        </div>

        {/* Summary bar */}
        {Object.values(plan).flat().length > 0 && (
          <motion.div
            className="bg-white rounded-2xl border-2 border-gray-200 p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-2xl font-bold text-gray-700 mb-4">📊 今日规划总结</h3>
            <div className="flex gap-8 flex-wrap">
              {TIME_SLOTS.map(slot => {
                const slotTasks = getTasksForSlot(slot.id)
                if (slotTasks.length === 0) return null
                return (
                  <div key={slot.id} className="text-xl text-gray-500 font-semibold">
                    <span>{slot.emoji} {slot.label}：</span>
                    <span className="font-bold text-gray-700">{slotTasks.length} 个任务，{getTotalMinutes(slot.id)} 分钟</span>
                  </div>
                )
              })}
              <div className="ml-auto text-xl font-bold text-gray-700">
                合计：{Object.values(plan).flat().reduce((sum, id) => {
                  const task = tasks.find(t => t.id === id)
                  return sum + (task?.estimated_minutes || 0)
                }, 0)} 分钟
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

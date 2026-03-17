'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import TaskCard from '@/components/TaskCard'

interface Task {
  id: number
  title: string
  subject: string
  description?: string
  difficulty: number
  estimated_minutes: number
  due_date: string
  status: string
  creator_name: string
}

const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待完成' },
  { value: 'submitted', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '需重做' },
]

export default function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const loadTasks = () => {
    setLoading(true)
    const url = filter ? `/api/tasks?status=${filter}` : '/api/tasks'
    fetch(url).then(r => r.json()).then(data => { setTasks(data.tasks || []); setLoading(false) })
  }

  useEffect(() => { loadTasks() }, [filter])

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除这个任务？')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    loadTasks()
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <div>
          <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#4338ca' }}>任务列表 📚</h1>
          <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>共 {tasks.length} 个任务</p>
        </div>
        <Link
          href="/parent/tasks/new"
          className="text-white px-8 py-4 rounded-2xl font-bold transition-colors flex items-center gap-3"
          style={{
            fontFamily: "'ZCOOL KuaiLe', sans-serif",
            fontSize: '1.5rem',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            boxShadow: '0 5px 0 #3730a3, 0 8px 16px rgba(99,102,241,0.3)',
          }}
        >
          <span>➕</span> 新建任务
        </Link>
      </div>

      <div className="px-4 md:px-8 py-6">
        {/* Filter Tabs */}
        <div className="flex items-center gap-3 mb-6 bg-white rounded-2xl border-2 border-gray-200 p-2 w-fit">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-6 py-3 rounded-xl text-xl font-bold transition-all ${
                filter === f.value
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-4">📭</div>
            <p className="text-gray-400 text-2xl">暂无任务</p>
            <Link href="/parent/tasks/new" className="text-indigo-500 text-2xl mt-3 inline-block hover:underline font-bold">
              创建第一个任务 →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/parent/tasks/${task.id}`}>
                  <TaskCard
                    task={task}
                    showStatus={true}
                    onAction={(e) => { e?.stopPropagation(); handleDelete(task.id) }}
                    actionLabel="删除"
                    actionVariant="danger"
                  />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

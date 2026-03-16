'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'

const subjectColorMap: Record<string, string> = {
  '语文': 'bg-red-100 text-red-700 border-red-200',
  '数学': 'bg-blue-100 text-blue-700 border-blue-200',
  '英语': 'bg-green-100 text-green-700 border-green-200',
  '科学': 'bg-purple-100 text-purple-700 border-purple-200',
  '其他': 'bg-gray-100 text-gray-700 border-gray-200',
}

const statusLabels: Record<string, string> = {
  pending: '待完成', submitted: '待审核', approved: '已通过',
  partial: '部分完成', rejected: '需重做',
}
const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  submitted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  partial: 'bg-orange-100 text-orange-700 border-orange-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

interface Task {
  id: number; title: string; subject: string; description: string
  difficulty: number; estimated_minutes: number; due_date: string
  status: string; creator_name: string; created_at: string
}
interface Submission {
  id: number; submitted_at: string; review_status: string
  review_comment: string; quality_score: number; reviewed_at: string
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string
  const [task, setTask] = useState<Task | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then(r => r.json())
      .then(d => {
        setTask(d.task)
        setSubmissions(d.submissions || [])
        setLoading(false)
      })
  }, [taskId])

  const handleDelete = async () => {
    if (!confirm('确定删除这个任务？')) return
    setDeleting(true)
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    router.push('/parent/tasks')
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-gray-400 text-3xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-3xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>任务不存在</p>
        <Link href="/parent/tasks" className="text-indigo-500 text-2xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>← 返回任务列表</Link>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-8 py-6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <div>
          <Link href="/parent/tasks" className="text-indigo-400 hover:text-indigo-600 font-bold mb-2 flex items-center gap-2"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
            ← 返回任务列表
          </Link>
          <h1 className="game-title-indigo leading-tight" style={{ fontSize: '3rem', color: '#4338ca' }}>任务详情</h1>
        </div>
        <div className="flex gap-3">
          {task.status === 'pending' && (
            <Link href={`/parent/tasks/${taskId}/edit`}
              className="px-6 py-3 rounded-2xl font-bold text-white"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 0 #3730a3' }}>
              ✏️ 编辑
            </Link>
          )}
          {task.status === 'submitted' && (
            <Link href="/parent/review"
              className="px-6 py-3 rounded-2xl font-bold text-white"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 0 #b45309' }}>
              📝 去审核
            </Link>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="px-6 py-3 rounded-2xl font-bold text-white disabled:opacity-50"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', background: 'linear-gradient(135deg, #f87171, #ef4444)', boxShadow: '0 4px 0 #b91c1c' }}>
            {deleting ? '删除中...' : '🗑️ 删除'}
          </button>
        </div>
      </div>

      <div className="px-8 py-8 space-y-6">
        {/* Task info card */}
        <motion.div className="bg-white rounded-3xl border-2 border-gray-200 p-8"
          style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <h2 className="game-label flex-1" style={{ fontSize: '2.25rem' }}>{task.title}</h2>
            <span className={`px-4 py-2 rounded-full border-2 font-bold flex-shrink-0 ${subjectColorMap[task.subject] || subjectColorMap['其他']}`}
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
              {task.subject}
            </span>
          </div>

          {task.description && (
            <p className="text-gray-600 mb-5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>{task.description}</p>
          )}

          <div className="flex flex-wrap gap-4 mb-5">
            <span className="font-bold text-gray-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
              {'⭐'.repeat(task.difficulty)}
            </span>
            <span className="font-bold text-gray-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
              ⏱ {task.estimated_minutes} 分钟
            </span>
            <span className="font-bold text-gray-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
              📅 截止 {task.due_date}
            </span>
            <span className="font-bold text-gray-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
              👤 {task.creator_name} 布置
            </span>
          </div>

          <span className={`inline-block px-5 py-2 rounded-full border-2 font-bold ${statusColors[task.status] || statusColors.pending}`}
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
            {statusLabels[task.status] || task.status}
          </span>
        </motion.div>

        {/* Submissions history */}
        <motion.div className="bg-white rounded-3xl border-2 border-gray-200 p-8"
          style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <h2 className="game-label mb-6" style={{ fontSize: '1.75rem' }}>提交历史 ({submissions.length})</h2>
          {submissions.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-6xl mb-3">📭</div>
              <p className="text-gray-400 text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>暂无提交记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub, i) => (
                <div key={sub.id} className="flex items-start gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-gray-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                        提交于 {sub.submitted_at?.slice(0, 16).replace('T', ' ')}
                      </span>
                      {sub.review_status !== 'pending' && (
                        <span className={`px-3 py-1 rounded-full border font-bold text-sm ${statusColors[sub.review_status] || statusColors.pending}`}
                          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          {statusLabels[sub.review_status]}
                        </span>
                      )}
                      {sub.quality_score && (
                        <span className="font-bold text-yellow-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                          {'⭐'.repeat(sub.quality_score)}
                        </span>
                      )}
                    </div>
                    {sub.review_comment && (
                      <p className="text-gray-600 italic" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                        评语："{sub.review_comment}"
                      </p>
                    )}
                    {sub.reviewed_at && (
                      <p className="text-gray-400 mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                        审核于 {sub.reviewed_at?.slice(0, 16).replace('T', ' ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

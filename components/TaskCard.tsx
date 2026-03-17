'use client'

import { subjectColors } from '@/lib/game-logic'

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

interface Props {
  task: Task
  onAction?: (e?: React.MouseEvent) => void
  actionLabel?: string
  actionVariant?: 'primary' | 'success' | 'danger' | 'warning'
  showStatus?: boolean
  disabled?: boolean
}

const difficultyStars = (d: number) => '⭐'.repeat(d)

const statusLabels: Record<string, string> = {
  pending: '待完成',
  submitted: '待审核',
  approved: '已通过 ✓',
  partial: '部分完成',
  rejected: '需重做',
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  partial: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
}

const actionStyles: Record<string, React.CSSProperties> = {
  primary: { background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', boxShadow: '0 4px 0 #1d4ed8' },
  success: { background: 'linear-gradient(135deg, #4ade80, #22c55e)', boxShadow: '0 4px 0 #15803d' },
  danger:  { background: 'linear-gradient(135deg, #f87171, #ef4444)', boxShadow: '0 4px 0 #b91c1c' },
  warning: { background: 'linear-gradient(135deg, #fb923c, #f97316)', boxShadow: '0 4px 0 #c2410c' },
}

export default function TaskCard({ task, onAction, actionLabel, actionVariant = 'primary', showStatus = true, disabled = false }: Props) {
  const colorClass = subjectColors[task.subject] || subjectColors['其他']

  return (
    <div
      className="bg-white rounded-2xl p-6 transition-all"
      style={{
        border: '2px solid #e5e7eb',
        boxShadow: '0 5px 0 rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-3px)'
        el.style.boxShadow = '0 8px 0 rgba(0,0,0,0.08), 0 12px 20px rgba(0,0,0,0.1)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = '0 5px 0 rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06)'
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3
          className="game-label flex-1 leading-snug"
          style={{ fontSize: '1.35rem' }}
        >
          {task.title}
        </h3>
        <span
          className={`px-3 py-1.5 rounded-full border-2 font-bold flex-shrink-0 ${colorClass}`}
          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
        >
          {task.subject}
        </span>
      </div>

      {task.description && (
        <p
          className="text-gray-500 mb-4 line-clamp-2"
          style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
        >
          {task.description}
        </p>
      )}

      <div
        className="flex items-center gap-3 text-gray-400 mb-5 flex-wrap font-bold"
        style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}
      >
        <span title="难度">{difficultyStars(task.difficulty)}</span>
        <span>⏱ {task.estimated_minutes}分钟</span>
        <span>📅 {task.due_date}</span>
        {showStatus && (
          <span
            className={`ml-auto px-3 py-1 rounded-full font-bold ${statusColors[task.status] || statusColors.pending}`}
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
          >
            {statusLabels[task.status] || task.status}
          </span>
        )}
      </div>

      {onAction && actionLabel && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction(e) }}
          disabled={disabled}
          className={`w-full rounded-xl text-white font-bold transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:translate-y-1'}`}
          style={{
            padding: '14px 0',
            fontFamily: "'ZCOOL KuaiLe', sans-serif",
            fontSize: '1.35rem',
            ...(disabled ? { background: '#9ca3af', boxShadow: '0 3px 0 #6b7280' } : actionStyles[actionVariant]),
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

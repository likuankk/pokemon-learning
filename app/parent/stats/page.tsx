'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { itemEmojis, itemLabels } from '@/lib/game-logic'

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

const subjectColorMap: Record<string, { bg: string; bar: string; text: string }> = {
  '语文': { bg: 'bg-red-50 border-red-200',   bar: 'bg-red-400',    text: 'text-red-700'    },
  '数学': { bg: 'bg-blue-50 border-blue-200',  bar: 'bg-blue-400',   text: 'text-blue-700'   },
  '英语': { bg: 'bg-green-50 border-green-200',bar: 'bg-green-400',  text: 'text-green-700'  },
  '科学': { bg: 'bg-purple-50 border-purple-200',bar:'bg-purple-400',text: 'text-purple-700' },
  '其他': { bg: 'bg-gray-50 border-gray-200',  bar: 'bg-gray-400',   text: 'text-gray-700'   },
}

interface StatsData {
  taskStats: { total: number; completed: number; pending: number; submitted: number; rejected: number }
  subjectStats: { subject: string; total: number; completed: number }[]
  weeklyStats: { day: string; count: number }[]
  pokemon: { name: string; species_id: number; vitality: number; wisdom: number; affection: number; level: number } | null
  recentApprovals: { title: string; subject: string; difficulty: number; last_updated: string; quality_score: number; review_comment: string }[]
}

interface WeeklyReport {
  weekRange: { start: string; end: string }
  completionRate: number
  totalTasks: number
  completedTasks: number
  subjectBreakdown: Record<string, { total: number; completed: number }>
  dailyStats: { day: string; count: number }[]
  streakDays: number
  allTimeCompleted: number
  bestQualityScore: number
  pokemon: {
    name: string; species_id: number; level: number
    evolution_stage: number; vitality: number; wisdom: number; affection: number
  } | null
}

function WeekChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const days = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div className="flex items-end gap-3 h-40">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100
        const date = new Date(d.day + 'T00:00:00')
        const dayLabel = days[date.getDay() === 0 ? 6 : date.getDay() - 1]
        const isToday = d.day === new Date().toISOString().split('T')[0]
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
            {d.count > 0 && (
              <span className="text-lg font-bold text-indigo-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                {d.count}
              </span>
            )}
            <div className="w-full rounded-t-xl overflow-hidden" style={{ height: 100, display: 'flex', alignItems: 'flex-end' }}>
              <motion.div
                className={`w-full rounded-t-xl ${isToday ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, d.count > 0 ? 8 : 4)}%` }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                style={{ minHeight: 4 }}
              />
            </div>
            <span
              className={`text-base font-bold ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
            >
              {dayLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/weekly-report').then(r => r.json()),
    ]).then(([statsData, reportData]) => {
      setData(statsData)
      setWeeklyReport(reportData)
      setLoading(false)
    })
  }, [])

  if (loading || !data) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-gray-400 text-3xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</p>
      </div>
    )
  }

  const { taskStats, subjectStats, weeklyStats, pokemon, recentApprovals } = data
  const completionRate = taskStats.total > 0
    ? Math.round((taskStats.completed / taskStats.total) * 100) : 0

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: '3.5rem', color: '#4338ca' }}>学习统计 📊</h1>
        <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>孩子的学习成果一览</p>
      </div>

      <div className="px-8 py-8 space-y-7">
        {/* Weekly Report Card */}
        {weeklyReport && (
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-7 text-white"
            style={{ boxShadow: '0 6px 0 rgba(79,46,220,0.4)' }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '2rem' }}>
                  📅 本周学习周报
                </h2>
                <p className="opacity-80 mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                  {weeklyReport.weekRange.start} — {weeklyReport.weekRange.end}
                </p>
              </div>
              {weeklyReport.pokemon && (
                <img
                  src={HOME_SPRITE(weeklyReport.pokemon.species_id)}
                  alt={weeklyReport.pokemon.name}
                  width={90} height={90}
                  style={{ width: 90, height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                />
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '本周完成率', value: `${weeklyReport.completionRate}%`, emoji: '🏆' },
                { label: '完成任务数', value: `${weeklyReport.completedTasks}/${weeklyReport.totalTasks}`, emoji: '✅' },
                { label: '连续打卡', value: `${weeklyReport.streakDays} 天`, emoji: '🔥' },
                { label: '累计完成', value: `${weeklyReport.allTimeCompleted} 个`, emoji: '🌟' },
              ].map(s => (
                <div key={s.label} className="bg-white/20 rounded-2xl p-4 text-center backdrop-blur-sm">
                  <div className="text-3xl mb-1">{s.emoji}</div>
                  <div className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>{s.value}</div>
                  <div className="opacity-80 text-sm mt-0.5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {weeklyReport.completionRate >= 80 && (
              <div className="mt-4 bg-white/20 rounded-2xl px-5 py-3 text-center">
                <p className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>
                  🎉 本周表现优秀！完成了 {weeklyReport.completionRate}% 的任务，宝可梦为你骄傲！
                </p>
              </div>
            )}
          </div>
        )}

        {/* Top stat cards */}
        <div className="grid grid-cols-4 gap-5">
          {[
            { label: '全部任务', value: taskStats.total,     emoji: '📋', bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca' },
            { label: '已完成',   value: taskStats.completed, emoji: '✅', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
            { label: '待完成',   value: taskStats.pending,   emoji: '⏳', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
            { label: '完成率',   value: `${completionRate}%`,emoji: '🏆', bg: '#fefce8', border: '#fde68a', text: '#d97706' },
          ].map((s, i) => (
            <motion.div key={s.label}
              className="rounded-3xl p-6 border-2"
              style={{ background: s.bg, borderColor: s.border, boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="text-5xl mb-3">{s.emoji}</div>
              <div className="font-bold mb-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '3rem', color: s.text }}>{s.value}</div>
              <div className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', color: '#6b7280' }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Weekly chart */}
          <div className="col-span-2 bg-white rounded-3xl border-2 border-gray-200 p-7"
            style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.05)' }}>
            <h2 className="game-label mb-6" style={{ fontSize: '1.75rem' }}>最近7天完成趋势</h2>
            <WeekChart data={weeklyStats} />
          </div>

          {/* Pokemon card */}
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 flex flex-col items-center"
            style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.05)' }}>
            <h2 className="game-label mb-4 w-full" style={{ fontSize: '1.75rem' }}>宝可梦状态</h2>
            {pokemon ? (
              <>
                <img
                  src={HOME_SPRITE(pokemon.species_id)}
                  alt={pokemon.name}
                  width={160} height={160}
                  style={{ width: 160, height: 160, objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.25))' }}
                />
                <p className="game-label mt-3" style={{ fontSize: '1.5rem' }}>{pokemon.name}</p>
                <p className="font-bold mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem', color: '#6366f1' }}>
                  Lv.{pokemon.level}
                </p>
                <div className="w-full mt-4 space-y-3">
                  {[
                    { label: '❤️ 体力', value: pokemon.vitality, color: '#f43f5e' },
                    { label: '💡 智慧', value: pokemon.wisdom,   color: '#3b82f6' },
                    { label: '💕 亲密', value: pokemon.affection,color: '#ec4899' },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-gray-600" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>{s.label}</span>
                        <span className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem', color: s.color }}>{Math.round(s.value)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                        <motion.div
                          className="h-4 rounded-full"
                          style={{ background: s.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${s.value}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>暂无数据</p>
            )}
          </div>
        </div>

        {/* Subject breakdown */}
        <div className="bg-white rounded-3xl border-2 border-gray-200 p-7"
          style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.05)' }}>
          <h2 className="game-label mb-6" style={{ fontSize: '1.75rem' }}>各科目完成情况</h2>
          {subjectStats.length === 0 ? (
            <p className="text-gray-400 text-xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>暂无数据</p>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              {subjectStats.map(s => {
                const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
                const colors = subjectColorMap[s.subject] || subjectColorMap['其他']
                return (
                  <div key={s.subject} className={`rounded-2xl border-2 p-5 ${colors.bg}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`font-bold ${colors.text}`} style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.4rem' }}>
                        {s.subject}
                      </span>
                      <span className="font-bold text-gray-500" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
                        {s.completed}/{s.total} · {pct}%
                      </span>
                    </div>
                    <div className="w-full bg-white/70 rounded-full h-5 overflow-hidden border border-white">
                      <motion.div
                        className={`h-5 rounded-full ${colors.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8 }}
                        style={{ boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent approvals */}
        {recentApprovals.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-7"
            style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.05)' }}>
            <h2 className="game-label mb-6" style={{ fontSize: '1.75rem' }}>最近通过的任务 🏅</h2>
            <div className="space-y-3">
              {recentApprovals.map((r, i) => (
                <motion.div key={i}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100"
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <span className="text-3xl">{'⭐'.repeat(r.quality_score || 3)}</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem' }}>{r.title}</p>
                    {r.review_comment && (
                      <p className="text-gray-500 mt-0.5" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>"{r.review_comment}"</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${(subjectColorMap[r.subject] || subjectColorMap['其他']).bg}`}
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                    {r.subject}
                  </span>
                  <span className="text-gray-400 text-base" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {r.last_updated?.slice(0, 10)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { itemEmojis, itemLabels } from '@/lib/game-logic'
import { useToast } from '@/components/ToastProvider'

interface Task {
  id: number
  title: string
  subject: string
  status: string
  difficulty: number
  due_date: string
  estimated_minutes: number
}

const ITEM_TYPES = ['food', 'crystal', 'candy', 'fragment'] as const

export default function ParentPage() {
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showRewardPanel, setShowRewardPanel] = useState(false)
  const [rewardItem, setRewardItem] = useState<string>('food')
  const [rewardQty, setRewardQty] = useState(1)
  const [rewardMsg, setRewardMsg] = useState('')
  const [sendingReward, setSendingReward] = useState(false)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => { setTasks(data.tasks || []); setLoading(false) })
  }, [])

  const pending = tasks.filter(t => t.status === 'pending').length
  const submitted = tasks.filter(t => t.status === 'submitted').length
  const approved = tasks.filter(t => t.status === 'approved').length
  const total = tasks.length

  const handleSendReward = async () => {
    setSendingReward(true)
    try {
      const res = await fetch('/api/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: rewardItem, quantity: rewardQty, message: rewardMsg }),
      })
      if (res.ok) {
        showToast(`🎁 已发送 ${rewardQty} 个 ${itemLabels[rewardItem]}！`, 'reward', itemEmojis[rewardItem])
        setShowRewardPanel(false)
        setRewardMsg('')
        setRewardQty(1)
      } else {
        showToast('发送失败，请重试', 'error', '❌')
      }
    } catch {
      showToast('网络错误', 'error', '❌')
    }
    setSendingReward(false)
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="game-title-indigo leading-tight" style={{ fontSize: '3.5rem', color: '#4338ca' }}>今日概览 👩‍👦</h1>
            <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>小明家的学习情况</p>
          </div>
          <button
            onClick={() => setShowRewardPanel(!showRewardPanel)}
            className="bg-gradient-to-r from-pink-400 to-orange-400 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', boxShadow: '0 4px 0 #c2410c' }}
          >
            🎁 手动奖励
          </button>
        </div>
      </div>

      {/* Manual reward panel */}
      <AnimatePresence>
        {showRewardPanel && (
          <motion.div
            className="border-b-4 border-orange-100 bg-orange-50 px-8 py-6"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <h3 className="font-bold text-orange-800 mb-4" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
              🎁 给小明发送奖励道具
            </h3>
            <div className="flex items-start gap-6">
              {/* Item select */}
              <div>
                <p className="font-bold text-gray-600 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>选择道具</p>
                <div className="grid grid-cols-2 gap-3">
                  {ITEM_TYPES.map(item => (
                    <button
                      key={item}
                      onClick={() => setRewardItem(item)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-bold transition-all ${
                        rewardItem === item
                          ? 'bg-orange-400 text-white border-orange-400'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                      }`}
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
                    >
                      <span className="text-2xl">{itemEmojis[item]}</span>
                      {itemLabels[item]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <p className="font-bold text-gray-600 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>数量</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRewardQty(Math.max(1, rewardQty - 1))}
                    className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 text-2xl font-bold hover:bg-gray-50 transition-colors"
                  >−</button>
                  <span className="text-4xl font-bold text-orange-600 w-12 text-center" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{rewardQty}</span>
                  <button
                    onClick={() => setRewardQty(Math.min(10, rewardQty + 1))}
                    className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 text-2xl font-bold hover:bg-gray-50 transition-colors"
                  >+</button>
                </div>
              </div>

              {/* Message */}
              <div className="flex-1">
                <p className="font-bold text-gray-600 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>留言（可选）</p>
                <input
                  type="text"
                  value={rewardMsg}
                  onChange={e => setRewardMsg(e.target.value)}
                  placeholder="妈妈爱你！好好加油哦～"
                  className="w-full border-2 border-orange-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-4 focus:ring-orange-300"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
                />
              </div>

              {/* Send button */}
              <div className="flex flex-col justify-end" style={{ paddingTop: 32 }}>
                <motion.button
                  onClick={handleSendReward}
                  disabled={sendingReward}
                  className="bg-gradient-to-r from-orange-400 to-pink-400 text-white font-bold px-8 py-3 rounded-2xl transition-all disabled:opacity-50"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.25rem', boxShadow: '0 4px 0 #c2410c' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97, y: 2 }}
                >
                  {sendingReward ? '发送中...' : '💝 发送奖励'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-8 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '全部任务', value: total, emoji: '📋', bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700' },
            { label: '待完成', value: pending, emoji: '⏳', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
            { label: '待审核', value: submitted, emoji: '🔔', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', badge: submitted > 0 },
            { label: '已通过', value: approved, emoji: '✅', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
          ].map(({ label, value, emoji, bg, border, text, badge }) => (
            <motion.div
              key={label}
              className={`${bg} border-2 ${border} rounded-3xl p-6 relative`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              {badge && value > 0 && (
                <span className="absolute top-4 right-4 bg-red-500 text-white text-xl w-10 h-10 rounded-full flex items-center justify-center font-bold">
                  {value}
                </span>
              )}
              <div className="text-5xl mb-3">{emoji}</div>
              <div className={`text-6xl font-bold ${text} mb-2`}>{value}</div>
              <div className="text-xl text-gray-500 font-semibold">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Actions + Recent Tasks */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <h2 className="text-2xl font-bold text-gray-500 uppercase tracking-widest">快捷操作</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/parent/tasks/new">
                <motion.div
                  className="bg-indigo-500 hover:bg-indigo-600 rounded-3xl p-7 text-white cursor-pointer transition-colors h-44 flex flex-col justify-between"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  <span className="text-6xl">➕</span>
                  <div>
                    <div className="font-bold text-2xl">创建新任务</div>
                    <div className="text-indigo-200 text-lg">给小明布置作业</div>
                  </div>
                </motion.div>
              </Link>

              <Link href="/parent/review">
                <motion.div
                  className="bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-3xl p-7 cursor-pointer transition-colors h-44 flex flex-col justify-between relative"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  {submitted > 0 && (
                    <span className="absolute top-5 right-5 bg-red-500 text-white text-lg px-3 py-1 rounded-full font-bold">
                      {submitted} 条
                    </span>
                  )}
                  <span className="text-6xl">📝</span>
                  <div>
                    <div className="font-bold text-gray-800 text-2xl">审核中心</div>
                    <div className="text-gray-400 text-lg">查看孩子的提交</div>
                  </div>
                </motion.div>
              </Link>

              <Link href="/parent/tasks">
                <motion.div
                  className="bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-3xl p-7 cursor-pointer transition-colors h-44 flex flex-col justify-between"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  <span className="text-6xl">📚</span>
                  <div>
                    <div className="font-bold text-gray-800 text-2xl">任务列表</div>
                    <div className="text-gray-400 text-lg">管理所有学习任务</div>
                  </div>
                </motion.div>
              </Link>

              <Link href="/parent/stats">
                <motion.div
                  className="bg-gradient-to-br from-pink-50 to-orange-50 hover:from-pink-100 hover:to-orange-100 border-2 border-pink-100 rounded-3xl p-7 cursor-pointer h-44 flex flex-col justify-between"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  <span className="text-6xl">📊</span>
                  <div>
                    <div className="font-bold text-gray-700 text-2xl">学习统计</div>
                    <div className="text-gray-400 text-lg">
                      {total > 0 ? `已完成 ${approved}/${total} 个任务` : '还没有任务哦'}
                    </div>
                  </div>
                </motion.div>
              </Link>
            </div>
          </div>

          {/* Recent Tasks */}
          <div>
            <h2 className="text-2xl font-bold text-gray-500 uppercase tracking-widest mb-4">最近任务</h2>
            <div className="space-y-3">
              {loading ? (
                <div className="text-gray-400 text-xl py-4 text-center">加载中...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-3xl border-2 border-gray-100">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-gray-400 text-xl">还没有任务</p>
                  <Link href="/parent/tasks/new" className="text-indigo-500 text-xl mt-2 inline-block hover:underline font-bold">
                    创建第一个 →
                  </Link>
                </div>
              ) : (
                tasks.slice(0, 5).map(task => (
                  <div key={task.id} className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:shadow-sm transition-shadow">
                    <p className="font-bold text-gray-800 text-xl mb-2 leading-tight">{task.title}</p>
                    <div className="flex items-center gap-2 text-base text-gray-400">
                      <span className="bg-gray-100 px-3 py-1 rounded-full font-semibold">{task.subject}</span>
                      <span>{task.due_date}</span>
                      <span className={`ml-auto px-3 py-1 rounded-full text-base font-semibold ${
                        task.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                        task.status === 'approved' ? 'bg-green-100 text-green-700' :
                        task.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {task.status === 'submitted' ? '待审核' :
                         task.status === 'approved' ? '已通过' :
                         task.status === 'rejected' ? '需重做' : '待完成'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

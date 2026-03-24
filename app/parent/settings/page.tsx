'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSession } from '@/components/SessionProvider'
import { useToast } from '@/components/ToastProvider'

export default function SettingsPage() {
  const router = useRouter()
  const { user, refresh } = useSession()
  const { showToast } = useToast()
  const [curfewStart, setCurfewStart] = useState(21)
  const [curfewEnd, setCurfewEnd] = useState(7)
  const [warningMinutes, setWarningMinutes] = useState(20)
  const [limitMinutes, setLimitMinutes] = useState(30)
  const [quizDisplayMode, setQuizDisplayMode] = useState<'normal' | 'large'>('normal')
  const [inviteCode, setInviteCode] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/anti-addiction').then(r => r.json()),
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_invite_code' }),
      }).then(r => r.json()),
    ]).then(([antiData, authData]) => {
      if (antiData.curfewStart !== undefined) setCurfewStart(antiData.curfewStart)
      if (antiData.curfewEnd !== undefined) setCurfewEnd(antiData.curfewEnd)
      if (antiData.warningMinutes !== undefined) setWarningMinutes(antiData.warningMinutes)
      if (antiData.limitMinutes !== undefined) setLimitMinutes(antiData.limitMinutes)
      if (antiData.quizDisplayMode) setQuizDisplayMode(antiData.quizDisplayMode)
      if (authData.inviteCode) setInviteCode(authData.inviteCode)
      if (authData.members) setMembers(authData.members)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/anti-addiction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_settings',
        curfewStart,
        curfewEnd,
        warningMinutes,
        limitMinutes,
        quizDisplayMode,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('设置保存成功！')
      showToast('✅ 设置保存成功！', 'success')
    } else {
      setMessage(data.error || '保存失败')
      showToast('❌ ' + (data.error || '保存失败'), 'error')
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    refresh()
    router.push('/auth')
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#4338ca' }}>家庭设置 ⚙️</h1>
        <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem' }}>
          管理家庭成员、防沉迷和账号
        </p>
      </div>

      <div className="px-4 md:px-8 py-8 max-w-2xl">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-2xl">加载中...</div>
        ) : (
          <>
            {message && (
              <motion.div
                className={`rounded-2xl px-5 py-3 mb-6 font-bold border-2 ${
                  message.includes('成功') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
              >
                {message}
              </motion.div>
            )}

            {/* Family Members */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 mb-6" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-4xl">👨‍👩‍👧‍👦</span>
                <div>
                  <h2 className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
                    家庭成员
                  </h2>
                  <p className="text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                    当前家庭的所有成员
                  </p>
                </div>
              </div>

              {members.length > 0 && (
                <div className="space-y-2 mb-4">
                  {members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <span className="text-2xl">{m.role === 'parent' ? '👩‍👦' : '🧒'}</span>
                      <span className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.15rem' }}>
                        {m.name}
                      </span>
                      <span className="text-gray-400 text-sm ml-auto" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                        {m.role === 'parent' ? '家长' : '小朋友'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {inviteCode && (
                <div className="bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <p className="text-indigo-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                      📮 家庭邀请码：<span className="tracking-wider">{inviteCode}</span>
                    </p>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(inviteCode); showToast('📋 邀请码已复制！', 'success') }}
                      className="text-indigo-500 hover:text-indigo-700 font-bold text-sm px-3 py-1 rounded-lg hover:bg-indigo-100 transition-all"
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                    >
                      复制
                    </button>
                  </div>
                  <p className="text-indigo-400 text-sm mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    将邀请码告诉孩子，孩子登录时可使用
                  </p>
                </div>
              )}
            </div>

            {/* Curfew Settings */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 mb-6" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-4xl">🌙</span>
                <div>
                  <h2 className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
                    宵禁时间
                  </h2>
                  <p className="text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                    在此时间段内，孩子无法使用应用
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-gray-500 mb-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                    开始时间
                  </label>
                  <select
                    value={curfewStart}
                    onChange={e => setCurfewStart(parseInt(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-xl font-bold focus:outline-none focus:ring-4 focus:ring-indigo-200"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <span className="text-3xl text-gray-300 mt-8">→</span>
                <div className="flex-1">
                  <label className="block text-gray-500 mb-2 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                    结束时间
                  </label>
                  <select
                    value={curfewEnd}
                    onChange={e => setCurfewEnd(parseInt(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-xl font-bold focus:outline-none focus:ring-4 focus:ring-indigo-200"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
                <p className="text-indigo-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                  🌙 当前设置：每天 {String(curfewStart).padStart(2, '0')}:00 ~ 次日 {String(curfewEnd).padStart(2, '0')}:00 禁止使用
                </p>
              </div>
            </div>

            {/* Time Limit Settings */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 mb-6" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-4xl">⏱️</span>
                <div>
                  <h2 className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
                    每日使用时长
                  </h2>
                  <p className="text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                    控制每天使用应用的时间上限
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                      ⚠️ 提醒阈值
                    </span>
                    <span className="text-yellow-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
                      {warningMinutes} 分钟
                    </span>
                  </label>
                  <input
                    type="range"
                    min={5} max={120} step={5}
                    value={warningMinutes}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      setWarningMinutes(v)
                      if (v >= limitMinutes) setLimitMinutes(v + 10)
                    }}
                    className="w-full h-3 bg-yellow-100 rounded-full appearance-none cursor-pointer accent-yellow-500"
                  />
                  <p className="text-gray-400 text-sm mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    达到此时间后显示温馨提醒
                  </p>
                </div>

                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                      ⛔ 强制限制
                    </span>
                    <span className="text-red-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}>
                      {limitMinutes} 分钟
                    </span>
                  </label>
                  <input
                    type="range"
                    min={10} max={180} step={5}
                    value={limitMinutes}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      setLimitMinutes(v)
                      if (v <= warningMinutes) setWarningMinutes(v - 5)
                    }}
                    className="w-full h-3 bg-red-100 rounded-full appearance-none cursor-pointer accent-red-500"
                  />
                  <p className="text-gray-400 text-sm mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    达到此时间后禁止继续使用
                  </p>
                </div>
              </div>

              <div className="mt-4 bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                <p className="text-blue-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                  📊 使用 {warningMinutes} 分钟后提醒 → 使用 {limitMinutes} 分钟后强制停止
                </p>
              </div>
            </div>

            {/* Quiz Display Mode */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-7 mb-6" style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-4xl">🔤</span>
                <div>
                  <h2 className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.75rem' }}>
                    答题显示模式
                  </h2>
                  <p className="text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                    控制答题和讲解界面的字体大小
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setQuizDisplayMode('normal')}
                  className={`rounded-2xl p-5 border-2 transition-all text-center ${
                    quizDisplayMode === 'normal'
                      ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <span className="block text-3xl mb-2">Aa</span>
                  <span className="font-bold block" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem', color: quizDisplayMode === 'normal' ? '#4338ca' : '#6b7280' }}>
                    正常模式
                  </span>
                  <span className="text-gray-400 block mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.85rem' }}>
                    适合平板/电脑
                  </span>
                </button>
                <button
                  onClick={() => setQuizDisplayMode('large')}
                  className={`rounded-2xl p-5 border-2 transition-all text-center ${
                    quizDisplayMode === 'large'
                      ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <span className="block text-5xl mb-2">Aa</span>
                  <span className="font-bold block" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem', color: quizDisplayMode === 'large' ? '#4338ca' : '#6b7280' }}>
                    放大模式
                  </span>
                  <span className="text-gray-400 block mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.85rem' }}>
                    适合投影仪/电视
                  </span>
                </button>
              </div>

              <div className="mt-4 bg-purple-50 rounded-xl px-4 py-3 border border-purple-100">
                <p className="text-purple-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
                  {quizDisplayMode === 'normal'
                    ? '📱 正常模式：题目和选项使用标准字体大小'
                    : '🖥️ 放大模式：题目和选项使用超大字体，适合远距离观看'}
                </p>
              </div>
            </div>

            {/* Save Button */}
            <motion.button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-5 rounded-2xl transition-all disabled:opacity-50 mb-6"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', boxShadow: '0 5px 0 #3730a3' }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {saving ? '保存中...' : '保存设置 ✓'}
            </motion.button>

            <div className="bg-yellow-50 rounded-2xl border-2 border-yellow-200 p-5 mb-6">
              <p className="text-yellow-700 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                💡 建议：6-12岁儿童每天使用电子设备不超过1小时，适当休息保护眼睛。
              </p>
            </div>

            {/* Logout */}
            <div className="border-t-2 border-gray-200 pt-6">
              <button
                onClick={handleLogout}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition-all border-2 border-gray-200"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.3rem' }}
              >
                退出登录
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSession } from '@/components/SessionProvider'

export default function AuthPage() {
  const router = useRouter()
  const { refresh } = useSession()
  const [role, setRole] = useState<'parent' | 'child'>('parent')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        name, password, role,
      }),
    })
    const data = await res.json()
    if (res.ok && data.success) {
      refresh()
      const actualRole = data.user.role
      if (actualRole === 'parent') {
        router.push('/parent')
      } else {
        // 老用户登录，标记 onboarding 已完成（跳过检查）
        document.cookie = 'onboarding_completed=1; path=/; max-age=31536000'
        router.push('/child')
      }
    } else {
      setError(data.error || '登录失败')
    }
    setLoading(false)
  }

  const handleDemoLogin = async (demoRole: string) => {
    setLoading(true)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'demo_login', role: demoRole }),
    })
    const data = await res.json()
    if (res.ok && data.success) {
      refresh()
      if (data.user.role === 'child') {
        document.cookie = 'onboarding_completed=1; path=/; max-age=31536000'
      }
      router.push(data.user.role === 'parent' ? '/parent' : '/child')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600">
      <motion.div
        className="bg-white rounded-3xl p-10 w-full max-w-md shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      >
        <h1 className="game-label text-center mb-2" style={{ fontSize: '2.5rem' }}>
          登录
        </h1>
        <p className="text-center text-gray-400 mb-8" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
          宝可梦学习乐园
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role select */}
          <div className="flex gap-3">
            {[
              { key: 'parent', label: '👩‍👦 家长', color: 'indigo' },
              { key: 'child', label: '🧒 小朋友', color: 'yellow' },
            ].map(r => (
              <button key={r.key} type="button"
                onClick={() => setRole(r.key as any)}
                className={`flex-1 py-4 rounded-2xl font-bold border-2 transition-all ${
                  role === r.key ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200'
                }`}
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="你的名字" required
            className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-xl focus:outline-none focus:ring-4 focus:ring-indigo-300"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
          />

          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="密码" required
            className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-xl focus:outline-none focus:ring-4 focus:ring-indigo-300"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
          />

          {error && <p className="text-red-500 text-center font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-5 rounded-2xl transition-all disabled:opacity-50"
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.5rem', boxShadow: '0 5px 0 #3730a3' }}
          >
            {loading ? '请稍候...' : '登录'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t-2 border-gray-100">
          <p className="text-center text-gray-400 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}>
            或者快速体验
          </p>
          <div className="flex gap-3">
            <button onClick={() => handleDemoLogin('parent')} disabled={loading}
              className="flex-1 bg-indigo-50 text-indigo-600 font-bold py-3 rounded-xl border-2 border-indigo-200 hover:bg-indigo-100 transition-all"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
            >
              👩‍👦 家长体验
            </button>
            <button onClick={() => handleDemoLogin('child')} disabled={loading}
              className="flex-1 bg-yellow-50 text-yellow-600 font-bold py-3 rounded-xl border-2 border-yellow-200 hover:bg-yellow-100 transition-all"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}
            >
              🧒 孩子体验
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

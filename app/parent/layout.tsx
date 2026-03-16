'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ToastProvider } from '@/components/ToastProvider'
import NotificationBell from '@/components/NotificationBell'
import { useSession } from '@/components/SessionProvider'

interface NavItem {
  href: string
  label: string
  emoji: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { href: '/parent', label: '首页概览', emoji: '🏠', exact: true },
  { href: '/parent/tasks', label: '任务列表', emoji: '📚', exact: true },
  { href: '/parent/tasks/new', label: '创建任务', emoji: '➕' },
  { href: '/parent/review', label: '审核中心', emoji: '📝' },
  { href: '/parent/stats', label: '学习统计', emoji: '📊' },
  { href: '/parent/honor', label: '荣誉榜', emoji: '🏆' },
  { href: '/parent/weekend', label: '周末挑战', emoji: '🎯' },
  { href: '/parent/settings', label: '家庭设置', emoji: '⚙️' },
]

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useSession()
  const [submittedCount, setSubmittedCount] = useState(0)

  useEffect(() => {
    const load = () => {
      fetch('/api/tasks?status=submitted')
        .then(r => r.json())
        .then(d => setSubmittedCount((d.tasks || []).length))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 flex flex-col h-full overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 40%, #3730a3 100%)' }}>

        {/* Logo */}
        <div className="px-6 pt-8 pb-5">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-4xl">🎮</span>
            <span
              className="game-label-white font-bold leading-tight"
              style={{ fontSize: '1.5rem', textShadow: '2px 2px 0 rgba(0,0,0,0.4)' }}
            >
              宝可梦<br/>学习乐园
            </span>
          </div>
          {/* Identity card */}
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <span className="text-4xl">👩‍👦</span>
            <div>
              <p className="game-label-white font-bold" style={{ fontSize: '1.5rem' }}>{user?.name || '家长'}</p>
              <p className="text-indigo-300 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>家长身份</p>
            </div>
          </div>
        </div>

        {/* Nav divider */}
        <div className="mx-6 border-t border-indigo-600/50 mb-3" />

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map(item => {
            const active = isActive(item)
            const badge = item.href === '/parent/review' && submittedCount > 0 ? submittedCount : 0
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all relative ${
                  active
                    ? 'text-indigo-900'
                    : 'text-indigo-200 hover:text-white'
                }`}
                style={active ? {
                  background: 'linear-gradient(135deg, #fff 0%, #e0e7ff 100%)',
                  boxShadow: '0 4px 0 rgba(0,0,0,0.2), 0 6px 12px rgba(0,0,0,0.15)',
                } : {
                  background: 'transparent',
                } as React.CSSProperties}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span className="text-2xl">{item.emoji}</span>
                <span style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.4rem' }}>{item.label}</span>
                {badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-base w-9 h-9 rounded-full flex items-center justify-center font-bold"
                    style={{ boxShadow: '0 3px 0 #991b1b', fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-4 pb-8">
          <div className="border-t border-indigo-600/50 mb-3 pt-3">
            <Link
              href="/"
              className="flex items-center gap-3 px-5 py-4 rounded-2xl text-indigo-300 hover:text-white transition-all font-bold"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.35rem' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="text-2xl">←</span>
              <span>切换身份</span>
            </Link>
            <button
              onClick={async () => {
                await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'logout' }),
                })
                window.location.href = '/auth'
              }}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl text-indigo-300 hover:text-white transition-all font-bold w-full text-left"
              style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.35rem' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="text-2xl">🚪</span>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute top-4 right-4 z-40">
          <NotificationBell />
        </div>
        <ToastProvider>
          {children}
        </ToastProvider>
      </main>
    </div>
  )
}

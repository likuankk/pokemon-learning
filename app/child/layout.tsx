'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getPokemonStatus, statusLabels } from '@/lib/game-logic'
import { motion } from 'framer-motion'
import { ToastProvider } from '@/components/ToastProvider'
import AntiAddictionBanner from '@/components/AntiAddictionBanner'
import NotificationBell from '@/components/NotificationBell'
import { useSession } from '@/components/SessionProvider'

interface NavItem {
  href: string
  label: string
  emoji: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { href: '/child', label: '宝可梦小屋', emoji: '🏠', exact: true },
  { href: '/child/tasks', label: '今日任务', emoji: '📋' },
  { href: '/child/evolve', label: '进化工坊', emoji: '✨' },
  { href: '/child/planner', label: '时间规划', emoji: '🗓️' },
  { href: '/child/feed', label: '喂养宝可梦', emoji: '🍖' },
  { href: '/child/pokedex', label: '图鉴成就', emoji: '🏅' },
  { href: '/child/house', label: '小屋装饰', emoji: '🪑' },
  { href: '/child/battle', label: '宝可梦战斗', emoji: '⚔️' },
  { href: '/child/letter', label: '宝可梦的信', emoji: '💌' },
]

interface PokemonSummary {
  name: string
  species_id: number
  vitality: number
  wisdom: number
  affection: number
  level: number
}

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useSession()
  const [pokemon, setPokemon] = useState<PokemonSummary | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const load = () => {
      fetch('/api/pokemon')
        .then(r => r.json())
        .then(d => { if (d.pokemon) setPokemon(d.pokemon) })
        .catch(() => {})
      fetch('/api/tasks?status=pending')
        .then(r => r.json())
        .then(d => setPendingCount((d.tasks || []).length))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const statusKey = pokemon
    ? getPokemonStatus(pokemon.vitality, pokemon.wisdom, pokemon.affection)
    : 'good'

  const statusBadgeStyle: Record<string, React.CSSProperties> = {
    energetic: { background: 'linear-gradient(135deg, #fde68a, #fbbf24)', color: '#78350f', boxShadow: '0 2px 0 #b45309' },
    good:      { background: 'linear-gradient(135deg, #a7f3d0, #34d399)', color: '#064e3b', boxShadow: '0 2px 0 #047857' },
    tired:     { background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', color: '#334155', boxShadow: '0 2px 0 #94a3b8' },
    sad:       { background: 'linear-gradient(135deg, #fecaca, #f87171)', color: '#7f1d1d', boxShadow: '0 2px 0 #b91c1c' },
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 flex flex-col h-full overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0d4f3c 0%, #065f46 40%, #047857 100%)' }}>

        {/* Pokemon Summary */}
        <div className="px-5 pt-7 pb-4">
          {pokemon ? (
            <div className="flex flex-col items-center rounded-3xl p-4"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              {/* 3D pokemon mini */}
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: statusKey === 'energetic'
                      ? 'radial-gradient(ellipse, rgba(251,191,36,0.4) 0%, transparent 70%)'
                      : 'radial-gradient(ellipse, rgba(52,211,153,0.3) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                    transform: 'scale(1.4)',
                  }}
                />
                <motion.img
                  src={HOME_SPRITE(pokemon.species_id)}
                  alt={pokemon.name}
                  width={120}
                  height={120}
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.4))',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                />
              </div>
              <p
                className="game-label-white font-bold mt-2"
                style={{ fontSize: '1.6rem' }}
              >
                {pokemon.name}
              </p>
              <p
                className="font-bold mb-2"
                style={{
                  fontFamily: "'ZCOOL KuaiLe', sans-serif",
                  fontSize: '1.2rem',
                  color: '#6ee7b7',
                  textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
                }}
              >
                Lv.{pokemon.level}
              </p>
              <span
                className="px-4 py-1.5 rounded-full font-bold"
                style={{
                  fontFamily: "'ZCOOL KuaiLe', sans-serif",
                  fontSize: '1.1rem',
                  ...(statusBadgeStyle[statusKey] || statusBadgeStyle.good),
                }}
              >
                {statusLabels[statusKey as keyof typeof statusLabels]}
              </span>
            </div>
          ) : (
            <div className="rounded-3xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <p className="text-teal-200 text-2xl" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载中...</p>
            </div>
          )}
        </div>

        {/* Nav divider */}
        <div className="mx-5 border-t border-teal-600/50 mb-2" />

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map(item => {
            const active = isActive(item)
            const badge = item.href === '/child/tasks' && pendingCount > 0 ? pendingCount : 0
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all relative ${
                  active ? 'text-teal-900' : 'text-teal-100 hover:text-white'
                }`}
                style={active ? {
                  background: 'linear-gradient(135deg, #fff 0%, #ccfbf1 100%)',
                  boxShadow: '0 4px 0 rgba(0,0,0,0.2), 0 6px 12px rgba(0,0,0,0.15)',
                } : {} as React.CSSProperties}
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
                  <span
                    className="ml-auto text-white w-9 h-9 rounded-full flex items-center justify-center font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #fb923c, #f97316)',
                      boxShadow: '0 3px 0 #c2410c',
                      fontFamily: "'ZCOOL KuaiLe', sans-serif",
                      fontSize: '1.1rem',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-4 pb-8">
          <div className="border-t border-teal-600/50 mb-3 pt-3">
            <button
              onClick={async () => {
                await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'logout' }),
                })
                window.location.href = '/auth'
              }}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl text-teal-300 hover:text-white transition-all font-bold w-full text-left"
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
        <AntiAddictionBanner />
      </main>
    </div>
  )
}

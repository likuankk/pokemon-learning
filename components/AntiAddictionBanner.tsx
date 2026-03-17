'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AntiAddictionBanner() {
  const [status, setStatus] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const check = () => {
      fetch('/api/anti-addiction').then(r => r.json()).then(data => {
        setStatus(data)
      }).catch(() => {})
    }
    check()
    // Heartbeat every 60 seconds
    const t = setInterval(() => {
      fetch('/api/anti-addiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat' }),
      }).then(r => r.json()).then(data => setStatus(data)).catch(() => {})
    }, 60000)

    // Start session
    fetch('/api/anti-addiction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    }).catch(() => {})

    return () => {
      clearInterval(t)
      // End session on unmount
      fetch('/api/anti-addiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
      }).catch(() => {})
    }
  }, [])

  if (!status || dismissed) return null

  const { tier, isCurfew, todayMinutes, limitMinutes } = status

  if (tier === 'normal' && !isCurfew) return null

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl border-2 flex items-center gap-3 shadow-lg ${
          isCurfew || tier === 'limit'
            ? 'bg-red-50 border-red-300 text-red-700'
            : 'bg-yellow-50 border-yellow-300 text-yellow-700'
        }`}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
      >
        <span className="text-2xl">{isCurfew || tier === 'limit' ? '⛔' : '⏰'}</span>
        <p className="font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
          {isCurfew
            ? '现在是休息时间（21:00-07:00），明天再来吧！'
            : tier === 'limit'
            ? `今天已使用${todayMinutes}分钟，已达上限（${limitMinutes}分钟），休息一下吧！`
            : `已使用${todayMinutes}分钟，注意休息哦～`
          }
        </p>
        {tier === 'warning' && (
          <button
            onClick={() => setDismissed(true)}
            className="text-yellow-500 hover:text-yellow-700 text-xl font-bold ml-2"
          >
            ✕
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

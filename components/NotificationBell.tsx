'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  message: string
  read: number
  created_at: string
}

export default function NotificationBell({ userId }: { userId?: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    fetch(`/api/notifications?userId=${userId || 2}`).then(r => r.json()).then(data => {
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    }).catch(() => {})
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [userId])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleReadAll = async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read_all', userId: userId || 2 }),
    })
    load()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-all"
      >
        <span className="text-2xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border-2 border-gray-200 shadow-xl z-50 overflow-hidden"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-gray-800" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
                通知 ({unreadCount})
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleReadAll}
                  className="text-sm text-indigo-500 hover:text-indigo-700 font-bold"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                >
                  全部已读
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  暂无通知
                </div>
              ) : (
                notifications.slice(0, 20).map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-gray-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                  >
                    <p className="font-bold text-gray-800 text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      {n.title}
                    </p>
                    <p className="text-gray-500 text-xs mt-1" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                      {n.message}
                    </p>
                    <p className="text-gray-300 text-xs mt-1">{n.created_at?.slice(0, 16)}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

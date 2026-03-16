'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type ToastType = 'success' | 'error' | 'info' | 'reward'

interface Toast {
  id: number
  message: string
  type: ToastType
  emoji?: string
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, emoji?: string) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

let nextId = 0

const toastStyles: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  error:   { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-800'   },
  info:    { bg: 'bg-blue-50',  border: 'border-blue-300',  text: 'text-blue-800'  },
  reward:  { bg: 'bg-yellow-50',border: 'border-yellow-300',text: 'text-yellow-800'},
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info', emoji?: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type, emoji }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => {
            const style = toastStyles[toast.type]
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl border-2 shadow-lg ${style.bg} ${style.border}`}
                style={{
                  fontFamily: "'ZCOOL KuaiLe', sans-serif",
                  fontSize: '1.25rem',
                  boxShadow: '0 4px 0 rgba(0,0,0,0.1), 0 6px 16px rgba(0,0,0,0.1)',
                  minWidth: 240,
                  maxWidth: 360,
                }}
              >
                {toast.emoji && <span className="text-2xl flex-shrink-0">{toast.emoji}</span>}
                <span className={`font-bold ${style.text}`}>{toast.message}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

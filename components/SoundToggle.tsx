'use client'

import { useState, useEffect } from 'react'
import { getSoundManager } from '@/lib/sound-manager'

export default function SoundToggle() {
  const [muted, setMuted] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMuted(getSoundManager().muted)
    setMounted(true)
  }, [])

  const toggle = () => {
    const newMuted = getSoundManager().toggleMute()
    setMuted(newMuted)
  }

  if (!mounted) return null

  return (
    <button
      onClick={toggle}
      className="text-2xl hover:scale-110 active:scale-95 transition-transform"
      title={muted ? '开启声音' : '关闭声音'}
      aria-label={muted ? '开启声音' : '关闭声音'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}

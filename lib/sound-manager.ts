// 宝可梦声音管理器 — Web Audio API 合成音效 + PokeAPI 原版叫声
// 单例模式，全局共享 AudioContext

import type { PokemonStatus } from './game-logic'

const CRY_URL = (speciesId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${speciesId}.ogg`

class SoundManager {
  private ctx: AudioContext | null = null
  private cryCache = new Map<number, AudioBuffer>()
  private cryLoadingMap = new Map<number, Promise<AudioBuffer | null>>()
  private _muted = false
  private _volume = 0.5
  private initialized = false

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this._muted = localStorage.getItem('pokemon_sound_muted') === 'true'
        const vol = localStorage.getItem('pokemon_sound_volume')
        if (vol) this._volume = parseFloat(vol)
      } catch {}
    }
  }

  // ── AudioContext lazy init (requires user gesture) ──
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  // ── Public API: Mute & Volume ──

  get muted() { return this._muted }
  get volume() { return this._volume }

  toggleMute(): boolean {
    this._muted = !this._muted
    try { localStorage.setItem('pokemon_sound_muted', String(this._muted)) } catch {}
    return this._muted
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v))
    try { localStorage.setItem('pokemon_sound_volume', String(this._volume)) } catch {}
  }

  // ── Pokemon Cry (PokeAPI .ogg) ──

  async playCry(speciesId: number, options?: { rate?: number; volume?: number }) {
    if (this._muted) return
    const ctx = this.ensureContext()

    let buffer = this.cryCache.get(speciesId) ?? null
    if (!buffer) {
      buffer = await this.loadCry(speciesId)
      if (!buffer) return
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = options?.rate ?? 1

    const gain = ctx.createGain()
    gain.gain.value = (options?.volume ?? 1) * this._volume
    source.connect(gain)
    gain.connect(ctx.destination)

    source.start()
  }

  private async loadCry(speciesId: number): Promise<AudioBuffer | null> {
    // Deduplicate concurrent loads
    const existing = this.cryLoadingMap.get(speciesId)
    if (existing) return existing

    const promise = (async () => {
      try {
        const ctx = this.ensureContext()
        const res = await fetch(CRY_URL(speciesId))
        if (!res.ok) return null
        const buf = await res.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(buf)

        // LRU eviction: keep max 10
        this.cryCache.set(speciesId, audioBuffer)
        if (this.cryCache.size > 10) {
          const firstKey = this.cryCache.keys().next().value
          if (firstKey !== undefined) this.cryCache.delete(firstKey)
        }

        return audioBuffer
      } catch {
        return null
      } finally {
        this.cryLoadingMap.delete(speciesId)
      }
    })()

    this.cryLoadingMap.set(speciesId, promise)
    return promise
  }

  // Preload a cry (non-blocking)
  preloadCry(speciesId: number) {
    if (!this.cryCache.has(speciesId)) {
      this.loadCry(speciesId)
    }
  }

  // ── Synthesized Sound Effects ──

  /** 喂食音效：咀嚼感 */
  playFeedSound() {
    if (this._muted) return
    const ctx = this.ensureContext()
    const now = ctx.currentTime

    // 3 quick "chomp" pulses
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 200 + i * 50
      gain.gain.setValueAtTime(0, now + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.3 * this._volume, now + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.12)
    }

    // Satisfaction rising tone
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(400, now + 0.4)
    osc2.frequency.linearRampToValueAtTime(800, now + 0.65)
    gain2.gain.setValueAtTime(0, now + 0.4)
    gain2.gain.linearRampToValueAtTime(0.2 * this._volume, now + 0.45)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.4)
    osc2.stop(now + 0.75)
  }

  /** 进化开始：升调能量蓄积 */
  playEvolveStart() {
    if (this._muted) return
    const ctx = this.ensureContext()
    const now = ctx.currentTime

    // Rising sine sweep
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(1200, now + 1.2)
    gain.gain.setValueAtTime(0.15 * this._volume, now)
    gain.gain.linearRampToValueAtTime(0.35 * this._volume, now + 0.8)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 1.4)

    // Harmonic shimmer
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(400, now + 0.3)
    osc2.frequency.exponentialRampToValueAtTime(2400, now + 1.2)
    gain2.gain.setValueAtTime(0.08 * this._volume, now + 0.3)
    gain2.gain.linearRampToValueAtTime(0.2 * this._volume, now + 0.9)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.3)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.3)
    osc2.stop(now + 1.4)
  }

  /** 进化变形：频率扫描 + 噪声爆发 */
  playEvolveTransform() {
    if (this._muted) return
    const ctx = this.ensureContext()
    const now = ctx.currentTime

    // Frequency sweep down then up
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(1500, now)
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4)
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.8)
    gain.gain.setValueAtTime(0.2 * this._volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 1.1)

    // White noise burst
    const bufferSize = ctx.sampleRate * 0.5
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.15 * this._volume, now + 0.2)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)

    // Bandpass filter for the noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1000
    filter.Q.value = 2

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(now + 0.2)
    noise.stop(now + 0.8)
  }

  /** 进化胜利号角：C-E-G 大三和弦琶音 */
  playEvolveFanfare() {
    if (this._muted) return
    const ctx = this.ensureContext()
    const now = ctx.currentTime

    // C5-E5-G5-C6 arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq

      const start = now + i * 0.15
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25 * this._volume, start + 0.05)
      gain.gain.setValueAtTime(0.25 * this._volume, start + 0.3)
      gain.gain.exponentialRampToValueAtTime(0.001, start + (i === 3 ? 0.8 : 0.5))

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + (i === 3 ? 0.9 : 0.55))
    })

    // Final sustained chord
    const chordStart = now + 0.7
    const chordFreqs = [523.25, 659.25, 783.99, 1046.5]
    chordFreqs.forEach(freq => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, chordStart)
      gain.gain.linearRampToValueAtTime(0.15 * this._volume, chordStart + 0.05)
      gain.gain.setValueAtTime(0.15 * this._volume, chordStart + 0.5)
      gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 1.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(chordStart)
      osc.stop(chordStart + 1.3)
    })
  }

  /** 状态变化音效 */
  playStatusChange(status: PokemonStatus) {
    if (this._muted) return
    const ctx = this.ensureContext()
    const now = ctx.currentTime

    switch (status) {
      case 'joyful': {
        // Bright ascending ding-ding
        const freqs = [659, 880, 1047]
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          const t = now + i * 0.1
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.2 * this._volume, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.35)
        })
        break
      }
      case 'happy': {
        // Two-note happy chime
        const freqs = [523, 659]
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          const t = now + i * 0.12
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.15 * this._volume, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.35)
        })
        break
      }
      case 'sleeping': {
        // Soft descending tone
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.5)
        gain.gain.setValueAtTime(0.12 * this._volume, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.65)
        break
      }
      case 'sad':
      case 'exhausted':
      case 'lonely': {
        // Low somber two-note
        const freqs = [262, 220]
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          const t = now + i * 0.2
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.12 * this._volume, t + 0.03)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.45)
        })
        break
      }
      case 'anxious': {
        // Quick nervous beeps
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'square'
          osc.frequency.value = 600 + (i % 2) * 100
          const t = now + i * 0.08
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.1 * this._volume, t + 0.01)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.08)
        }
        break
      }
      default: {
        // Subtle notification ping
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 523
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.1 * this._volume, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.3)
        break
      }
    }
  }
}

// ── Singleton ──
let instance: SoundManager | null = null

export function getSoundManager(): SoundManager {
  if (!instance) {
    instance = new SoundManager()
  }
  return instance
}

export type { SoundManager }

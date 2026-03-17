'use client'

import { motion, type TargetAndTransition } from 'framer-motion'
import { getPokemonStatus, PokemonStatus } from '@/lib/game-logic'
import { getSpeciesAnimation, getSpeciesParticles, getSpeciesAura, getSpeciesFilter, type ParticleConfig } from '@/lib/pokemon-animations'

type SizeVariant = 'small' | 'medium' | 'large' | 'xlarge'

interface Props {
  speciesId: number
  name: string
  vitality: number
  wisdom: number
  affection: number
  level: number
  size?: SizeVariant
  /** @deprecated use size="large" */
  large?: boolean
  /** 点击宝可梦时触发（播放叫声等） */
  onPokemonClick?: () => void
}

const sizePx: Record<SizeVariant, number> = {
  small: 80,
  medium: 140,
  large: 220,
  xlarge: 340,
}

// Use Pokemon HOME 3D sprites — much higher quality than pixel sprites
const getHomeSprite = (speciesId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${speciesId}.png`

// Fallback to official artwork if HOME sprite fails
const getOfficialArt = (speciesId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`

// ── Default 9-State Aura & Filter (fallback for species without category override) ──

const defaultAura: Record<PokemonStatus, string> = {
  joyful: 'radial-gradient(ellipse, rgba(251,191,36,0.5) 0%, rgba(245,158,11,0.2) 40%, transparent 70%)',
  happy: 'radial-gradient(ellipse, rgba(52,211,153,0.4) 0%, rgba(16,185,129,0.15) 40%, transparent 70%)',
  calm: 'radial-gradient(ellipse, rgba(135,206,235,0.3) 0%, rgba(135,206,235,0.1) 40%, transparent 70%)',
  tired: 'radial-gradient(ellipse, rgba(169,180,194,0.3) 0%, transparent 60%)',
  sad: 'radial-gradient(ellipse, rgba(100,149,237,0.25) 0%, transparent 60%)',
  anxious: 'radial-gradient(ellipse, rgba(255,215,0,0.3) 0%, rgba(255,165,0,0.1) 40%, transparent 70%)',
  exhausted: 'radial-gradient(ellipse, rgba(105,105,105,0.3) 0%, transparent 60%)',
  lonely: 'radial-gradient(ellipse, rgba(65,105,225,0.25) 0%, transparent 60%)',
  sleeping: 'radial-gradient(ellipse, rgba(106,90,205,0.3) 0%, rgba(106,90,205,0.1) 40%, transparent 70%)',
}

const defaultFilter: Record<PokemonStatus, string> = {
  joyful: 'drop-shadow(0 0 16px rgba(251,191,36,0.7)) drop-shadow(0 12px 20px rgba(0,0,0,0.35)) saturate(1.2)',
  happy: 'drop-shadow(0 0 12px rgba(52,211,153,0.5)) drop-shadow(0 12px 20px rgba(0,0,0,0.3)) saturate(1.1)',
  calm: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))',
  tired: 'drop-shadow(0 8px 12px rgba(0,0,0,0.25)) brightness(0.85) saturate(0.85)',
  sad: 'drop-shadow(0 6px 10px rgba(0,0,0,0.2)) brightness(0.9) saturate(0.85) hue-rotate(-10deg)',
  anxious: 'drop-shadow(0 6px 12px rgba(0,0,0,0.25)) saturate(1.1) hue-rotate(10deg)',
  exhausted: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2)) brightness(0.7) saturate(0.7) grayscale(0.3)',
  lonely: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15)) grayscale(0.8) brightness(0.75)',
  sleeping: 'drop-shadow(0 6px 10px rgba(106,90,205,0.3)) brightness(0.8) saturate(0.8) hue-rotate(-15deg)',
}

// ── Default particle configs (fallback) ──
const defaultParticles: Partial<Record<PokemonStatus, ParticleConfig>> = {
  sad: {
    char: '💧',
    positions: [{ top: '30%', left: '15%' }, { top: '25%', left: '80%' }, { top: '45%', left: '10%' }],
    fontSize: '1rem', fontSizeSm: '0.8rem', color: '#6495ed',
    animateProps: { opacity: [0, 0.7, 0], y: [0, 20, 40], scale: [0.8, 1, 0.5] },
    transitionBase: { repeat: Infinity, duration: 3 },
  },
  anxious: {
    char: '❗',
    positions: [{ top: '0%', left: '45%' }],
    fontSize: '1.5rem', fontSizeSm: '1.1rem', color: '#ef4444',
    animateProps: { opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1, 0.5] },
    transitionBase: { repeat: Infinity, duration: 2.5 },
  },
  exhausted: {
    char: '💫',
    positions: [{ top: '5%', left: '30%' }, { top: '8%', left: '65%' }, { top: '2%', left: '48%' }],
    fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#9ca3af',
    animateProps: { opacity: [0.3, 0.8, 0.3], rotate: [0, 360] },
    transitionBase: { repeat: Infinity, duration: 4 },
  },
  lonely: {
    char: '?',
    positions: [{ top: '10%', left: '20%' }, { top: '20%', left: '78%' }],
    fontSize: '1.3rem', fontSizeSm: '1rem', color: '#94a3b8',
    animateProps: { opacity: [0, 0.5, 0], y: [0, -10, -20] },
    transitionBase: { repeat: Infinity, duration: 5 },
  },
}

export default function PokemonDisplay({
  speciesId, name, vitality, wisdom, affection, level,
  size, large = false, onPokemonClick,
}: Props) {
  const resolvedSize: SizeVariant = size ?? (large ? 'large' : 'medium')
  const imgSize = sizePx[resolvedSize]
  const status = getPokemonStatus(vitality, wisdom, affection)
  const homeUrl = getHomeSprite(speciesId)
  const fallbackUrl = getOfficialArt(speciesId)
  const isSmall = resolvedSize === 'small' || resolvedSize === 'medium'

  // ── Species-specific animation, aura, filter, particles ──
  const animation = getSpeciesAnimation(speciesId, status)
  const aura = getSpeciesAura(speciesId, status, defaultAura[status])
  const filter = getSpeciesFilter(speciesId, status, defaultFilter[status])
  const speciesParticle = getSpeciesParticles(speciesId, status)
  // Merge with default particles for states not covered by species config (sad, anxious, exhausted, lonely)
  const particle = speciesParticle || defaultParticles[status]

  const nameFontSize = resolvedSize === 'xlarge' ? '2rem'
    : resolvedSize === 'large' ? '1.5rem'
    : resolvedSize === 'medium' ? '1rem'
    : '0.875rem'

  const levelFontSize = resolvedSize === 'xlarge' ? '1.375rem'
    : resolvedSize === 'large' ? '1.125rem'
    : '0.875rem'

  const shadowSize = resolvedSize === 'xlarge' ? { width: imgSize * 0.65, height: 28 }
    : resolvedSize === 'large' ? { width: imgSize * 0.6, height: 20 }
    : { width: imgSize * 0.55, height: 14 }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Pokemon with 3D presentation */}
      <div className="relative flex flex-col items-center">
        {/* Background aura glow */}
        <div
          className="absolute inset-0 rounded-full scale-125"
          style={{
            background: aura,
            filter: 'blur(12px)',
            transform: 'scale(1.3) translateY(10%)',
          }}
        />

        {/* The Pokemon image */}
        <motion.div
          animate={animation}
          className={`relative z-10${onPokemonClick ? ' cursor-pointer' : ''}`}
          onClick={onPokemonClick}
          whileTap={onPokemonClick ? { scale: 0.92 } : undefined}
        >
          <img
            src={homeUrl}
            alt={name}
            width={imgSize}
            height={imgSize}
            style={{
              width: imgSize,
              height: imgSize,
              objectFit: 'contain',
              filter: filter,
            }}
            onError={(e) => {
              const img = e.currentTarget
              if (img.src !== fallbackUrl) img.src = fallbackUrl
            }}
          />
        </motion.div>

        {/* 3D ground shadow */}
        <div
          className="relative z-0 -mt-2"
          style={{
            width: shadowSize.width,
            height: shadowSize.height,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.28) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Status-specific particle effects */}
        {particle && (
          <>
            {particle.positions.map((pos, i) => (
              <motion.div
                key={`${speciesId}-${status}-${i}`}
                className="absolute select-none pointer-events-none z-20"
                style={{
                  top: pos.top,
                  left: pos.left,
                  fontSize: isSmall ? particle.fontSizeSm : particle.fontSize,
                  color: particle.color,
                  textShadow: `0 0 8px ${particle.color}40`,
                }}
                animate={particle.animateProps}
                transition={{
                  ...particle.transitionBase,
                  delay: i * (particle.transitionBase.duration / particle.positions.length),
                }}
              >
                {particle.char}
              </motion.div>
            ))}
          </>
        )}

        {/* Extra sparkle burst for joyful */}
        {status === 'joyful' && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                className="absolute text-yellow-300 select-none pointer-events-none z-20"
                style={{
                  top: `${15 + i * 20}%`,
                  left: i % 2 === 0 ? '5%' : '82%',
                  fontSize: isSmall ? '0.8rem' : '1rem',
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.2, 0.5],
                  y: [0, -10, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  delay: i * 0.4,
                }}
              >
                ✦
              </motion.div>
            ))}
          </>
        )}

        {/* Moonlight overlay for sleeping */}
        {status === 'sleeping' && !isSmall && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none z-5"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, rgba(192,192,255,0.15) 0%, transparent 60%)',
            }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          />
        )}

        {/* Anxious screen-shake effect (subtle border pulse) */}
        {status === 'anxious' && !isSmall && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none z-5"
            style={{ border: '2px solid rgba(255,215,0,0.3)' }}
            animate={{ opacity: [0, 0.6, 0], scale: [0.95, 1.05, 0.95] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        )}

        {/* Lonely desaturated vignette */}
        {status === 'lonely' && !isSmall && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none z-5"
            style={{
              background: 'radial-gradient(ellipse, transparent 40%, rgba(65,105,225,0.1) 100%)',
            }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* Name & Level with game text style */}
      <div className="text-center">
        <p
          className="game-label font-bold leading-tight"
          style={{ fontSize: nameFontSize }}
        >
          {name}
        </p>
        <p
          className="font-bold mt-1"
          style={{
            fontSize: levelFontSize,
            fontFamily: "'ZCOOL KuaiLe', sans-serif",
            color: '#6366f1',
            textShadow: '1px 2px 0 rgba(99,102,241,0.3)',
          }}
        >
          Lv.{level}
        </p>
      </div>
    </div>
  )
}

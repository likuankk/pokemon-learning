'use client'

import { motion, type TargetAndTransition } from 'framer-motion'
import { getPokemonStatus, PokemonStatus } from '@/lib/game-logic'

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

const statusAnimations: Record<PokemonStatus, TargetAndTransition> = {
  energetic: {
    y: [0, -20, 0],
    transition: { repeat: Infinity, duration: 0.75, ease: 'easeInOut' }
  },
  good: {
    rotate: [0, 4, -4, 0],
    transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
  },
  tired: {
    x: [0, 5, -5, 0],
    transition: { repeat: Infinity, duration: 4.5, ease: 'easeInOut' }
  },
  sad: {
    y: [0, 3, 0],
    transition: { repeat: Infinity, duration: 5, ease: 'easeInOut' }
  },
}

// Colored aura glow per status
const statusAura: Record<PokemonStatus, string> = {
  energetic: 'radial-gradient(ellipse, rgba(251,191,36,0.5) 0%, rgba(245,158,11,0.2) 40%, transparent 70%)',
  good: 'radial-gradient(ellipse, rgba(52,211,153,0.4) 0%, rgba(16,185,129,0.15) 40%, transparent 70%)',
  tired: 'radial-gradient(ellipse, rgba(148,163,184,0.3) 0%, transparent 60%)',
  sad: 'radial-gradient(ellipse, rgba(100,116,139,0.2) 0%, transparent 60%)',
}

const statusFilter: Record<PokemonStatus, string> = {
  energetic: 'drop-shadow(0 0 16px rgba(251,191,36,0.7)) drop-shadow(0 12px 20px rgba(0,0,0,0.35))',
  good: 'drop-shadow(0 0 12px rgba(52,211,153,0.5)) drop-shadow(0 12px 20px rgba(0,0,0,0.3))',
  tired: 'drop-shadow(0 8px 12px rgba(0,0,0,0.25)) brightness(0.85)',
  sad: 'drop-shadow(0 6px 10px rgba(0,0,0,0.2)) grayscale(0.5) brightness(0.75)',
}

export default function PokemonDisplay({
  speciesId, name, vitality, wisdom, affection, level,
  size, large = false,
}: Props) {
  const resolvedSize: SizeVariant = size ?? (large ? 'large' : 'medium')
  const imgSize = sizePx[resolvedSize]
  const status = getPokemonStatus(vitality, wisdom, affection)
  const homeUrl = getHomeSprite(speciesId)
  const fallbackUrl = getOfficialArt(speciesId)

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
            background: statusAura[status],
            filter: 'blur(12px)',
            transform: 'scale(1.3) translateY(10%)',
          }}
        />

        {/* The Pokemon image */}
        <motion.div
          animate={statusAnimations[status]}
          className="relative z-10"
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
              filter: statusFilter[status],
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

        {/* Sparkle for energetic status */}
        {status === 'energetic' && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-yellow-300 select-none pointer-events-none"
                style={{
                  top: `${15 + i * 20}%`,
                  left: i % 2 === 0 ? '5%' : '82%',
                  fontSize: resolvedSize === 'xlarge' ? '1.5rem' : '1rem',
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

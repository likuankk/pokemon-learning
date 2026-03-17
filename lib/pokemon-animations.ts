// 65种宝可梦物种专属状态动画系统
// 每种宝可梦按体型/属性分为 8 个动画类别，各自拥有独特的运动风格

import type { TargetAndTransition } from 'framer-motion'
import type { PokemonStatus } from './game-logic'

// ── 动画类别 ───────────────────────────────────────────────────────────────
export type AnimationCategory =
  | 'bipedal'    // 双足站立型
  | 'quadruped'  // 四足行走型
  | 'flying'     // 飞行/漂浮型
  | 'aquatic'    // 水生型
  | 'bouncy'     // 弹跳/圆形型
  | 'serpentine' // 蛇形/龙形
  | 'plant'      // 植物型
  | 'heavy'      // 重型/岩石型

// ── 65 宝可梦 → 类别映射 ──────────────────────────────────────────────────
export const SPECIES_CATEGORY: Record<number, AnimationCategory> = {
  // bipedal 双足型
  1: 'bipedal', 2: 'bipedal', 3: 'bipedal',    // 妙蛙种子家族
  5: 'bipedal',                                   // 火恐龙
  61: 'bipedal', 62: 'bipedal',                   // 蚊香君、蚊香泳士
  125: 'bipedal',                                  // 电击兽

  // quadruped 四足型
  4: 'quadruped',                                  // 小火龙
  37: 'quadruped', 38: 'quadruped',               // 六尾、九尾
  58: 'quadruped', 59: 'quadruped',               // 卡蒂狗、风速狗
  77: 'quadruped', 78: 'quadruped',               // 小火马、烈焰马

  // flying 飞行型
  6: 'flying',                                     // 喷火龙
  12: 'flying',                                    // 巴大蝶
  144: 'flying', 145: 'flying', 146: 'flying',   // 三神鸟
  149: 'flying',                                   // 快龙

  // aquatic 水生型
  7: 'aquatic', 8: 'aquatic', 9: 'aquatic',      // 杰尼龟家族
  54: 'aquatic', 55: 'aquatic',                   // 可达鸭、哥达鸭
  60: 'aquatic',                                   // 蚊香蝌蚪
  86: 'aquatic', 87: 'aquatic',                   // 小海狮、白海狮
  120: 'aquatic', 121: 'aquatic',                 // 海星星、宝石海星
  131: 'aquatic',                                  // 拉普拉斯
  134: 'aquatic',                                  // 水伊布

  // bouncy 弹跳型
  25: 'bouncy', 26: 'bouncy',                     // 皮卡丘、雷丘
  35: 'bouncy', 36: 'bouncy',                     // 皮皮、皮可西
  39: 'bouncy', 40: 'bouncy',                     // 胖丁、胖可丁
  100: 'bouncy', 101: 'bouncy',                   // 霹雳电球、顽皮雷弹
  133: 'bouncy',                                   // 伊布
  135: 'bouncy',                                   // 雷伊布
  136: 'bouncy',                                   // 火伊布
  471: 'bouncy',                                   // 冰伊布

  // serpentine 蛇形型
  27: 'serpentine', 28: 'serpentine',             // 穿山鼠、穿山王
  147: 'serpentine', 148: 'serpentine',           // 迷你龙、哈克龙

  // plant 植物型
  10: 'plant', 11: 'plant',                       // 绿毛虫、铁甲蛹
  43: 'plant', 44: 'plant', 45: 'plant',         // 走路草家族
  69: 'plant', 70: 'plant', 71: 'plant',         // 喇叭芽家族

  // heavy 重型
  50: 'heavy', 51: 'heavy',                       // 地鼠、三地鼠
  74: 'heavy', 75: 'heavy', 76: 'heavy',         // 小拳石家族
  81: 'heavy', 82: 'heavy',                       // 小磁怪、三合一磁怪
  143: 'heavy',                                    // 卡比兽
  150: 'heavy',                                    // 超梦
}

// ── 8 类别 × 9 状态 动画参数 ──────────────────────────────────────────────
const INF = Infinity

export const CATEGORY_ANIMATIONS: Record<AnimationCategory, Record<PokemonStatus, TargetAndTransition>> = {
  // ═══════════════════════════════════════════════════════
  // bipedal — 双足站立型：人形动感
  // ═══════════════════════════════════════════════════════
  bipedal: {
    joyful: {
      y: [0, -25, 0],
      rotate: [0, 5, -5, 0],
      transition: { repeat: INF, duration: 1.3, ease: 'easeInOut' },
    },
    happy: {
      rotate: [0, 6, -6, 0],
      y: [0, -3, 0],
      transition: { repeat: INF, duration: 2.5, ease: 'easeInOut' },
    },
    calm: {
      scale: [1, 1.03, 1],
      y: [0, 2, 0],
      transition: { repeat: INF, duration: 4, ease: 'easeInOut' },
    },
    tired: {
      rotate: [0, 3, 0],
      y: [0, 5, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    sad: {
      scale: [1, 0.97, 1],
      y: [0, 3, 0],
      transition: { repeat: INF, duration: 4.5, ease: 'easeInOut' },
    },
    anxious: {
      x: [0, -6, 0, 6, 0],
      scale: [1, 1.02, 1, 1.02, 1],
      transition: { repeat: INF, duration: 1, ease: 'easeInOut' },
    },
    exhausted: {
      rotate: [0, -4, 0],
      scale: [1, 0.96, 1],
      transition: { repeat: INF, duration: 7, ease: 'easeInOut' },
    },
    lonely: {
      rotate: [0, 2, -2, 0],
      y: [0, 2, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
    sleeping: {
      y: [0, 6, 0],
      rotate: [0, 2, 0],
      scale: [1, 0.97, 1],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // quadruped — 四足行走型：奔跑动物
  // ═══════════════════════════════════════════════════════
  quadruped: {
    joyful: {
      y: [0, -18, 0],
      x: [0, 5, -5, 0],
      rotate: [0, 3, -3, 0],
      transition: { repeat: INF, duration: 1.2, ease: 'easeInOut' },
    },
    happy: {
      rotate: [0, 5, -5, 0],
      y: [0, -5, 0],
      transition: { repeat: INF, duration: 2, ease: 'easeInOut' },
    },
    calm: {
      scale: [1, 1.025, 1],
      transition: { repeat: INF, duration: 4.5, ease: 'easeInOut' },
    },
    tired: {
      y: [0, 4, 0],
      rotate: [0, 1, 0],
      scale: [1, 0.98, 1],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    sad: {
      y: [0, 3, 0],
      rotate: [0, -2, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    anxious: {
      x: [0, -8, 0, 8, 0],
      y: [0, -3, 0, -3, 0],
      transition: { repeat: INF, duration: 0.8, ease: 'easeInOut' },
    },
    exhausted: {
      y: [0, 5, 0],
      scale: [1, 0.96, 1],
      rotate: [0, -3, 0],
      transition: { repeat: INF, duration: 7, ease: 'easeInOut' },
    },
    lonely: {
      y: [0, 2, 0],
      rotate: [0, 1, -1, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
    sleeping: {
      y: [0, 4, 0],
      scale: [1, 0.95, 1],
      transition: { repeat: INF, duration: 5.5, ease: 'easeInOut' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // flying — 飞行/漂浮型：空中悬浮
  // ═══════════════════════════════════════════════════════
  flying: {
    joyful: {
      y: [0, -30, 0],
      rotate: [0, 8, -8, 0],
      transition: { repeat: INF, duration: 2, ease: 'easeInOut' },
    },
    happy: {
      y: [0, -15, 0],
      rotate: [0, 5, -5, 0],
      transition: { repeat: INF, duration: 3, ease: 'easeInOut' },
    },
    calm: {
      y: [0, -8, 0],
      scale: [1, 1.02, 1],
      transition: { repeat: INF, duration: 3.5, ease: 'easeInOut' },
    },
    tired: {
      y: [0, 8, 0],
      rotate: [0, 3, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    sad: {
      y: [0, 5, 0],
      rotate: [0, -2, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    anxious: {
      x: [0, -10, 0, 10, 0],
      y: [0, -5, 0, -5, 0],
      transition: { repeat: INF, duration: 1.2, ease: 'easeInOut' },
    },
    exhausted: {
      y: [0, 10, 0],
      rotate: [0, -5, 0],
      scale: [1, 0.97, 1],
      transition: { repeat: INF, duration: 8, ease: 'easeInOut' },
    },
    lonely: {
      y: [0, -5, 0],
      x: [0, 3, -3, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
    sleeping: {
      y: [0, 10, 0],
      scale: [1, 0.96, 1],
      rotate: [0, 2, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // aquatic — 水生型：水中游弋
  // ═══════════════════════════════════════════════════════
  aquatic: {
    joyful: {
      x: [0, 12, -12, 0],
      y: [0, -10, 0],
      rotate: [0, 4, -4, 0],
      transition: { repeat: INF, duration: 2, ease: 'easeInOut' },
    },
    happy: {
      x: [0, 8, -8, 0],
      rotate: [0, 4, -4, 0],
      transition: { repeat: INF, duration: 3, ease: 'easeInOut' },
    },
    calm: {
      y: [0, -5, 0],
      x: [0, 3, -3, 0],
      scale: [1, 1.02, 1],
      transition: { repeat: INF, duration: 4, ease: 'easeInOut' },
    },
    tired: {
      y: [0, 3, 0],
      x: [0, 2, -2, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    sad: {
      y: [0, 4, 0],
      x: [0, 1, -1, 0],
      transition: { repeat: INF, duration: 5.5, ease: 'easeInOut' },
    },
    anxious: {
      x: [0, -10, 0, 10, 0],
      y: [0, -3, 0, -3, 0],
      transition: { repeat: INF, duration: 1, ease: 'easeInOut' },
    },
    exhausted: {
      y: [0, 6, 0],
      scale: [1, 0.97, 1],
      transition: { repeat: INF, duration: 8, ease: 'easeInOut' },
    },
    lonely: {
      x: [0, 2, -2, 0],
      y: [0, -2, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
    sleeping: {
      y: [0, 8, 0],
      scale: [1, 0.97, 1],
      x: [0, 1, -1, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // bouncy — 弹跳/圆形型：可爱弹性
  // ═══════════════════════════════════════════════════════
  bouncy: {
    joyful: {
      y: [0, -25, 0],
      rotate: [0, 10, -10, 0],
      scale: [1, 1.08, 0.95, 1],
      transition: { repeat: INF, duration: 1, ease: 'easeInOut' },
    },
    happy: {
      y: [0, -12, 0],
      x: [0, 5, -5, 0],
      rotate: [0, 4, -4, 0],
      transition: { repeat: INF, duration: 2, ease: 'easeInOut' },
    },
    calm: {
      y: [0, -4, 0],
      scale: [1, 1.03, 1],
      transition: { repeat: INF, duration: 3, ease: 'easeInOut' },
    },
    tired: {
      y: [0, 3, 0],
      scale: [1, 0.97, 1],
      transition: { repeat: INF, duration: 4.5, ease: 'easeInOut' },
    },
    sad: {
      y: [0, 4, 0],
      scale: [1, 0.96, 1],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    anxious: {
      x: [0, -8, 0, 8, 0],
      y: [0, -5, 0, -5, 0],
      scale: [1, 1.05, 1, 1.05, 1],
      transition: { repeat: INF, duration: 0.8, ease: 'easeInOut' },
    },
    exhausted: {
      scale: [1, 0.94, 1],
      y: [0, 3, 0],
      transition: { repeat: INF, duration: 8, ease: 'easeInOut' },
    },
    lonely: {
      x: [0, 3, -3, 0],
      y: [0, -2, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    sleeping: {
      scale: [1, 0.93, 1],
      y: [0, 3, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // serpentine — 蛇形/龙形：蜿蜒律动
  // ═══════════════════════════════════════════════════════
  serpentine: {
    joyful: {
      x: [0, 10, -10, 0],
      rotate: [0, 6, -6, 0],
      y: [0, -12, 0],
      transition: { repeat: INF, duration: 1.8, ease: 'easeInOut' },
    },
    happy: {
      x: [0, 6, -6, 0],
      rotate: [0, 4, -4, 0],
      transition: { repeat: INF, duration: 3, ease: 'easeInOut' },
    },
    calm: {
      scale: [1, 1.03, 1],
      rotate: [0, 2, -2, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    tired: {
      x: [0, 2, -2, 0],
      y: [0, 3, 0],
      transition: { repeat: INF, duration: 5.5, ease: 'easeInOut' },
    },
    sad: {
      y: [0, 4, 0],
      rotate: [0, -2, 0],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    anxious: {
      x: [0, -12, 0, 12, 0],
      rotate: [0, 5, -5, 0],
      transition: { repeat: INF, duration: 1, ease: 'easeInOut' },
    },
    exhausted: {
      scale: [1, 0.96, 1],
      x: [0, 1, -1, 0],
      transition: { repeat: INF, duration: 8, ease: 'easeInOut' },
    },
    lonely: {
      x: [0, 3, -3, 0],
      rotate: [0, 1, -1, 0],
      transition: { repeat: INF, duration: 7, ease: 'easeInOut' },
    },
    sleeping: {
      scale: [1, 0.92, 1],
      rotate: [0, 1, 0],
      transition: { repeat: INF, duration: 7, ease: 'easeInOut' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // plant — 植物型：风中摇曳
  // ═══════════════════════════════════════════════════════
  plant: {
    joyful: {
      rotate: [0, 8, -8, 0],
      scale: [1, 1.05, 1],
      y: [0, -10, 0],
      transition: { repeat: INF, duration: 1.5, ease: 'easeInOut' },
    },
    happy: {
      rotate: [0, 5, -5, 0],
      scale: [1, 1.03, 1],
      transition: { repeat: INF, duration: 2.5, ease: 'easeInOut' },
    },
    calm: {
      rotate: [0, 3, -3, 0],
      scale: [1, 1.02, 1],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    tired: {
      rotate: [0, 4, 0],
      y: [0, 3, 0],
      scale: [1, 0.98, 1],
      transition: { repeat: INF, duration: 5.5, ease: 'easeInOut' },
    },
    sad: {
      rotate: [0, 2, 0],
      y: [0, 4, 0],
      scale: [1, 0.97, 1],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    anxious: {
      rotate: [0, -6, 0, 6, 0],
      x: [0, -4, 0, 4, 0],
      transition: { repeat: INF, duration: 1.2, ease: 'easeInOut' },
    },
    exhausted: {
      rotate: [0, -5, 0],
      scale: [1, 0.95, 1],
      y: [0, 4, 0],
      transition: { repeat: INF, duration: 8, ease: 'easeInOut' },
    },
    lonely: {
      rotate: [0, 2, -2, 0],
      y: [0, 2, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
    sleeping: {
      scale: [1, 0.94, 1],
      rotate: [0, 2, 0],
      y: [0, 3, 0],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // heavy — 重型/岩石型：厚重稳健
  // ═══════════════════════════════════════════════════════
  heavy: {
    joyful: {
      y: [0, -8, 0],
      scale: [1, 1.02, 0.98, 1],
      transition: { repeat: INF, duration: 2, ease: 'easeInOut' },
    },
    happy: {
      y: [0, -4, 0],
      rotate: [0, 2, -2, 0],
      transition: { repeat: INF, duration: 3.5, ease: 'easeInOut' },
    },
    calm: {
      scale: [1, 1.015, 1],
      transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
    },
    tired: {
      y: [0, 4, 0],
      scale: [1, 0.98, 1],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
    sad: {
      y: [0, 3, 0],
      scale: [1, 0.98, 1],
      transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
    },
    anxious: {
      x: [0, -5, 0, 5, 0],
      y: [0, -2, 0, -2, 0],
      transition: { repeat: INF, duration: 1.5, ease: 'easeInOut' },
    },
    exhausted: {
      scale: [1, 0.97, 1],
      y: [0, 3, 0],
      transition: { repeat: INF, duration: 9, ease: 'easeInOut' },
    },
    lonely: {
      y: [0, 2, 0],
      rotate: [0, 1, -1, 0],
      transition: { repeat: INF, duration: 7, ease: 'easeInOut' },
    },
    sleeping: {
      scale: [1, 0.97, 1],
      transition: { repeat: INF, duration: 8, ease: 'easeInOut' },
    },
  },
}

// ── 类别光环颜色 ─────────────────────────────────────────────────────────
export const CATEGORY_AURA: Record<AnimationCategory, Partial<Record<PokemonStatus, string>>> = {
  bipedal: {},
  quadruped: {
    joyful: 'radial-gradient(ellipse, rgba(251,146,60,0.5) 0%, rgba(245,158,11,0.2) 40%, transparent 70%)',
    happy: 'radial-gradient(ellipse, rgba(251,146,60,0.3) 0%, transparent 60%)',
  },
  flying: {
    joyful: 'radial-gradient(ellipse, rgba(147,197,253,0.5) 0%, rgba(96,165,250,0.2) 40%, transparent 70%)',
    happy: 'radial-gradient(ellipse, rgba(147,197,253,0.35) 0%, transparent 60%)',
    calm: 'radial-gradient(ellipse, rgba(186,230,253,0.35) 0%, transparent 60%)',
  },
  aquatic: {
    joyful: 'radial-gradient(ellipse, rgba(56,189,248,0.5) 0%, rgba(14,165,233,0.2) 40%, transparent 70%)',
    happy: 'radial-gradient(ellipse, rgba(56,189,248,0.35) 0%, transparent 60%)',
    calm: 'radial-gradient(ellipse, rgba(125,211,252,0.35) 0%, transparent 60%)',
    sleeping: 'radial-gradient(ellipse, rgba(30,64,175,0.25) 0%, transparent 60%)',
  },
  bouncy: {
    joyful: 'radial-gradient(ellipse, rgba(253,224,71,0.55) 0%, rgba(250,204,21,0.25) 40%, transparent 70%)',
    happy: 'radial-gradient(ellipse, rgba(253,224,71,0.35) 0%, transparent 60%)',
  },
  serpentine: {
    joyful: 'radial-gradient(ellipse, rgba(167,139,250,0.4) 0%, rgba(139,92,246,0.15) 40%, transparent 70%)',
    calm: 'radial-gradient(ellipse, rgba(196,181,253,0.3) 0%, transparent 60%)',
  },
  plant: {
    joyful: 'radial-gradient(ellipse, rgba(74,222,128,0.5) 0%, rgba(34,197,94,0.2) 40%, transparent 70%)',
    happy: 'radial-gradient(ellipse, rgba(74,222,128,0.35) 0%, transparent 60%)',
    calm: 'radial-gradient(ellipse, rgba(134,239,172,0.3) 0%, transparent 60%)',
  },
  heavy: {
    joyful: 'radial-gradient(ellipse, rgba(161,161,170,0.4) 0%, rgba(113,113,122,0.15) 40%, transparent 70%)',
    calm: 'radial-gradient(ellipse, rgba(161,161,170,0.25) 0%, transparent 60%)',
  },
}

// ── 类别 CSS filter ──────────────────────────────────────────────────────
export const CATEGORY_FILTER: Record<AnimationCategory, Partial<Record<PokemonStatus, string>>> = {
  bipedal: {},
  quadruped: {
    joyful: 'drop-shadow(0 0 16px rgba(251,146,60,0.6)) drop-shadow(0 12px 20px rgba(0,0,0,0.35)) saturate(1.2)',
    happy: 'drop-shadow(0 0 10px rgba(251,146,60,0.35)) drop-shadow(0 12px 20px rgba(0,0,0,0.3)) saturate(1.1)',
  },
  flying: {
    joyful: 'drop-shadow(0 0 18px rgba(96,165,250,0.6)) drop-shadow(0 14px 24px rgba(0,0,0,0.3)) saturate(1.15)',
    happy: 'drop-shadow(0 0 12px rgba(96,165,250,0.4)) drop-shadow(0 12px 20px rgba(0,0,0,0.25))',
    calm: 'drop-shadow(0 10px 18px rgba(0,0,0,0.2))',
  },
  aquatic: {
    joyful: 'drop-shadow(0 0 16px rgba(56,189,248,0.6)) drop-shadow(0 12px 20px rgba(0,0,0,0.3)) saturate(1.15)',
    happy: 'drop-shadow(0 0 10px rgba(56,189,248,0.4)) drop-shadow(0 12px 18px rgba(0,0,0,0.25))',
    calm: 'drop-shadow(0 8px 16px rgba(0,0,0,0.2)) hue-rotate(-5deg)',
  },
  bouncy: {
    joyful: 'drop-shadow(0 0 16px rgba(250,204,21,0.7)) drop-shadow(0 12px 20px rgba(0,0,0,0.35)) saturate(1.25)',
    happy: 'drop-shadow(0 0 12px rgba(250,204,21,0.45)) drop-shadow(0 12px 20px rgba(0,0,0,0.3))',
  },
  serpentine: {
    joyful: 'drop-shadow(0 0 14px rgba(139,92,246,0.5)) drop-shadow(0 12px 20px rgba(0,0,0,0.35)) saturate(1.15)',
    calm: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25)) hue-rotate(5deg)',
  },
  plant: {
    joyful: 'drop-shadow(0 0 16px rgba(34,197,94,0.55)) drop-shadow(0 12px 20px rgba(0,0,0,0.3)) saturate(1.2)',
    happy: 'drop-shadow(0 0 10px rgba(34,197,94,0.35)) drop-shadow(0 12px 18px rgba(0,0,0,0.25))',
    calm: 'drop-shadow(0 8px 14px rgba(0,0,0,0.2)) saturate(1.05)',
  },
  heavy: {
    joyful: 'drop-shadow(0 0 12px rgba(161,161,170,0.5)) drop-shadow(0 12px 22px rgba(0,0,0,0.4)) saturate(1.1)',
    calm: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))',
    exhausted: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25)) brightness(0.65) saturate(0.65) grayscale(0.35)',
  },
}

// ── 类别粒子效果 ─────────────────────────────────────────────────────────
export type ParticleConfig = {
  char: string
  positions: { top: string; left: string }[]
  fontSize: string
  fontSizeSm: string
  color: string
  animateProps: TargetAndTransition
  transitionBase: { repeat: number; duration: number }
}

export const CATEGORY_PARTICLES: Record<AnimationCategory, Partial<Record<PokemonStatus, ParticleConfig>>> = {
  // bipedal: 默认粒子
  bipedal: {
    joyful: {
      char: '♪',
      positions: [{ top: '10%', left: '0%' }, { top: '25%', left: '85%' }, { top: '50%', left: '5%' }],
      fontSize: '1.5rem', fontSizeSm: '1rem', color: '#fbbf24',
      animateProps: { opacity: [0, 1, 0], y: [0, -15, -30], scale: [0.5, 1.2, 0.5] },
      transitionBase: { repeat: INF, duration: 2 },
    },
    happy: {
      char: '♥',
      positions: [{ top: '5%', left: '50%' }, { top: '10%', left: '30%' }, { top: '8%', left: '70%' }],
      fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#ec4899',
      animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.3, 1, 0.3] },
      transitionBase: { repeat: INF, duration: 4 },
    },
    tired: {
      char: '💤',
      positions: [{ top: '0%', left: '60%' }, { top: '5%', left: '75%' }],
      fontSize: '1.3rem', fontSizeSm: '1rem', color: '#a9b4c2',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -25, -50], x: [0, 5, 10] },
      transitionBase: { repeat: INF, duration: 3.5 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '55%' }, { top: '0%', left: '68%' }, { top: '-5%', left: '78%' }],
      fontSize: '1.4rem', fontSizeSm: '1rem', color: '#6a5acd',
      animateProps: { opacity: [0, 0.9, 0], y: [0, -20, -45], x: [0, 8, 15], scale: [0.6, 1.2, 0.4] },
      transitionBase: { repeat: INF, duration: 3 },
    },
  },

  // quadruped: 奔跑尘土
  quadruped: {
    joyful: {
      char: '✦',
      positions: [{ top: '10%', left: '0%' }, { top: '20%', left: '85%' }, { top: '40%', left: '5%' }, { top: '15%', left: '75%' }],
      fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#f59e0b',
      animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.5, 1.2, 0.5] },
      transitionBase: { repeat: INF, duration: 1.8 },
    },
    happy: {
      char: '♪',
      positions: [{ top: '5%', left: '40%' }, { top: '10%', left: '70%' }],
      fontSize: '1.1rem', fontSizeSm: '0.8rem', color: '#fb923c',
      animateProps: { opacity: [0, 1, 0], y: [0, -15, -30], scale: [0.4, 1, 0.4] },
      transitionBase: { repeat: INF, duration: 3 },
    },
    tired: {
      char: '💤',
      positions: [{ top: '0%', left: '60%' }, { top: '5%', left: '75%' }],
      fontSize: '1.3rem', fontSizeSm: '1rem', color: '#a9b4c2',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -20, -40], x: [0, 5, 10] },
      transitionBase: { repeat: INF, duration: 3.5 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '55%' }, { top: '0%', left: '70%' }, { top: '-5%', left: '82%' }],
      fontSize: '1.4rem', fontSizeSm: '1rem', color: '#6a5acd',
      animateProps: { opacity: [0, 0.9, 0], y: [0, -20, -45], x: [0, 8, 15], scale: [0.6, 1.2, 0.4] },
      transitionBase: { repeat: INF, duration: 3 },
    },
  },

  // flying: 羽毛/风
  flying: {
    joyful: {
      char: '✧',
      positions: [{ top: '5%', left: '0%' }, { top: '15%', left: '85%' }, { top: '35%', left: '0%' }, { top: '25%', left: '90%' }],
      fontSize: '1.4rem', fontSizeSm: '1rem', color: '#93c5fd',
      animateProps: { opacity: [0, 1, 0], y: [0, -20, -45], x: [0, -8, -15], scale: [0.5, 1.3, 0.3] },
      transitionBase: { repeat: INF, duration: 2.2 },
    },
    happy: {
      char: '🪶',
      positions: [{ top: '5%', left: '20%' }, { top: '10%', left: '75%' }],
      fontSize: '1rem', fontSizeSm: '0.8rem', color: '#bae6fd',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -15, -35], x: [0, 10, 20], rotate: [0, 180, 360] },
      transitionBase: { repeat: INF, duration: 4 },
    },
    tired: {
      char: '💤',
      positions: [{ top: '0%', left: '65%' }],
      fontSize: '1.3rem', fontSizeSm: '1rem', color: '#a9b4c2',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -20, -40] },
      transitionBase: { repeat: INF, duration: 4 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '55%' }, { top: '0%', left: '68%' }],
      fontSize: '1.4rem', fontSizeSm: '1rem', color: '#6a5acd',
      animateProps: { opacity: [0, 0.9, 0], y: [0, -20, -45], x: [0, 8, 15], scale: [0.6, 1.2, 0.4] },
      transitionBase: { repeat: INF, duration: 3 },
    },
  },

  // aquatic: 水泡/波纹
  aquatic: {
    joyful: {
      char: '💧',
      positions: [{ top: '10%', left: '5%' }, { top: '20%', left: '85%' }, { top: '40%', left: '0%' }, { top: '30%', left: '90%' }],
      fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#38bdf8',
      animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.5, 1.2, 0.3] },
      transitionBase: { repeat: INF, duration: 2 },
    },
    happy: {
      char: '~',
      positions: [{ top: '60%', left: '10%' }, { top: '65%', left: '80%' }, { top: '55%', left: '50%' }],
      fontSize: '1.5rem', fontSizeSm: '1.1rem', color: '#7dd3fc',
      animateProps: { opacity: [0, 0.7, 0], x: [0, 15, 30], scale: [0.8, 1.1, 0.8] },
      transitionBase: { repeat: INF, duration: 3.5 },
    },
    calm: {
      char: '○',
      positions: [{ top: '65%', left: '25%' }, { top: '60%', left: '70%' }],
      fontSize: '1rem', fontSizeSm: '0.7rem', color: '#bae6fd',
      animateProps: { opacity: [0, 0.5, 0], scale: [0.3, 1.5, 2], y: [0, -5, -10] },
      transitionBase: { repeat: INF, duration: 4 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '55%' }, { top: '0%', left: '68%' }],
      fontSize: '1.4rem', fontSizeSm: '1rem', color: '#1e40af',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -20, -40], x: [0, 5, 10], scale: [0.6, 1.2, 0.4] },
      transitionBase: { repeat: INF, duration: 3.5 },
    },
  },

  // bouncy: 星星/音符
  bouncy: {
    joyful: {
      char: '⭐',
      positions: [{ top: '5%', left: '0%' }, { top: '15%', left: '85%' }, { top: '40%', left: '5%' }, { top: '10%', left: '75%' }],
      fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#fbbf24',
      animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.3, 1.3, 0.3], rotate: [0, 180, 360] },
      transitionBase: { repeat: INF, duration: 1.5 },
    },
    happy: {
      char: '♥',
      positions: [{ top: '5%', left: '45%' }, { top: '10%', left: '25%' }, { top: '8%', left: '65%' }],
      fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#f472b6',
      animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.3, 1, 0.3] },
      transitionBase: { repeat: INF, duration: 3 },
    },
    tired: {
      char: '💤',
      positions: [{ top: '0%', left: '60%' }, { top: '5%', left: '75%' }],
      fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#a9b4c2',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -20, -40] },
      transitionBase: { repeat: INF, duration: 3.5 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '55%' }, { top: '0%', left: '68%' }, { top: '-5%', left: '80%' }],
      fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#6a5acd',
      animateProps: { opacity: [0, 0.9, 0], y: [0, -18, -35], x: [0, 8, 15], scale: [0.6, 1.2, 0.4] },
      transitionBase: { repeat: INF, duration: 3 },
    },
  },

  // serpentine: 光芒/灵气
  serpentine: {
    joyful: {
      char: '✧',
      positions: [{ top: '5%', left: '5%' }, { top: '20%', left: '85%' }, { top: '45%', left: '0%' }],
      fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#a78bfa',
      animateProps: { opacity: [0, 1, 0], y: [0, -15, -30], x: [0, -5, -10], scale: [0.5, 1.2, 0.5] },
      transitionBase: { repeat: INF, duration: 2.5 },
    },
    calm: {
      char: '·',
      positions: [{ top: '20%', left: '15%' }, { top: '30%', left: '80%' }, { top: '50%', left: '10%' }],
      fontSize: '1.5rem', fontSizeSm: '1.1rem', color: '#c4b5fd',
      animateProps: { opacity: [0, 0.6, 0], scale: [0.5, 1.5, 0.5] },
      transitionBase: { repeat: INF, duration: 5 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '60%' }, { top: '0%', left: '72%' }],
      fontSize: '1.3rem', fontSizeSm: '1rem', color: '#6a5acd',
      animateProps: { opacity: [0, 0.9, 0], y: [0, -15, -30], x: [0, 5, 10], scale: [0.6, 1.1, 0.4] },
      transitionBase: { repeat: INF, duration: 3.5 },
    },
  },

  // plant: 叶子/花瓣
  plant: {
    joyful: {
      char: '🌿',
      positions: [{ top: '5%', left: '5%' }, { top: '15%', left: '85%' }, { top: '35%', left: '0%' }],
      fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#4ade80',
      animateProps: { opacity: [0, 1, 0], y: [0, -15, -30], x: [0, 8, 15], rotate: [0, 90, 180] },
      transitionBase: { repeat: INF, duration: 2.5 },
    },
    happy: {
      char: '🌸',
      positions: [{ top: '5%', left: '40%' }, { top: '10%', left: '65%' }],
      fontSize: '1rem', fontSizeSm: '0.8rem', color: '#f9a8d4',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -20, -35], x: [0, 5, 10], rotate: [0, 120, 240] },
      transitionBase: { repeat: INF, duration: 4 },
    },
    calm: {
      char: '🍃',
      positions: [{ top: '10%', left: '20%' }, { top: '15%', left: '75%' }],
      fontSize: '1rem', fontSizeSm: '0.8rem', color: '#86efac',
      animateProps: { opacity: [0, 0.6, 0], y: [0, -10, -20], x: [0, 8, 15] },
      transitionBase: { repeat: INF, duration: 5 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '60%' }, { top: '0%', left: '72%' }],
      fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#4ade80',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -18, -35], x: [0, 5, 10], scale: [0.6, 1.1, 0.4] },
      transitionBase: { repeat: INF, duration: 3.5 },
    },
  },

  // heavy: 岩石/碎屑
  heavy: {
    joyful: {
      char: '💥',
      positions: [{ top: '60%', left: '15%' }, { top: '65%', left: '80%' }],
      fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#a1a1aa',
      animateProps: { opacity: [0, 0.8, 0], y: [0, 5, 10], scale: [0.3, 1.2, 0.3] },
      transitionBase: { repeat: INF, duration: 2 },
    },
    tired: {
      char: '💤',
      positions: [{ top: '0%', left: '60%' }],
      fontSize: '1.5rem', fontSizeSm: '1.1rem', color: '#a9b4c2',
      animateProps: { opacity: [0, 0.8, 0], y: [0, -20, -40] },
      transitionBase: { repeat: INF, duration: 4 },
    },
    sleeping: {
      char: 'Z',
      positions: [{ top: '5%', left: '55%' }, { top: '0%', left: '68%' }, { top: '-5%', left: '78%' }],
      fontSize: '1.6rem', fontSizeSm: '1.2rem', color: '#6a5acd',
      animateProps: { opacity: [0, 0.9, 0], y: [0, -25, -50], x: [0, 8, 15], scale: [0.6, 1.3, 0.4] },
      transitionBase: { repeat: INF, duration: 3 },
    },
  },
}

// ── 个别宝可梦专属覆盖 ───────────────────────────────────────────────────

interface SpeciesOverride {
  animations?: Partial<Record<PokemonStatus, TargetAndTransition>>
  particles?: Partial<Record<PokemonStatus, ParticleConfig>>
  aura?: Partial<Record<PokemonStatus, string>>
  filter?: Partial<Record<PokemonStatus, string>>
}

export const SPECIES_OVERRIDES: Record<number, SpeciesOverride> = {
  // 皮卡丘 (25) — 电火花
  25: {
    particles: {
      joyful: {
        char: '⚡',
        positions: [{ top: '5%', left: '5%' }, { top: '15%', left: '85%' }, { top: '35%', left: '0%' }, { top: '25%', left: '90%' }],
        fontSize: '1.4rem', fontSizeSm: '1rem', color: '#facc15',
        animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.5, 1.4, 0.3], rotate: [0, 15, -15, 0] },
        transitionBase: { repeat: INF, duration: 1.5 },
      },
      anxious: {
        char: '⚡',
        positions: [{ top: '5%', left: '20%' }, { top: '10%', left: '75%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#eab308',
        animateProps: { opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1, 0.5] },
        transitionBase: { repeat: INF, duration: 1.5 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(250,204,21,0.55) 0%, rgba(234,179,8,0.2) 40%, transparent 70%)',
    },
    filter: {
      joyful: 'drop-shadow(0 0 20px rgba(250,204,21,0.7)) drop-shadow(0 12px 20px rgba(0,0,0,0.35)) saturate(1.3)',
    },
  },

  // 雷丘 (26) — 更强电光
  26: {
    particles: {
      joyful: {
        char: '⚡',
        positions: [{ top: '3%', left: '0%' }, { top: '12%', left: '88%' }, { top: '30%', left: '3%' }, { top: '20%', left: '92%' }, { top: '45%', left: '8%' }],
        fontSize: '1.5rem', fontSizeSm: '1.1rem', color: '#f59e0b',
        animateProps: { opacity: [0, 1, 0], y: [0, -22, -45], scale: [0.4, 1.5, 0.2], rotate: [0, 20, -20, 0] },
        transitionBase: { repeat: INF, duration: 1.3 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(245,158,11,0.6) 0%, rgba(217,119,6,0.25) 40%, transparent 70%)',
    },
  },

  // 喷火龙 (6) — 火焰
  6: {
    particles: {
      joyful: {
        char: '🔥',
        positions: [{ top: '5%', left: '10%' }, { top: '15%', left: '80%' }, { top: '35%', left: '5%' }, { top: '25%', left: '85%' }],
        fontSize: '1.4rem', fontSizeSm: '1rem', color: '#f97316',
        animateProps: { opacity: [0, 1, 0], y: [0, -25, -50], scale: [0.4, 1.3, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
      happy: {
        char: '🔥',
        positions: [{ top: '10%', left: '15%' }, { top: '12%', left: '78%' }],
        fontSize: '1.1rem', fontSizeSm: '0.8rem', color: '#fb923c',
        animateProps: { opacity: [0, 0.8, 0], y: [0, -20, -35] },
        transitionBase: { repeat: INF, duration: 3 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(249,115,22,0.55) 0%, rgba(234,88,12,0.2) 40%, transparent 70%)',
    },
    filter: {
      joyful: 'drop-shadow(0 0 18px rgba(249,115,22,0.65)) drop-shadow(0 14px 22px rgba(0,0,0,0.35)) saturate(1.25)',
    },
  },

  // 拉普拉斯 (131) — 海浪
  131: {
    particles: {
      calm: {
        char: '🌊',
        positions: [{ top: '60%', left: '10%' }, { top: '65%', left: '80%' }, { top: '55%', left: '45%' }],
        fontSize: '1.1rem', fontSizeSm: '0.8rem', color: '#38bdf8',
        animateProps: { opacity: [0, 0.6, 0], x: [0, 12, 25], scale: [0.8, 1.1, 0.8] },
        transitionBase: { repeat: INF, duration: 4.5 },
      },
      joyful: {
        char: '🌊',
        positions: [{ top: '55%', left: '5%' }, { top: '60%', left: '85%' }, { top: '50%', left: '45%' }],
        fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#0ea5e9',
        animateProps: { opacity: [0, 1, 0], x: [0, 15, 30], scale: [0.5, 1.2, 0.5] },
        transitionBase: { repeat: INF, duration: 2.5 },
      },
    },
    aura: {
      calm: 'radial-gradient(ellipse, rgba(14,165,233,0.4) 0%, rgba(56,189,248,0.15) 40%, transparent 70%)',
      joyful: 'radial-gradient(ellipse, rgba(14,165,233,0.55) 0%, rgba(2,132,199,0.2) 40%, transparent 70%)',
    },
  },

  // 超梦 (150) — 紫色灵能
  150: {
    animations: {
      joyful: {
        y: [0, -15, 0],
        scale: [1, 1.05, 1],
        transition: { repeat: INF, duration: 2.5, ease: 'easeInOut' },
      },
      calm: {
        y: [0, -6, 0],
        scale: [1, 1.03, 1],
        transition: { repeat: INF, duration: 4, ease: 'easeInOut' },
      },
    },
    particles: {
      joyful: {
        char: '✦',
        positions: [{ top: '5%', left: '10%' }, { top: '15%', left: '85%' }, { top: '30%', left: '5%' }, { top: '20%', left: '90%' }, { top: '45%', left: '10%' }],
        fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#8b5cf6',
        animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.3, 1.3, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
      calm: {
        char: '·',
        positions: [{ top: '10%', left: '15%' }, { top: '20%', left: '80%' }, { top: '40%', left: '10%' }, { top: '30%', left: '85%' }],
        fontSize: '1.5rem', fontSizeSm: '1.1rem', color: '#a78bfa',
        animateProps: { opacity: [0, 0.6, 0], scale: [0.5, 1.5, 0.5] },
        transitionBase: { repeat: INF, duration: 4 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(139,92,246,0.6) 0%, rgba(109,40,217,0.25) 40%, transparent 70%)',
      happy: 'radial-gradient(ellipse, rgba(139,92,246,0.4) 0%, transparent 60%)',
      calm: 'radial-gradient(ellipse, rgba(167,139,250,0.35) 0%, transparent 60%)',
      sleeping: 'radial-gradient(ellipse, rgba(88,28,135,0.35) 0%, transparent 60%)',
    },
    filter: {
      joyful: 'drop-shadow(0 0 22px rgba(139,92,246,0.7)) drop-shadow(0 14px 24px rgba(0,0,0,0.4)) saturate(1.2)',
      calm: 'drop-shadow(0 0 12px rgba(139,92,246,0.35)) drop-shadow(0 10px 20px rgba(0,0,0,0.25))',
    },
  },

  // 卡比兽 (143) — 超大呼吸 + 打鼾
  143: {
    animations: {
      sleeping: {
        scale: [1, 0.93, 1],
        y: [0, 5, 0],
        transition: { repeat: INF, duration: 5, ease: 'easeInOut' },
      },
      calm: {
        scale: [1, 1.02, 1],
        transition: { repeat: INF, duration: 6, ease: 'easeInOut' },
      },
    },
    particles: {
      sleeping: {
        char: 'Z',
        positions: [{ top: '0%', left: '50%' }, { top: '-5%', left: '62%' }, { top: '-10%', left: '72%' }, { top: '-15%', left: '80%' }],
        fontSize: '2rem', fontSizeSm: '1.5rem', color: '#6a5acd',
        animateProps: { opacity: [0, 1, 0], y: [0, -30, -60], x: [0, 10, 20], scale: [0.5, 1.5, 0.3] },
        transitionBase: { repeat: INF, duration: 3 },
      },
    },
  },

  // 伊布 (133) — 爱心粒子
  133: {
    particles: {
      joyful: {
        char: '💖',
        positions: [{ top: '5%', left: '5%' }, { top: '15%', left: '85%' }, { top: '35%', left: '0%' }, { top: '10%', left: '70%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#f472b6',
        animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.3, 1.2, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
      happy: {
        char: '♥',
        positions: [{ top: '5%', left: '40%' }, { top: '10%', left: '60%' }, { top: '8%', left: '25%' }],
        fontSize: '1.1rem', fontSizeSm: '0.8rem', color: '#ec4899',
        animateProps: { opacity: [0, 1, 0], y: [0, -22, -40], scale: [0.3, 1, 0.3] },
        transitionBase: { repeat: INF, duration: 3 },
      },
    },
  },

  // 迷你龙 (147) — 微光粒子
  147: {
    particles: {
      joyful: {
        char: '✧',
        positions: [{ top: '5%', left: '5%' }, { top: '20%', left: '88%' }, { top: '40%', left: '3%' }, { top: '30%', left: '90%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#a78bfa',
        animateProps: { opacity: [0, 1, 0], y: [0, -15, -30], scale: [0.4, 1.3, 0.3] },
        transitionBase: { repeat: INF, duration: 2.5 },
      },
      calm: {
        char: '✧',
        positions: [{ top: '15%', left: '10%' }, { top: '25%', left: '85%' }, { top: '45%', left: '5%' }],
        fontSize: '1rem', fontSizeSm: '0.7rem', color: '#c4b5fd',
        animateProps: { opacity: [0, 0.5, 0], scale: [0.3, 1, 0.3] },
        transitionBase: { repeat: INF, duration: 5 },
      },
      happy: {
        char: '✧',
        positions: [{ top: '10%', left: '15%' }, { top: '20%', left: '80%' }],
        fontSize: '1.1rem', fontSizeSm: '0.8rem', color: '#a78bfa',
        animateProps: { opacity: [0, 0.8, 0], y: [0, -12, -25], scale: [0.3, 1.1, 0.3] },
        transitionBase: { repeat: INF, duration: 4 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(167,139,250,0.5) 0%, rgba(139,92,246,0.2) 40%, transparent 70%)',
      calm: 'radial-gradient(ellipse, rgba(196,181,253,0.35) 0%, transparent 60%)',
    },
  },

  // 哈克龙 (148) — 龙之灵光
  148: {
    particles: {
      joyful: {
        char: '✧',
        positions: [{ top: '3%', left: '3%' }, { top: '15%', left: '90%' }, { top: '35%', left: '0%' }, { top: '25%', left: '92%' }],
        fontSize: '1.4rem', fontSizeSm: '1rem', color: '#818cf8',
        animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.4, 1.4, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(129,140,248,0.5) 0%, rgba(99,102,241,0.2) 40%, transparent 70%)',
    },
  },

  // 急冻鸟 (144) — 冰晶
  144: {
    particles: {
      joyful: {
        char: '❄️',
        positions: [{ top: '5%', left: '5%' }, { top: '15%', left: '85%' }, { top: '35%', left: '3%' }, { top: '25%', left: '88%' }],
        fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#7dd3fc',
        animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.4, 1.2, 0.3], rotate: [0, 90, 180] },
        transitionBase: { repeat: INF, duration: 2.5 },
      },
      calm: {
        char: '❄️',
        positions: [{ top: '10%', left: '15%' }, { top: '20%', left: '80%' }],
        fontSize: '1rem', fontSizeSm: '0.7rem', color: '#bae6fd',
        animateProps: { opacity: [0, 0.5, 0], y: [0, -10, -20], rotate: [0, 60, 120] },
        transitionBase: { repeat: INF, duration: 5 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(125,211,252,0.55) 0%, rgba(56,189,248,0.2) 40%, transparent 70%)',
      calm: 'radial-gradient(ellipse, rgba(186,230,253,0.4) 0%, transparent 60%)',
    },
    filter: {
      joyful: 'drop-shadow(0 0 18px rgba(125,211,252,0.65)) drop-shadow(0 14px 22px rgba(0,0,0,0.3)) saturate(1.15)',
    },
  },

  // 闪电鸟 (145) — 电光
  145: {
    particles: {
      joyful: {
        char: '⚡',
        positions: [{ top: '5%', left: '5%' }, { top: '15%', left: '85%' }, { top: '35%', left: '3%' }, { top: '25%', left: '88%' }],
        fontSize: '1.4rem', fontSizeSm: '1rem', color: '#facc15',
        animateProps: { opacity: [0, 1, 0], y: [0, -22, -45], scale: [0.4, 1.3, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(250,204,21,0.55) 0%, rgba(234,179,8,0.2) 40%, transparent 70%)',
    },
    filter: {
      joyful: 'drop-shadow(0 0 20px rgba(250,204,21,0.7)) drop-shadow(0 14px 22px rgba(0,0,0,0.3)) saturate(1.2)',
    },
  },

  // 火焰鸟 (146) — 烈焰
  146: {
    particles: {
      joyful: {
        char: '🔥',
        positions: [{ top: '5%', left: '5%' }, { top: '15%', left: '85%' }, { top: '35%', left: '3%' }, { top: '25%', left: '88%' }],
        fontSize: '1.4rem', fontSizeSm: '1rem', color: '#f97316',
        animateProps: { opacity: [0, 1, 0], y: [0, -25, -50], scale: [0.4, 1.3, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
      happy: {
        char: '🔥',
        positions: [{ top: '10%', left: '15%' }, { top: '15%', left: '80%' }],
        fontSize: '1.1rem', fontSizeSm: '0.8rem', color: '#fb923c',
        animateProps: { opacity: [0, 0.8, 0], y: [0, -18, -35] },
        transitionBase: { repeat: INF, duration: 3 },
      },
    },
    aura: {
      joyful: 'radial-gradient(ellipse, rgba(249,115,22,0.55) 0%, rgba(234,88,12,0.2) 40%, transparent 70%)',
    },
    filter: {
      joyful: 'drop-shadow(0 0 18px rgba(249,115,22,0.65)) drop-shadow(0 14px 22px rgba(0,0,0,0.35)) saturate(1.25)',
    },
  },

  // 快龙 (149) — 友好龙
  149: {
    particles: {
      joyful: {
        char: '♪',
        positions: [{ top: '5%', left: '5%' }, { top: '15%', left: '85%' }, { top: '30%', left: '3%' }],
        fontSize: '1.3rem', fontSizeSm: '0.9rem', color: '#fb923c',
        animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.5, 1.2, 0.5] },
        transitionBase: { repeat: INF, duration: 2 },
      },
    },
  },

  // 水伊布 (134) — 水泡
  134: {
    particles: {
      joyful: {
        char: '💧',
        positions: [{ top: '8%', left: '5%' }, { top: '18%', left: '88%' }, { top: '38%', left: '3%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#38bdf8',
        animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.4, 1.2, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
    },
  },

  // 雷伊布 (135) — 电火花
  135: {
    particles: {
      joyful: {
        char: '⚡',
        positions: [{ top: '8%', left: '5%' }, { top: '18%', left: '88%' }, { top: '38%', left: '3%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#facc15',
        animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.4, 1.2, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
    },
  },

  // 火伊布 (136) — 火花
  136: {
    particles: {
      joyful: {
        char: '🔥',
        positions: [{ top: '8%', left: '5%' }, { top: '18%', left: '88%' }, { top: '38%', left: '3%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#f97316',
        animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.4, 1.2, 0.3] },
        transitionBase: { repeat: INF, duration: 2 },
      },
    },
  },

  // 冰伊布 (471) — 冰晶
  471: {
    particles: {
      joyful: {
        char: '❄️',
        positions: [{ top: '8%', left: '5%' }, { top: '18%', left: '88%' }, { top: '38%', left: '3%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#7dd3fc',
        animateProps: { opacity: [0, 1, 0], y: [0, -18, -35], scale: [0.4, 1.2, 0.3], rotate: [0, 90, 180] },
        transitionBase: { repeat: INF, duration: 2.5 },
      },
    },
  },

  // 风速狗 (59) — 烈焰奔跑
  59: {
    particles: {
      joyful: {
        char: '🔥',
        positions: [{ top: '55%', left: '10%' }, { top: '60%', left: '80%' }, { top: '50%', left: '45%' }],
        fontSize: '1.1rem', fontSizeSm: '0.8rem', color: '#f97316',
        animateProps: { opacity: [0, 0.9, 0], x: [-10, 0, 10], y: [0, -5, 0] },
        transitionBase: { repeat: INF, duration: 1.5 },
      },
    },
  },

  // 烈焰马 (78) — 火鬃
  78: {
    particles: {
      joyful: {
        char: '🔥',
        positions: [{ top: '5%', left: '30%' }, { top: '10%', left: '60%' }, { top: '0%', left: '45%' }],
        fontSize: '1.2rem', fontSizeSm: '0.9rem', color: '#f97316',
        animateProps: { opacity: [0, 1, 0], y: [0, -20, -40], scale: [0.5, 1.2, 0.5] },
        transitionBase: { repeat: INF, duration: 2 },
      },
    },
  },
}


// ── 查询函数 ─────────────────────────────────────────────────────────────

/** 获取某宝可梦某状态的动画参数 */
export function getSpeciesAnimation(speciesId: number, status: PokemonStatus): TargetAndTransition {
  // 1. 检查个别覆盖
  const override = SPECIES_OVERRIDES[speciesId]?.animations?.[status]
  if (override) return override

  // 2. 检查类别动画
  const category = SPECIES_CATEGORY[speciesId]
  if (category) return CATEGORY_ANIMATIONS[category][status]

  // 3. 回退到默认（bipedal 作为最通用的默认）
  return CATEGORY_ANIMATIONS.bipedal[status]
}

/** 获取某宝可梦某状态的粒子效果 */
export function getSpeciesParticles(speciesId: number, status: PokemonStatus): ParticleConfig | undefined {
  // 1. 检查个别覆盖
  const override = SPECIES_OVERRIDES[speciesId]?.particles?.[status]
  if (override) return override

  // 2. 检查类别粒子
  const category = SPECIES_CATEGORY[speciesId]
  if (category) return CATEGORY_PARTICLES[category]?.[status]

  // 3. 回退到 bipedal 默认粒子
  return CATEGORY_PARTICLES.bipedal?.[status]
}

/** 获取某宝可梦某状态的光环 */
export function getSpeciesAura(speciesId: number, status: PokemonStatus, defaultAura: string): string {
  // 1. 检查个别覆盖
  const override = SPECIES_OVERRIDES[speciesId]?.aura?.[status]
  if (override) return override

  // 2. 检查类别光环
  const category = SPECIES_CATEGORY[speciesId]
  if (category) {
    const categoryAura = CATEGORY_AURA[category]?.[status]
    if (categoryAura) return categoryAura
  }

  // 3. 使用默认光环
  return defaultAura
}

/** 获取某宝可梦某状态的 CSS filter */
export function getSpeciesFilter(speciesId: number, status: PokemonStatus, defaultFilter: string): string {
  // 1. 检查个别覆盖
  const override = SPECIES_OVERRIDES[speciesId]?.filter?.[status]
  if (override) return override

  // 2. 检查类别 filter
  const category = SPECIES_CATEGORY[speciesId]
  if (category) {
    const categoryFilter = CATEGORY_FILTER[category]?.[status]
    if (categoryFilter) return categoryFilter
  }

  // 3. 使用默认 filter
  return defaultFilter
}

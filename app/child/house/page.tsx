'use client'

import { useState, useEffect, useCallback, useRef, memo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Html } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Decoration {
  id: string; name: string; category: string; price: number
  icon: string; description: string; rarity: string
}

interface HouseItem {
  id: number; child_id: number; decoration_id: string; placed: number; slot: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_SIZE = 6
const CELL_SIZE = 1

const CATEGORY_TABS = [
  { key: 'all', label: '全部', icon: '🏠' },
  { key: 'furniture', label: '家具', icon: '🪑' },
  { key: 'floor', label: '地板', icon: '🟫' },
  { key: 'wallpaper', label: '墙纸', icon: '🖼️' },
  { key: 'outdoor', label: '户外', icon: '🌳' },
  { key: 'toy', label: '玩具', icon: '🧸' },
  { key: 'functional', label: '功能', icon: '📚' },
  { key: 'door', label: '门口', icon: '🚪' },
  { key: 'bed', label: '寝具', icon: '🛏️' },
]

const DECO_COLORS: Record<string, string> = {
  furniture: '#D4A574',
  floor: '#E8D5B7',
  wallpaper: '#F5E6D3',
  outdoor: '#7CB342',
  toy: '#FF7043',
  functional: '#78909C',
  door: '#A1887F',
  bed: '#CE93D8',
}

// ── Placement metadata per decoration ────────────────────────────────────────
// zone: 'wall-back' | 'wall-left' | 'corner' | 'center' | 'entrance' | 'edge' | 'anywhere' | 'global'
// facing: rotation-y angle so item faces room interior
// size: how many cells wide × deep (for collision avoidance)
interface PlacementMeta {
  zone: 'wall-back' | 'wall-left' | 'corner' | 'center' | 'entrance' | 'edge' | 'anywhere' | 'global'
  facing: number          // rotation Y
  offsetZ?: number        // nudge toward wall
  offsetX?: number
}

const PLACEMENT_META: Record<string, PlacementMeta> = {
  // ── Furniture: mostly center or against walls ──
  'F-01': { zone: 'center', facing: 0 },                       // 圆桌
  'F-02': { zone: 'center', facing: Math.PI * 0.75 },           // 懒人沙发
  'F-03': { zone: 'wall-back', facing: 0, offsetZ: -0.3 },      // 书架靠后墙
  'F-04': { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.3 }, // 台灯靠左墙
  'F-05': { zone: 'center', facing: 0 },                        // 地毯(地面)
  'F-06': { zone: 'center', facing: Math.PI * 0.25 },           // 摇椅
  'F-07': { zone: 'corner', facing: Math.PI / 4, offsetX: -0.2, offsetZ: -0.2 }, // 吊床靠角落
  'F-08': { zone: 'wall-back', facing: 0, offsetZ: -0.3 },      // 展示柜靠墙
  'F-09': { zone: 'wall-back', facing: 0, offsetZ: -0.15 },     // 大沙发靠后墙
  'F-10': { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.2 }, // 音乐盒桌面物品
  'F-11': { zone: 'center', facing: Math.PI },                  // 接待台
  'F-12': { zone: 'corner', facing: Math.PI / 4, offsetX: -0.2, offsetZ: -0.2 }, // 宝座角落

  // ── Outdoor: along open edges (right & front) ──
  'O-01': { zone: 'edge', facing: 0 },
  'O-02': { zone: 'edge', facing: 0 },
  'O-03': { zone: 'entrance', facing: 0 },
  'O-04': { zone: 'edge', facing: 0 },
  'O-05': { zone: 'edge', facing: 0 },
  'O-06': { zone: 'edge', facing: 0 },
  'O-09': { zone: 'edge', facing: 0 },
  'O-10': { zone: 'entrance', facing: 0 },
  'O-11': { zone: 'edge', facing: 0 },
  'O-12': { zone: 'edge', facing: 0 },

  // ── Toys: center / open area ──
  'T-01': { zone: 'anywhere', facing: 0 },
  'T-02': { zone: 'anywhere', facing: 0 },
  'T-03': { zone: 'edge', facing: 0 },
  'T-04': { zone: 'center', facing: 0 },
  'T-05': { zone: 'center', facing: 0 },
  'T-06': { zone: 'center', facing: 0 },
  'T-07': { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.2 },
  'T-08': { zone: 'center', facing: 0 },
  'T-09': { zone: 'center', facing: Math.PI / 4 },
  'T-10': { zone: 'wall-back', facing: 0, offsetZ: -0.2 },

  // ── Functional: walls ──
  'FN-01': { zone: 'wall-back', facing: 0, offsetZ: -0.35 },    // 便利贴板挂墙
  'FN-03': { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.35 },  // 日历挂墙
  'FN-06': { zone: 'wall-back', facing: 0, offsetZ: -0.2 },
  'FN-07': { zone: 'wall-back', facing: 0, offsetZ: -0.25 },
  'FN-08': { zone: 'edge', facing: 0 },

  // ── Door: entrance area (far from walls = high x, high z) ──
  'D-01': { zone: 'entrance', facing: 0 },
  'D-02': { zone: 'entrance', facing: 0 },
  'D-03': { zone: 'entrance', facing: 0 },
  'D-06': { zone: 'entrance', facing: 0 },

  // ── Bed: against walls ──
  'B-01': { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.15 },
  'B-02': { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.1 },
  'B-03': { zone: 'wall-back', facing: 0, offsetZ: -0.1 },
  'B-07': { zone: 'corner', facing: Math.PI / 4, offsetX: -0.1, offsetZ: -0.1 },
  'B-08': { zone: 'wall-back', facing: 0, offsetZ: -0.15 },

  // ── Global effects (floor / wallpaper) — not rendered as 3D objects ──
}

// Zone → preferred grid positions (x, z) for GRID_SIZE=6, cells 0..5
// Back wall = z:0, Left wall = x:0, Entrance = x:5/z:5, Edge = x:4-5 or z:4-5
const ZONE_POSITIONS: Record<string, [number, number][]> = {
  'wall-back':  [[1, 0], [2, 0], [3, 0], [4, 0], [0, 0], [1, 1], [2, 1], [3, 1]],
  'wall-left':  [[0, 1], [0, 2], [0, 3], [0, 4], [0, 0], [1, 1], [1, 2], [1, 3]],
  'corner':     [[0, 0], [1, 0], [0, 1], [1, 1]],
  'center':     [[2, 2], [3, 3], [2, 3], [3, 2], [2, 4], [3, 4], [4, 2], [4, 3], [1, 2], [1, 3]],
  'entrance':   [[5, 5], [4, 5], [5, 4], [5, 3], [4, 4], [3, 5]],
  'edge':       [[5, 1], [5, 2], [5, 3], [4, 5], [3, 5], [5, 0], [5, 4], [4, 0], [1, 5], [2, 5]],
  'anywhere':   [[3, 4], [4, 3], [2, 4], [4, 2], [1, 4], [4, 1], [3, 1], [1, 3], [2, 2], [3, 3]],
}

/** Compute placement positions for all placed items, respecting zones & avoiding overlap */
function computePlacements(
  placedItems: HouseItem[],
  getDecoInfo: (id: string) => Decoration | undefined,
): Map<number, { x: number; z: number; ry: number }> {
  const result = new Map<number, { x: number; z: number; ry: number }>()
  const occupied = new Set<string>()

  for (const item of placedItems) {
    const info = getDecoInfo(item.decoration_id)
    if (!info) continue

    // floor / wallpaper are global effects, not physical placements
    if (info.category === 'floor' || info.category === 'wallpaper') continue

    const meta = PLACEMENT_META[item.decoration_id] || { zone: 'anywhere', facing: 0 }
    const positions = ZONE_POSITIONS[meta.zone] || ZONE_POSITIONS['anywhere']

    let placed = false
    for (const [px, pz] of positions) {
      const key = `${px},${pz}`
      if (!occupied.has(key)) {
        occupied.add(key)
        result.set(item.id, {
          x: px + (meta.offsetX || 0),
          z: pz + (meta.offsetZ || 0),
          ry: meta.facing,
        })
        placed = true
        break
      }
    }
    // Fallback — find any open cell
    if (!placed) {
      for (let z = 0; z < GRID_SIZE; z++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const key = `${x},${z}`
          if (!occupied.has(key)) {
            occupied.add(key)
            result.set(item.id, { x: x + (meta.offsetX || 0), z: z + (meta.offsetZ || 0), ry: meta.facing })
            placed = true
            break
          }
        }
        if (placed) break
      }
    }
  }
  return result
}

const FLOOR_COLORS: Record<string, string> = {
  default: '#E8D5B7',
  common: '#D2B48C',
  uncommon: '#8FBC8F',
  rare: '#87CEEB',
  epic: '#DDA0DD',
}

const WALL_COLORS: Record<string, string> = {
  default: '#FFF8F0',
  common: '#F5E6D3',
  uncommon: '#E8F5E9',
  rare: '#E3F2FD',
  epic: '#F3E5F5',
}

// ── 3D Components ─────────────────────────────────────────────────────────────

/** Ground / floor grid */
const HouseFloor = memo(function HouseFloor({ color }: { color: string }) {
  return (
    <group>
      {/* Main floor */}
      <mesh receiveShadow position={[GRID_SIZE / 2 - 0.5, -0.05, GRID_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Grid lines - subtle tile borders */}
      {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
        <group key={`grid-${i}`}>
          <mesh position={[i - 0.5, 0.005, GRID_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.02, GRID_SIZE]} />
            <meshBasicMaterial color="#00000020" transparent opacity={0.1} />
          </mesh>
          <mesh position={[GRID_SIZE / 2 - 0.5, 0.005, i - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[GRID_SIZE, 0.02]} />
            <meshBasicMaterial color="#00000020" transparent opacity={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  )
})

/** L-shaped walls — low walls for open interior view */
const HouseWalls = memo(function HouseWalls({ color }: { color: string }) {
  const wallHeight = 1.2
  const wallThickness = 0.1

  return (
    <group>
      {/* Back wall (along X axis at Z = -0.5) */}
      <mesh position={[GRID_SIZE / 2 - 0.5, wallHeight / 2, -0.5 - wallThickness / 2]} castShadow>
        <boxGeometry args={[GRID_SIZE, wallHeight, wallThickness]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Left wall (along Z axis at X = -0.5) */}
      <mesh position={[-0.5 - wallThickness / 2, wallHeight / 2, GRID_SIZE / 2 - 0.5]} castShadow>
        <boxGeometry args={[wallThickness, wallHeight, GRID_SIZE]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Wall top trim — decorative strip */}
      <mesh position={[GRID_SIZE / 2 - 0.5, wallHeight, -0.5 - wallThickness / 2]} castShadow>
        <boxGeometry args={[GRID_SIZE + 0.06, 0.06, wallThickness + 0.04]} />
        <meshStandardMaterial color="#A5D6A7" />
      </mesh>
      <mesh position={[-0.5 - wallThickness / 2, wallHeight, GRID_SIZE / 2 - 0.5]} castShadow>
        <boxGeometry args={[wallThickness + 0.04, 0.06, GRID_SIZE + 0.06]} />
        <meshStandardMaterial color="#A5D6A7" />
      </mesh>
    </group>
  )
})

/** 3D model builder — returns realistic geometry per decoration id / category
 *  Scale: 1 unit = 1 meter. Room is 6m × 6m.
 *  Real-world references: table ~0.75m tall, chair seat ~0.45m, sofa ~0.4m seat / ~0.8m back,
 *  bookshelf ~1.2m tall, bed ~0.5m tall, lamp ~0.5m, fence ~0.9m, tree ~1.5m */
function Furniture3DModel({ id, category, color }: { id: string; category: string; color: string }) {
  const wood = '#A0764A'
  const woodDark = '#7A5530'
  const white = '#F5F5F0'
  const metal = '#9E9E9E'

  // ── Furniture ─────────────────────────────────────────────────
  if (id === 'F-01') {
    // 木质小圆桌 (0.7m桌面直径, 0.75m高) + 椅子
    return (
      <group>
        {/* Table top */}
        <mesh position={[0, 0.73, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.04, 16]} />
          <meshStandardMaterial color={wood} />
        </mesh>
        {/* Table leg */}
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.06, 0.72, 8]} />
          <meshStandardMaterial color={woodDark} />
        </mesh>
        {/* Chair 1 */}
        <group position={[0.5, 0, 0.1]}>
          <mesh position={[0, 0.44, 0]} castShadow><boxGeometry args={[0.38, 0.04, 0.38]} /><meshStandardMaterial color={wood} /></mesh>
          {[[-0.14, 0.22, -0.14], [0.14, 0.22, -0.14], [-0.14, 0.22, 0.14], [0.14, 0.22, 0.14]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} castShadow><cylinderGeometry args={[0.02, 0.02, 0.44, 6]} /><meshStandardMaterial color={woodDark} /></mesh>
          ))}
          <mesh position={[0, 0.68, -0.16]} castShadow><boxGeometry args={[0.38, 0.44, 0.03]} /><meshStandardMaterial color={wood} /></mesh>
        </group>
        {/* Chair 2 */}
        <group position={[-0.5, 0, -0.1]} rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 0.44, 0]} castShadow><boxGeometry args={[0.38, 0.04, 0.38]} /><meshStandardMaterial color={wood} /></mesh>
          {[[-0.14, 0.22, -0.14], [0.14, 0.22, -0.14], [-0.14, 0.22, 0.14], [0.14, 0.22, 0.14]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} castShadow><cylinderGeometry args={[0.02, 0.02, 0.44, 6]} /><meshStandardMaterial color={woodDark} /></mesh>
          ))}
          <mesh position={[0, 0.68, -0.16]} castShadow><boxGeometry args={[0.38, 0.44, 0.03]} /><meshStandardMaterial color={wood} /></mesh>
        </group>
      </group>
    )
  }
  if (id === 'F-02') {
    // 毛茸茸懒人沙发 (直径0.9m, 高0.45m)
    return (
      <group>
        <mesh position={[0, 0.22, 0]} castShadow>
          <sphereGeometry args={[0.45, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#F48FB1" />
        </mesh>
        <mesh position={[0, 0.01, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.48, 0.02, 16]} />
          <meshStandardMaterial color="#EC407A" />
        </mesh>
      </group>
    )
  }
  if (id === 'F-03') {
    // 书架 — 三层 (0.8m宽, 1.2m高, 0.3m深)
    return (
      <group>
        {[0, 0.38, 0.76].map((y, i) => (
          <group key={i}>
            <mesh position={[0, y, 0]} castShadow><boxGeometry args={[0.8, 0.03, 0.3]} /><meshStandardMaterial color={wood} /></mesh>
            {Array.from({ length: 4 + i }).map((_, j) => (
              <mesh key={j} position={[-0.3 + j * 0.14, y + 0.14, 0]} castShadow>
                <boxGeometry args={[0.08, 0.26, 0.22]} />
                <meshStandardMaterial color={['#5C6BC0', '#EF5350', '#66BB6A', '#FFA726', '#AB47BC', '#42A5F5'][j % 6]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 1.14, 0]} castShadow><boxGeometry args={[0.8, 0.03, 0.3]} /><meshStandardMaterial color={wood} /></mesh>
        <mesh position={[-0.4, 0.57, 0]} castShadow><boxGeometry args={[0.03, 1.14, 0.3]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0.4, 0.57, 0]} castShadow><boxGeometry args={[0.03, 1.14, 0.3]} /><meshStandardMaterial color={woodDark} /></mesh>
      </group>
    )
  }
  if (id === 'F-04') {
    // 皮卡丘台灯 (总高0.5m)
    return (
      <group>
        <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.1, 0.12, 0.03, 16]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.015, 0.015, 0.38, 8]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0, 0.44, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.4} />
        </mesh>
        <pointLight position={[0, 0.44, 0]} intensity={0.5} distance={2.5} color="#FFE0B2" />
      </group>
    )
  }
  if (id === 'F-05') {
    // 宝可梦图案地毯 (直径1.2m, 铺在地上)
    return (
      <group>
        <mesh position={[0, 0.005, 0]} receiveShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.01, 24]} />
          <meshStandardMaterial color="#E53935" />
        </mesh>
        {/* White pokeball line */}
        <mesh position={[0, 0.01, 0]} receiveShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.005, 20]} />
          <meshStandardMaterial color={white} />
        </mesh>
      </group>
    )
  }
  if (id === 'F-06') {
    // 贝壳形摇椅 (0.7m宽, 0.6m高)
    return (
      <group>
        <mesh position={[0, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={white} side={THREE.DoubleSide} />
        </mesh>
        {/* Rocker base */}
        <mesh position={[0, 0.03, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.35, 0.025, 8, 24, Math.PI]} />
          <meshStandardMaterial color={woodDark} />
        </mesh>
      </group>
    )
  }
  if (id === 'F-07') {
    // 星空吊床 (0.8m宽, 柱高1.0m)
    return (
      <group>
        <mesh position={[-0.4, 0.5, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 1.0, 8]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0.4, 0.5, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 1.0, 8]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0, 0.38, 0]} castShadow>
          <boxGeometry args={[0.7, 0.03, 0.4]} />
          <meshStandardMaterial color="#1A237E" />
        </mesh>
        {/* Top bar */}
        <mesh position={[0, 0.95, 0]} castShadow><boxGeometry args={[0.85, 0.04, 0.04]} /><meshStandardMaterial color={woodDark} /></mesh>
      </group>
    )
  }
  if (id === 'F-08') {
    // 水晶玻璃展示柜 (0.6m宽, 1.2m高, 0.35m深)
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.6, 1.2, 0.35]} />
          <meshStandardMaterial color="#E3F2FD" transparent opacity={0.35} />
        </mesh>
        {[0.2, 0.5, 0.8].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} castShadow><boxGeometry args={[0.58, 0.02, 0.33]} /><meshStandardMaterial color="#B3E5FC" transparent opacity={0.5} /></mesh>
        ))}
        {/* Frame edges */}
        {[[-0.3, 0], [0.3, 0]].map(([x], i) => (
          <mesh key={i} position={[x, 0.6, 0]} castShadow><boxGeometry args={[0.02, 1.2, 0.35]} /><meshStandardMaterial color="#90CAF9" /></mesh>
        ))}
      </group>
    )
  }
  if (id === 'F-09') {
    // 豪华双人大沙发 (1.6m宽, 座高0.42m, 背高0.8m, 0.7m深)
    return (
      <group>
        <mesh position={[0, 0.21, 0.05]} castShadow><boxGeometry args={[1.5, 0.42, 0.65]} /><meshStandardMaterial color="#2E7D32" /></mesh>
        <mesh position={[0, 0.55, -0.28]} castShadow><boxGeometry args={[1.5, 0.42, 0.1]} /><meshStandardMaterial color="#1B5E20" /></mesh>
        <mesh position={[-0.72, 0.35, 0.05]} castShadow><boxGeometry args={[0.08, 0.3, 0.65]} /><meshStandardMaterial color="#1B5E20" /></mesh>
        <mesh position={[0.72, 0.35, 0.05]} castShadow><boxGeometry args={[0.08, 0.3, 0.65]} /><meshStandardMaterial color="#1B5E20" /></mesh>
        {/* Cushions */}
        <mesh position={[-0.32, 0.46, 0.05]} castShadow><boxGeometry args={[0.35, 0.08, 0.25]} /><meshStandardMaterial color="#A5D6A7" /></mesh>
        <mesh position={[0.32, 0.46, 0.05]} castShadow><boxGeometry args={[0.35, 0.08, 0.25]} /><meshStandardMaterial color="#A5D6A7" /></mesh>
      </group>
    )
  }
  if (id === 'F-10') {
    // 魔法音乐盒 (0.2m宽, 0.25m高)
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><boxGeometry args={[0.2, 0.2, 0.18]} /><meshStandardMaterial color="#6D4C41" /></mesh>
        <mesh position={[0, 0.24, 0]} castShadow><cylinderGeometry args={[0.06, 0.06, 0.06, 16]} /><meshStandardMaterial color="#FFD54F" metalness={0.6} /></mesh>
      </group>
    )
  }
  if (id === 'F-11') {
    // 宝可梦中心接待台 (1.2m宽, 1.0m高, 0.5m深)
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[1.2, 1.0, 0.5]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><boxGeometry args={[1.22, 0.04, 0.52]} /><meshStandardMaterial color="#E53935" /></mesh>
        {/* Red cross on front */}
        <mesh position={[0, 0.6, 0.26]} castShadow><boxGeometry args={[0.3, 0.06, 0.01]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.6, 0.26]} castShadow><boxGeometry args={[0.06, 0.3, 0.01]} /><meshStandardMaterial color="#E53935" /></mesh>
      </group>
    )
  }
  if (id === 'F-12') {
    // 冠军宝座 (0.6m宽, 座高0.48m, 背高1.1m)
    return (
      <group>
        <mesh position={[0, 0.24, 0]} castShadow><boxGeometry args={[0.6, 0.08, 0.55]} /><meshStandardMaterial color="#FFD54F" metalness={0.5} /></mesh>
        <mesh position={[0, 0.7, -0.22]} castShadow><boxGeometry args={[0.6, 0.82, 0.08]} /><meshStandardMaterial color="#FFC107" metalness={0.4} /></mesh>
        <mesh position={[-0.28, 0.42, 0.05]} castShadow><boxGeometry args={[0.06, 0.34, 0.45]} /><meshStandardMaterial color="#FFC107" metalness={0.4} /></mesh>
        <mesh position={[0.28, 0.42, 0.05]} castShadow><boxGeometry args={[0.06, 0.34, 0.45]} /><meshStandardMaterial color="#FFC107" metalness={0.4} /></mesh>
        {[[-0.22, 0.18], [0.22, 0.18], [-0.22, -0.2], [0.22, -0.2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.1, z]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.2, 8]} /><meshStandardMaterial color="#B8860B" /></mesh>
        ))}
      </group>
    )
  }

  // ── Outdoor 户外 ─────────────────────────────────────────────
  if (id === 'O-01') {
    // 向日葵花盆 (花盆0.25m, 总高0.7m)
    return (
      <group>
        <mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.14, 0.11, 0.24, 12]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.42, 0]} castShadow><cylinderGeometry args={[0.02, 0.02, 0.36, 6]} /><meshStandardMaterial color="#558B2F" /></mesh>
        <mesh position={[0, 0.64, 0]} castShadow><cylinderGeometry args={[0.14, 0.14, 0.05, 12]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        <mesh position={[0, 0.64, 0]} castShadow><cylinderGeometry args={[0.065, 0.065, 0.06, 10]} /><meshStandardMaterial color="#5D4037" /></mesh>
      </group>
    )
  }
  if (id === 'O-02') {
    // 小木栅栏 (0.9m宽, 0.7m高)
    return (
      <group>
        {[-0.35, -0.18, 0, 0.18, 0.35].map((x, i) => (
          <mesh key={i} position={[x, 0.35, 0]} castShadow><boxGeometry args={[0.05, 0.7, 0.04]} /><meshStandardMaterial color={white} /></mesh>
        ))}
        <mesh position={[0, 0.52, 0]} castShadow><boxGeometry args={[0.78, 0.05, 0.04]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.78, 0.05, 0.04]} /><meshStandardMaterial color={white} /></mesh>
      </group>
    )
  }
  if (id === 'O-03') {
    // 石头小径 (散布在0.8m×0.8m区域)
    return (
      <group>
        {[[-0.2, 0.15], [0.15, -0.08], [-0.08, -0.25], [0.25, 0.2], [0, 0]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.025, z]} castShadow>
            <cylinderGeometry args={[0.1 + i * 0.01, 0.11 + i * 0.01, 0.05, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#9E9E9E' : '#BDBDBD'} />
          </mesh>
        ))}
      </group>
    )
  }
  if (id === 'O-04') {
    // 樱桃树盆栽 (盆0.28m, 总高1.0m)
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.14, 0.11, 0.2, 10]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[0.04, 0.05, 0.5, 6]} /><meshStandardMaterial color="#5D4037" /></mesh>
        <mesh position={[0, 0.8, 0]} castShadow><sphereGeometry args={[0.3, 12, 12]} /><meshStandardMaterial color="#F48FB1" /></mesh>
      </group>
    )
  }
  if (id === 'O-05') {
    // 蘑菇路灯 (总高1.0m)
    return (
      <group>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.04, 0.05, 0.8, 8]} /><meshStandardMaterial color="#EFEBE9" /></mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.22, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#E53935" emissive="#E53935" emissiveIntensity={0.2} />
        </mesh>
        <pointLight position={[0, 0.8, 0]} intensity={0.4} distance={2} color="#FFCCBC" />
      </group>
    )
  }
  if (id === 'O-06') {
    // 精灵球喷水池 (直径0.9m, 高0.45m)
    return (
      <group>
        <mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.45, 0.38, 0.24, 16]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        <mesh position={[0, 0.26, 0]} castShadow><cylinderGeometry args={[0.38, 0.38, 0.04, 16]} /><meshStandardMaterial color="#64B5F6" transparent opacity={0.7} /></mesh>
        <mesh position={[0, 0.38, 0]} castShadow><sphereGeometry args={[0.14, 12, 12]} /><meshStandardMaterial color="#E53935" /></mesh>
      </group>
    )
  }
  if (id === 'O-09') {
    // 宝可梦石像 (底座0.4m, 总高0.75m)
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><boxGeometry args={[0.4, 0.2, 0.4]} /><meshStandardMaterial color="#9E9E9E" /></mesh>
        <mesh position={[0, 0.42, 0]} castShadow><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        <mesh position={[-0.14, 0.62, 0]} castShadow rotation={[0, 0, -0.3]}><coneGeometry args={[0.06, 0.15, 6]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        <mesh position={[0.14, 0.62, 0]} castShadow rotation={[0, 0, 0.3]}><coneGeometry args={[0.06, 0.15, 6]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
      </group>
    )
  }
  if (id === 'O-10') {
    // 彩虹桥 (拱跨0.8m, 高0.6m)
    return (
      <group>
        <mesh position={[0, 0.3, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.4, 0.07, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#FF7043" />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.32, 0.05, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#FFEE58" />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.04, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#66BB6A" />
        </mesh>
      </group>
    )
  }
  if (id === 'O-11') {
    // 光之树 (总高1.5m)
    return (
      <group>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.05, 0.08, 0.8, 8]} /><meshStandardMaterial color="#FAFAFA" /></mesh>
        <mesh position={[0, 0.95, 0]} castShadow><sphereGeometry args={[0.4, 12, 12]} /><meshStandardMaterial color="#FFFDE7" emissive="#FFF9C4" emissiveIntensity={0.6} transparent opacity={0.85} /></mesh>
        <pointLight position={[0, 0.95, 0]} intensity={0.7} distance={3} color="#FFF9C4" />
      </group>
    )
  }
  if (id === 'O-12') {
    // 胜利旗杆 (总高1.5m)
    return (
      <group>
        <mesh position={[0, 0.75, 0]} castShadow><cylinderGeometry args={[0.025, 0.03, 1.5, 8]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0.15, 1.3, 0]} castShadow><boxGeometry args={[0.28, 0.18, 0.01]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.015, 0]} castShadow><cylinderGeometry args={[0.12, 0.12, 0.03, 12]} /><meshStandardMaterial color="#757575" /></mesh>
      </group>
    )
  }

  // ── Toy 玩具 ──────────────────────────────────────────────────
  if (id === 'T-01') {
    // 毛线球 (直径0.15m)
    return (<mesh position={[0, 0.08, 0]} castShadow><sphereGeometry args={[0.08, 12, 12]} /><meshStandardMaterial color="#E91E63" /></mesh>)
  }
  if (id === 'T-02') {
    // 精灵球玩具 (直径0.2m)
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#E53935" />
        </mesh>
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.1, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color={white} />
        </mesh>
        <mesh position={[0, 0.1, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.008, 8, 24]} />
          <meshStandardMaterial color="#212121" />
        </mesh>
      </group>
    )
  }
  if (id === 'T-03') {
    // 旋转风车 (杆高0.6m)
    return (
      <group>
        <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.015, 0.02, 0.6, 6]} /><meshStandardMaterial color={woodDark} /></mesh>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} position={[0, 0.58, 0]} castShadow rotation={[0, 0, (i * Math.PI) / 2]}>
            <boxGeometry args={[0.025, 0.2, 0.01]} />
            <meshStandardMaterial color={['#E53935', '#2196F3', '#FFEB3B', '#4CAF50'][i]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (id === 'T-04') {
    // 积木套装 (地面堆叠, 约0.25m高)
    return (
      <group>
        {[
          { p: [0, 0.06, 0], s: [0.2, 0.12, 0.2], c: '#E53935' },
          { p: [-0.04, 0.18, 0.02], s: [0.15, 0.12, 0.15], c: '#2196F3' },
          { p: [0.04, 0.28, -0.01], s: [0.1, 0.1, 0.1], c: '#FFEB3B' },
        ].map((b, i) => (
          <mesh key={i} position={b.p as [number, number, number]} castShadow>
            <boxGeometry args={b.s as [number, number, number]} />
            <meshStandardMaterial color={b.c} />
          </mesh>
        ))}
      </group>
    )
  }
  if (id === 'T-05') {
    // 宝可梦拼图 (0.4m×0.3m, 铺在地上)
    return (
      <group>
        <mesh position={[0, 0.01, 0]} receiveShadow><boxGeometry args={[0.4, 0.02, 0.3]} /><meshStandardMaterial color="#FFF9C4" /></mesh>
        {[[-0.1, 0.025, -0.07], [0.1, 0.025, -0.07], [-0.1, 0.025, 0.07], [0.1, 0.025, 0.07]].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.16, 0.01, 0.12]} />
            <meshStandardMaterial color={['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC'][i]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (id === 'T-06') {
    // 弹跳蹦床 (直径0.8m, 高0.3m)
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.4, 0.4, 0.05, 16]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0, 0.15, 0]} castShadow><cylinderGeometry args={[0.35, 0.35, 0.02, 16]} /><meshStandardMaterial color="#1565C0" /></mesh>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
              <meshStandardMaterial color={metal} />
            </mesh>
          )
        })}
      </group>
    )
  }
  if (id === 'T-07') {
    // 魔法水晶球 (底座+球, 总高0.35m)
    return (
      <group>
        <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.08, 0.1, 0.08, 12]} /><meshStandardMaterial color="#5D4037" /></mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#CE93D8" transparent opacity={0.6} emissive="#CE93D8" emissiveIntensity={0.3} />
        </mesh>
        <pointLight position={[0, 0.2, 0]} intensity={0.3} distance={1.5} color="#CE93D8" />
      </group>
    )
  }
  if (id === 'T-08') {
    // 迷你滑梯 (0.8m长, 0.6m高)
    return (
      <group>
        <mesh position={[0, 0.3, 0.05]} castShadow rotation={[0.45, 0, 0]}>
          <boxGeometry args={[0.35, 0.03, 0.75]} />
          <meshStandardMaterial color="#FFEB3B" />
        </mesh>
        <mesh position={[-0.18, 0.33, 0.05]} castShadow rotation={[0.45, 0, 0]}><boxGeometry args={[0.02, 0.12, 0.75]} /><meshStandardMaterial color="#F44336" /></mesh>
        <mesh position={[0.18, 0.33, 0.05]} castShadow rotation={[0.45, 0, 0]}><boxGeometry args={[0.02, 0.12, 0.75]} /><meshStandardMaterial color="#F44336" /></mesh>
        {/* Ladder back */}
        <mesh position={[0, 0.32, -0.28]} castShadow><boxGeometry args={[0.3, 0.6, 0.04]} /><meshStandardMaterial color="#2196F3" /></mesh>
      </group>
    )
  }
  if (id === 'T-09') {
    // 宝可梦乐器套装 (散布0.5m区域)
    return (
      <group>
        <mesh position={[-0.18, 0.1, 0]} castShadow><cylinderGeometry args={[0.12, 0.12, 0.2, 12]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0.15, 0.2, 0]} castShadow rotation={[0, 0, 0.2]}><sphereGeometry args={[0.1, 10, 10]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0.2, 0.45, 0]} castShadow rotation={[0, 0, 0.2]}><boxGeometry args={[0.04, 0.35, 0.025]} /><meshStandardMaterial color="#5D4037" /></mesh>
      </group>
    )
  }
  if (id === 'T-10') {
    // 时光胶囊 (0.25m长)
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.06, 0.14, 8, 16]} />
          <meshStandardMaterial color="#B39DDB" emissive="#B39DDB" emissiveIntensity={0.3} transparent opacity={0.8} />
        </mesh>
        <pointLight position={[0, 0.1, 0]} intensity={0.25} distance={1} color="#B39DDB" />
      </group>
    )
  }

  // ── Functional 功能性 ─────────────────────────────────────────
  if (id === 'FN-01') {
    // 心愿便利贴板 (0.6m×0.5m, 挂在墙面上)
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[0.6, 0.5, 0.03]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        {[[-0.15, 0.7], [0.12, 0.55], [-0.08, 0.48], [0.18, 0.72]].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.02]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.005]} />
            <meshStandardMaterial color={['#FFEB3B', '#F48FB1', '#81D4FA', '#A5D6A7'][i]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (id === 'FN-03') {
    // 宝可梦日历 (0.25m×0.35m, 挂墙)
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[0.25, 0.35, 0.03]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.76, 0]} castShadow><boxGeometry args={[0.25, 0.05, 0.03]} /><meshStandardMaterial color="#E53935" /></mesh>
      </group>
    )
  }
  if (id === 'FN-06') {
    // 时间沙漏 (0.15m宽, 0.35m高)
    return (
      <group>
        <mesh position={[0, 0.02, 0]} castShadow><boxGeometry args={[0.15, 0.03, 0.15]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[0.15, 0.03, 0.15]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        <mesh position={[0, 0.11, 0]} castShadow><cylinderGeometry args={[0.055, 0.02, 0.14, 12]} /><meshStandardMaterial color="#FFCC80" transparent opacity={0.6} /></mesh>
        <mesh position={[0, 0.26, 0]} castShadow><cylinderGeometry args={[0.02, 0.055, 0.14, 12]} /><meshStandardMaterial color="#FFCC80" transparent opacity={0.6} /></mesh>
      </group>
    )
  }
  if (id === 'FN-07') {
    // 荣誉奖杯柜 (0.6m宽, 1.2m高, 0.35m深)
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.6, 1.2, 0.35]} />
          <meshStandardMaterial color="#E3F2FD" transparent opacity={0.35} />
        </mesh>
        <mesh position={[0, 0.35, 0]} castShadow><cylinderGeometry args={[0.07, 0.05, 0.08, 8]} /><meshStandardMaterial color="#FFD54F" metalness={0.6} /></mesh>
        <mesh position={[0, 0.48, 0]} castShadow><cylinderGeometry args={[0.1, 0.07, 0.14, 8]} /><meshStandardMaterial color="#FFD54F" metalness={0.6} /></mesh>
        {/* Shelves */}
        {[0.25, 0.6, 0.95].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} castShadow><boxGeometry args={[0.58, 0.02, 0.33]} /><meshStandardMaterial color="#90CAF9" transparent opacity={0.5} /></mesh>
        ))}
      </group>
    )
  }
  if (id === 'FN-08') {
    // 成长树 (盆0.2m, 总高1.0m)
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.12, 0.1, 0.2, 10]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.05, 0.07, 0.4, 8]} /><meshStandardMaterial color="#5D4037" /></mesh>
        <mesh position={[0, 0.72, 0]} castShadow><sphereGeometry args={[0.25, 12, 12]} /><meshStandardMaterial color="#43A047" /></mesh>
        <mesh position={[-0.18, 0.6, 0]} castShadow><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#66BB6A" /></mesh>
        <mesh position={[0.15, 0.64, 0.1]} castShadow><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#66BB6A" /></mesh>
      </group>
    )
  }

  // ── Door 门口 ──────────────────────────────────────────────────
  if (id === 'D-01') {
    // 彩色门垫 (0.6m×0.4m, 地面)
    return (
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[0.6, 0.01, 0.4]} />
        <meshStandardMaterial color="#FF7043" />
      </mesh>
    )
  }
  if (id === 'D-02') {
    // 精灵球门牌 (直径0.2m, 挂在低处)
    return (
      <group>
        <mesh position={[0, 0.35, 0]} castShadow><cylinderGeometry args={[0.1, 0.1, 0.025, 16]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.35, 0.013]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.01, 12]} /><meshStandardMaterial color={white} /></mesh>
      </group>
    )
  }
  if (id === 'D-03') {
    // 植物门帘 (0.4m宽, 0.7m高)
    return (
      <group>
        {[-0.14, -0.05, 0.05, 0.14].map((x, i) => (
          <mesh key={i} position={[x, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.55 + i * 0.03, 6]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#388E3C' : '#4CAF50'} />
          </mesh>
        ))}
        <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[0.4, 0.05, 0.05]} /><meshStandardMaterial color={woodDark} /></mesh>
      </group>
    )
  }
  if (id === 'D-06') {
    // 星星风铃 (0.25m宽, 0.5m高)
    return (
      <group>
        <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[0.22, 0.03, 0.03]} /><meshStandardMaterial color={woodDark} /></mesh>
        {[-0.08, 0, 0.08].map((x, i) => (
          <group key={i}>
            <mesh position={[x, 0.4 - i * 0.07, 0]} castShadow><cylinderGeometry args={[0.003, 0.003, 0.18 + i * 0.06, 4]} /><meshStandardMaterial color={metal} /></mesh>
            <mesh position={[x, 0.3 - i * 0.07, 0]} castShadow>
              <octahedronGeometry args={[0.04, 0]} />
              <meshStandardMaterial color="#FFD54F" metalness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    )
  }

  // ── Bed 寝具 ───────────────────────────────────────────────────
  if (id === 'B-01') {
    // 草编小窝 (直径0.5m, 高0.15m)
    return (
      <group>
        <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.28, 0.24, 0.16, 16]} /><meshStandardMaterial color="#D4A574" /></mesh>
        <mesh position={[0, 0.06, 0]} castShadow><cylinderGeometry args={[0.22, 0.2, 0.06, 16]} /><meshStandardMaterial color="#EFEBE9" /></mesh>
      </group>
    )
  }
  if (id === 'B-02') {
    // 云朵床 (0.6m长, 高0.25m)
    return (
      <group>
        <mesh position={[0, 0.12, 0]} castShadow><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[-0.16, 0.1, 0]} castShadow><sphereGeometry args={[0.14, 10, 10]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0.16, 0.1, 0]} castShadow><sphereGeometry args={[0.14, 10, 10]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.1, -0.14]} castShadow><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial color={white} /></mesh>
      </group>
    )
  }
  if (id === 'B-03') {
    // 星星睡袋 (0.5m×0.8m, 很矮)
    return (
      <group>
        <mesh position={[0, 0.06, 0]} castShadow><boxGeometry args={[0.5, 0.1, 0.8]} /><meshStandardMaterial color="#1A237E" /></mesh>
        <mesh position={[0, 0.13, -0.3]} castShadow><boxGeometry args={[0.5, 0.14, 0.15]} /><meshStandardMaterial color="#283593" /></mesh>
      </group>
    )
  }
  if (id === 'B-07') {
    // 皇家四柱床 (0.8m宽, 1.0m长, 柱高1.2m)
    return (
      <group>
        <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[0.8, 0.15, 1.0]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.26, 0]} castShadow><boxGeometry args={[0.75, 0.08, 0.95]} /><meshStandardMaterial color="#CE93D8" /></mesh>
        <mesh position={[0, 0.33, -0.35]} castShadow><boxGeometry args={[0.55, 0.08, 0.18]} /><meshStandardMaterial color={white} /></mesh>
        {[[-0.37, -0.47], [0.37, -0.47], [-0.37, 0.47], [0.37, 0.47]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.6, z]} castShadow><cylinderGeometry args={[0.03, 0.03, 1.05, 8]} /><meshStandardMaterial color="#5D4037" /></mesh>
        ))}
        <mesh position={[0, 1.1, 0]} castShadow><boxGeometry args={[0.82, 0.025, 1.02]} /><meshStandardMaterial color="#5D4037" /></mesh>
      </group>
    )
  }
  if (id === 'B-08') {
    // 梦境发生器 (0.7m宽, 1.0m长, 0.5m高)
    return (
      <group>
        <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[0.7, 0.16, 1.0]} /><meshStandardMaterial color="#37474F" /></mesh>
        <mesh position={[0, 0.26, 0]} castShadow>
          <boxGeometry args={[0.65, 0.05, 0.95]} />
          <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={0.3} transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 0.38, -0.42]} castShadow>
          <boxGeometry args={[0.7, 0.24, 0.08]} />
          <meshStandardMaterial color="#455A64" />
        </mesh>
        <pointLight position={[0, 0.3, 0]} intensity={0.4} distance={2} color="#4FC3F7" />
      </group>
    )
  }

  // ── Fallback: generic colored box for unknown items ─
  return (
    <RoundedBox args={[0.5, 0.5, 0.5]} radius={0.06} smoothness={4} position={[0, 0.25, 0]} castShadow>
      <meshStandardMaterial color={color} />
    </RoundedBox>
  )
}

/** Single decoration item in 3D */
const DecorationItem3D = memo(function DecorationItem3D({
  decoration, gridX, gridZ, rotationY, isHovered, isSelected, onClick, onPointerOver, onPointerOut,
}: {
  decoration: Decoration
  gridX: number; gridZ: number; rotationY: number
  isHovered: boolean; isSelected: boolean
  onClick: () => void
  onPointerOver: () => void
  onPointerOut: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const color = DECO_COLORS[decoration.category] || '#AAAAAA'

  useFrame((_, delta) => {
    if (groupRef.current) {
      const targetScale = isHovered ? 1.06 : isSelected ? 1.04 : 1
      const s = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, delta * 10)
      groupRef.current.scale.setScalar(s)
      const targetY = isHovered ? 0.05 : 0
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, delta * 8)
    }
  })

  // Compute label height based on category
  const labelH = (['bed', 'door', 'toy'].includes(decoration.category)) ? 0.6 : 1.0

  return (
    <group position={[gridX, 0, gridZ]}>
      <group
        ref={groupRef}
        rotation={[0, rotationY, 0]}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onPointerOut(); document.body.style.cursor = 'default' }}
      >
        <Furniture3DModel id={decoration.id} category={decoration.category} color={color} />
      </group>
      {/* Emoji label floating above */}
      <Html center position={[0, labelH, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontSize: '22px',
          textShadow: '0 2px 6px rgba(0,0,0,0.25)',
          filter: isHovered ? 'drop-shadow(0 0 6px gold)' : 'none',
          transition: 'filter 0.2s',
        }}>
          {decoration.icon}
        </div>
      </Html>
      {/* Name tooltip on hover */}
      {isHovered && (
        <Html center position={[0, labelH + 0.3, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '12px',
            padding: '4px 12px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#333',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            fontFamily: "'ZCOOL KuaiLe', sans-serif",
          }}>
            {decoration.name}
          </div>
        </Html>
      )}
    </group>
  )
})

/** Pokemon character in 3D */
function PokemonCharacter({ speciesEmoji }: { speciesEmoji: string }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.5 + Math.sin(clock.getElapsedTime() * 2) * 0.1
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.2
    }
  })

  return (
    <group ref={groupRef} position={[GRID_SIZE / 2 - 0.5, 0.5, GRID_SIZE / 2 - 0.5]}>
      {/* Body - sphere */}
      <mesh castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#FFD54F" />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.2, 0.4, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.1, 0.3, 8]} />
        <meshStandardMaterial color="#FFD54F" />
      </mesh>
      <mesh position={[0.2, 0.4, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.1, 0.3, 8]} />
        <meshStandardMaterial color="#FFD54F" />
      </mesh>
      {/* Emoji overlay */}
      <Html center position={[0, 0, 0.45]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: '36px' }}>{speciesEmoji}</div>
      </Html>
    </group>
  )
}

/** Floor grid highlight for edit mode */
function FloorGridHighlight({
  editMode, selectedSlot, onSlotClick,
}: {
  editMode: boolean
  selectedSlot: { x: number; z: number } | null
  onSlotClick: (x: number, z: number) => void
}) {
  const [hoverSlot, setHoverSlot] = useState<{ x: number; z: number } | null>(null)

  if (!editMode) return null

  return (
    <group>
      {Array.from({ length: GRID_SIZE }).flatMap((_, x) =>
        Array.from({ length: GRID_SIZE }).map((_, z) => {
          const isHover = hoverSlot?.x === x && hoverSlot?.z === z
          const isSelected = selectedSlot?.x === x && selectedSlot?.z === z
          return (
            <mesh
              key={`slot-${x}-${z}`}
              position={[x, 0.01, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(e) => { e.stopPropagation(); onSlotClick(x, z) }}
              onPointerOver={(e) => { e.stopPropagation(); setHoverSlot({ x, z }); document.body.style.cursor = 'crosshair' }}
              onPointerOut={() => { setHoverSlot(null); document.body.style.cursor = 'default' }}
            >
              <planeGeometry args={[CELL_SIZE * 0.9, CELL_SIZE * 0.9]} />
              <meshStandardMaterial
                color={isSelected ? '#4CAF50' : isHover ? '#81C784' : '#A5D6A7'}
                transparent
                opacity={isHover ? 0.5 : isSelected ? 0.6 : 0.2}
              />
            </mesh>
          )
        })
      )}
    </group>
  )
}

/** Invalidate frame on demand */
function SceneInvalidator({ deps }: { deps: unknown[] }) {
  const { invalidate } = useThree()
  useEffect(() => { invalidate() }, deps)
  return null
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function HousePage() {
  const [catalog, setCatalog] = useState<Decoration[]>([])
  const [owned, setOwned] = useState<HouseItem[]>([])
  const [candyBalance, setCandyBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  // UI state
  const [mode, setMode] = useState<'view' | 'edit' | 'shop'>('view')
  const [editCategory, setEditCategory] = useState('all')
  const [selectedDecoId, setSelectedDecoId] = useState<string | null>(null)
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  // Floor/wall colors based on placed decorations
  const [floorColor, setFloorColor] = useState(FLOOR_COLORS.default)
  const [wallColor, setWallColor] = useState(WALL_COLORS.default)

  const load = useCallback(() => {
    fetch('/api/decorations').then(r => r.json()).then(data => {
      setCatalog(data.catalog || [])
      setOwned(data.owned || [])
      setCandyBalance(data.candyBalance || 0)
      setLoading(false)

      // Check for placed floor/wallpaper to set colors
      const ownedItems = data.owned || []
      const catalogItems = data.catalog || []
      for (const item of ownedItems as HouseItem[]) {
        if (!item.placed) continue
        const info = (catalogItems as Decoration[]).find(d => d.id === item.decoration_id)
        if (info?.category === 'floor') {
          setFloorColor(FLOOR_COLORS[info.rarity] || FLOOR_COLORS.default)
        }
        if (info?.category === 'wallpaper') {
          setWallColor(WALL_COLORS[info.rarity] || WALL_COLORS.default)
        }
      }
    })
  }, [])

  useEffect(() => { load() }, [load])

  const getDecoInfo = (decorId: string) => catalog.find(d => d.id === decorId)
  const placedItems = owned.filter(i => i.placed)
  const unplacedItems = owned.filter(i => !i.placed)

  // Compute smart placements (zone-based, no overlap)
  const placements = computePlacements(placedItems, getDecoInfo)

  const handleBuy = async (decorationId: string) => {
    setBuying(decorationId)
    setMessage('')
    const res = await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'buy', decorationId }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(data.message || '购买成功！')
      load()
    } else {
      setMessage(data.error || '购买失败')
    }
    setBuying(null)
  }

  const handlePlace = async (houseItemId: number) => {
    await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'place', houseItemId, slot: 'main' }),
    })
    setSelectedItemId(null)
    load()
  }

  const handleRemove = async (houseItemId: number) => {
    await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', houseItemId }),
    })
    setSelectedItemId(null)
    load()
  }

  const handleSlotClick = (x: number, z: number) => {
    if (selectedDecoId) {
      // Find the unplaced item with this decoration ID
      const item = unplacedItems.find(i => i.decoration_id === selectedDecoId)
      if (item) {
        handlePlace(item.id)
        setSelectedDecoId(null)
      }
    }
  }

  const filteredCatalog = editCategory === 'all'
    ? catalog
    : catalog.filter(d => d.category === editCategory)

  const shopCatalog = editCategory === 'all'
    ? catalog
    : catalog.filter(d => d.category === editCategory)

  const RARITY_COLORS: Record<string, string> = {
    common: 'border-gray-200 bg-white',
    uncommon: 'border-green-200 bg-green-50',
    rare: 'border-blue-200 bg-blue-50',
    epic: 'border-purple-200 bg-purple-50',
  }

  const RARITY_LABELS: Record<string, string> = {
    common: '普通', uncommon: '优质', rare: '稀有', epic: '史诗',
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-7xl mb-4 animate-bounce">🏠</div>
          <p className="text-gray-400 text-2xl font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>加载小屋中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col relative">
      {/* Header - compact */}
      <div className="border-b-3 border-teal-200 px-6 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <div className="flex items-center gap-4">
          <h1 className="game-title-green leading-tight" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: '#065f46' }}>宝可梦小屋 🏠</h1>
          <p className="text-emerald-500 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.05rem' }}>
            {mode === 'edit' ? '点击装饰品放置到小屋中' : mode === 'shop' ? '选购喜欢的装饰品' : '你和宝可梦的温馨小窝'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-yellow-100 border-2 border-yellow-300 rounded-2xl px-4 py-2">
            <span className="text-2xl">⭐</span>
            <span className="font-bold text-yellow-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.2rem' }}>
              {candyBalance}
            </span>
          </div>
        </div>
      </div>

      {/* Toast message - floating overlay */}
      <AnimatePresence>
        {message && (
          <motion.div
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-2.5 text-green-700 font-bold shadow-lg"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        {/* 3D Canvas */}
        <div className="flex-1 relative" style={{ minHeight: '400px' }}>
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-sky-100 to-green-50">
              <p className="text-xl text-gray-400 font-bold">加载3D场景...</p>
            </div>
          }>
            <Canvas
              orthographic
              camera={{ position: [10, 10, 10], zoom: 70, near: 0.1, far: 1000 }}
              shadows
              dpr={[1, 2]}
              frameloop="demand"
              style={{ background: 'linear-gradient(180deg, #E3F2FD 0%, #C8E6C9 60%, #A5D6A7 100%)' }}
            >
              <SceneInvalidator deps={[placedItems, hoveredItemId, selectedItemId, mode, floorColor, wallColor]} />

              {/* Lighting */}
              <ambientLight intensity={0.7} />
              <directionalLight
                position={[8, 12, 8]}
                intensity={1}
                castShadow
                shadow-mapSize-width={512}
                shadow-mapSize-height={512}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
              />

              {/* House structure — open top for interior view */}
              <HouseFloor color={floorColor} />
              <HouseWalls color={wallColor} />

              {/* Placed decorations */}
              {placedItems.map((item) => {
                const info = getDecoInfo(item.decoration_id)
                if (!info) return null
                // Skip floor/wallpaper — they are global effects
                if (info.category === 'floor' || info.category === 'wallpaper') return null
                const pos = placements.get(item.id)
                if (!pos) return null
                return (
                  <DecorationItem3D
                    key={item.id}
                    decoration={info}
                    gridX={pos.x}
                    gridZ={pos.z}
                    rotationY={pos.ry}
                    isHovered={hoveredItemId === item.id}
                    isSelected={selectedItemId === item.id}
                    onClick={() => {
                      if (mode === 'edit') setSelectedItemId(selectedItemId === item.id ? null : item.id)
                    }}
                    onPointerOver={() => setHoveredItemId(item.id)}
                    onPointerOut={() => setHoveredItemId(null)}
                  />
                )
              })}

              {/* Pokemon character */}
              <PokemonCharacter speciesEmoji="⚡" />

              {/* Grid highlight in edit mode */}
              <FloorGridHighlight
                editMode={mode === 'edit' && !!selectedDecoId}
                selectedSlot={null}
                onSlotClick={handleSlotClick}
              />

              {/* Controls - limited rotation */}
              <OrbitControls
                enablePan={false}
                minPolarAngle={Math.PI / 6}
                maxPolarAngle={Math.PI / 3}
                minAzimuthAngle={-Math.PI / 6}
                maxAzimuthAngle={Math.PI / 6}
                minZoom={45}
                maxZoom={100}
                makeDefault
              />
            </Canvas>
          </Suspense>

          {/* Selected item action buttons (overlay on canvas) */}
          <AnimatePresence>
            {mode === 'edit' && selectedItemId && (
              <motion.div
                className="absolute top-4 right-4 flex gap-3"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <button
                  onClick={() => handleRemove(selectedItemId)}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-2xl font-bold text-lg shadow-lg transition-colors"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                >
                  🗑️ 移除
                </button>
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-3 rounded-2xl font-bold text-lg shadow-lg transition-colors"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                >
                  取消
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode buttons (overlay on canvas bottom) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            {mode === 'view' ? (
              <>
                <motion.button
                  onClick={() => setMode('edit')}
                  className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-xl border-2 border-emerald-300"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  🎨 装饰模式
                </motion.button>
                <motion.button
                  onClick={() => setMode('shop')}
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-xl border-2 border-yellow-300"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  🛍️ 商店
                </motion.button>
              </>
            ) : (
              <motion.button
                onClick={() => { setMode('view'); setSelectedDecoId(null); setSelectedItemId(null); setMessage('') }}
                className="bg-gradient-to-r from-indigo-400 to-purple-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-xl border-2 border-indigo-300"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              >
                ✓ 完成
              </motion.button>
            )}
          </div>
        </div>

        {/* Bottom panel: Edit toolbar or Shop */}
        <AnimatePresence>
          {mode === 'edit' && (
            <motion.div
              className="bg-white border-t-4 border-emerald-200 flex-shrink-0"
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              {/* Category tabs */}
              <div className="flex gap-2 px-6 pt-4 pb-2 overflow-x-auto">
                {CATEGORY_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setEditCategory(t.key)}
                    className={`px-4 py-2 rounded-xl font-bold border-2 whitespace-nowrap transition-all flex items-center gap-1 ${
                      editCategory === t.key
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                    }`}
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              {/* Inventory items */}
              <div className="px-6 pb-3 flex gap-3 overflow-x-auto" style={{ maxHeight: '120px' }}>
                {unplacedItems
                  .filter(i => {
                    if (editCategory === 'all') return true
                    const info = getDecoInfo(i.decoration_id)
                    return info?.category === editCategory
                  })
                  .map(item => {
                    const info = getDecoInfo(item.decoration_id)
                    if (!info) return null
                    const isActive = selectedDecoId === item.decoration_id
                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => {
                          setSelectedDecoId(isActive ? null : item.decoration_id)
                          handlePlace(item.id)
                        }}
                        className={`flex-shrink-0 w-24 rounded-2xl p-3 text-center border-3 transition-all ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                            : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                        }`}
                        style={{ borderWidth: 3 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <div className="text-3xl mb-1">{info.icon}</div>
                        <p className="text-xs font-bold text-gray-700 truncate" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                          {info.name}
                        </p>
                      </motion.button>
                    )
                  })}
                {unplacedItems.filter(i => editCategory === 'all' || getDecoInfo(i.decoration_id)?.category === editCategory).length === 0 && (
                  <div className="flex items-center justify-center w-full py-4 text-gray-400">
                    <p style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>没有可放置的装饰品，去商店看看吧</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {mode === 'shop' && (
            <motion.div
              className="bg-white border-t-4 border-yellow-200 flex-shrink-0 overflow-y-auto"
              style={{ maxHeight: '40vh' }}
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              {/* Category tabs */}
              <div className="flex gap-2 px-6 pt-4 pb-2 overflow-x-auto sticky top-0 bg-white z-10">
                {CATEGORY_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setEditCategory(t.key)}
                    className={`px-4 py-2 rounded-xl font-bold border-2 whitespace-nowrap transition-all flex items-center gap-1 ${
                      editCategory === t.key
                        ? 'bg-yellow-400 text-white border-yellow-400'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300'
                    }`}
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              {/* Shop grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-4">
                {shopCatalog.map(d => {
                  const alreadyOwned = owned.some(o => o.decoration_id === d.id)
                  const canAfford = candyBalance >= d.price
                  return (
                    <motion.div
                      key={d.id}
                      className={`rounded-2xl p-4 border-2 ${RARITY_COLORS[d.rarity] || 'border-gray-200 bg-white'}`}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="text-4xl text-center mb-2">{d.icon}</div>
                      <p className="font-bold text-gray-800 text-center text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{d.name}</p>
                      <div className="flex justify-center mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          d.rarity === 'epic' ? 'bg-purple-100 text-purple-600' :
                          d.rarity === 'rare' ? 'bg-blue-100 text-blue-600' :
                          d.rarity === 'uncommon' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>{RARITY_LABELS[d.rarity] || '普通'}</span>
                      </div>
                      <div className="mt-2 text-center">
                        {alreadyOwned ? (
                          <span className="text-emerald-500 font-bold text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>✓ 已拥有</span>
                        ) : (
                          <button
                            onClick={() => handleBuy(d.id)}
                            disabled={!canAfford || buying === d.id}
                            className={`px-3 py-1.5 rounded-xl font-bold text-white text-sm transition-all ${
                              canAfford ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-gray-300 cursor-not-allowed'
                            }`}
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                          >
                            {buying === d.id ? '...' : `⭐ ${d.price}`}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

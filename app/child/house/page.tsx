'use client'

import { useState, useEffect, useCallback, useRef, memo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Html, Billboard, useTexture } from '@react-three/drei'
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

interface PokemonInfo {
  species_id: number
  name: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_SIZE = 6
const OUTDOOR_SIZE = 3 // 3 extra columns for outdoor
const CELL_SIZE = 1

const HOME_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`

const CATEGORY_TABS = [
  { key: 'all', label: '全部', icon: '🏠' },
  { key: 'furniture', label: '家具', icon: '🪑' },
  { key: 'floor', label: '地板', icon: '🟫' },
  { key: 'wall', label: '墙饰', icon: '🖼️' },
  { key: 'toy', label: '玩具', icon: '🧸' },
  { key: 'plant', label: '植物', icon: '🌿' },
  { key: 'outdoor', label: '户外', icon: '🌳' },
]

const DECO_COLORS: Record<string, string> = {
  furniture: '#D4A574',
  floor: '#E8D5B7',
  wall: '#F5E6D3',
  toy: '#FF7043',
  plant: '#7CB342',
  outdoor: '#78909C',
}

// ── Placement metadata per decoration ────────────────────────────────────────
interface PlacementMeta {
  zone: 'wall-back' | 'wall-left' | 'corner' | 'center' | 'entrance' | 'edge' | 'anywhere' | 'global' | 'outdoor'
  facing: number
  offsetZ?: number
  offsetX?: number
}

const PLACEMENT_META: Record<string, PlacementMeta> = {
  // ── CAT-01 Furniture (F-xx) ──
  'F-01':  { zone: 'center', facing: 0 },                                    // 木质小圆桌
  'F-02':  { zone: 'center', facing: Math.PI * 0.75 },                       // 毛茸茸懒人沙发
  'F-03':  { zone: 'wall-back', facing: 0, offsetZ: -0.3 },                  // 书架（小）
  'F-04':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.3 },        // 皮卡丘台灯
  'F-05':  { zone: 'center', facing: 0 },                                    // 宝可梦图案地毯
  'F-06':  { zone: 'center', facing: 0 },                                    // 贝壳形摇椅
  'F-07':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.15 },       // 星空吊床
  'F-08':  { zone: 'wall-back', facing: 0, offsetZ: -0.15 },                 // 水晶玻璃展示柜
  'F-09':  { zone: 'center', facing: Math.PI * 0.75 },                       // 豪华双人大沙发
  'F-10':  { zone: 'edge', facing: 0 },                                      // 魔法音乐盒
  'F-11':  { zone: 'wall-back', facing: 0, offsetZ: -0.2 },                  // 宝可梦中心接待台
  'F-12':  { zone: 'corner', facing: Math.PI / 4 },                          // 冠军宝座
  // ── CAT-04 Outdoor (O-xx) ──
  'O-01':  { zone: 'outdoor', facing: 0 },                                   // 向日葵花盆
  'O-02':  { zone: 'outdoor', facing: 0 },                                   // 小木栅栏
  'O-03':  { zone: 'outdoor', facing: 0 },                                   // 石头小径
  'O-04':  { zone: 'outdoor', facing: 0 },                                   // 樱桃树盆栽
  'O-05':  { zone: 'outdoor', facing: 0 },                                   // 蘑菇路灯
  'O-06':  { zone: 'outdoor', facing: 0 },                                   // 精灵球喷水池
  'O-09':  { zone: 'outdoor', facing: 0 },                                   // 宝可梦石像
  'O-10':  { zone: 'outdoor', facing: 0 },                                   // 彩虹桥
  'O-11':  { zone: 'outdoor', facing: 0 },                                   // 光之树
  'O-12':  { zone: 'outdoor', facing: 0 },                                   // 胜利旗杆
  // ── CAT-05 Toy (T-xx) ──
  'T-01':  { zone: 'anywhere', facing: 0 },                                  // 毛线球
  'T-02':  { zone: 'anywhere', facing: 0 },                                  // 精灵球玩具
  'T-03':  { zone: 'edge', facing: 0 },                                      // 旋转风车
  'T-04':  { zone: 'center', facing: 0 },                                    // 积木套装
  'T-05':  { zone: 'center', facing: 0 },                                    // 宝可梦拼图
  'T-06':  { zone: 'center', facing: 0 },                                    // 弹跳蹦床
  'T-07':  { zone: 'edge', facing: 0 },                                      // 魔法水晶球
  'T-08':  { zone: 'center', facing: 0 },                                    // 迷你滑梯
  'T-09':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.2 },        // 宝可梦乐器套装
  'T-10':  { zone: 'edge', facing: 0 },                                      // 时光胶囊
  // ── CAT-06 Functional (FN-xx) ──
  'FN-01': { zone: 'wall-back', facing: 0, offsetZ: -0.35 },                 // 心愿便利贴板
  'FN-03': { zone: 'wall-back', facing: 0, offsetZ: -0.35 },                 // 宝可梦日历
  'FN-06': { zone: 'edge', facing: 0 },                                      // 时间沙漏
  'FN-07': { zone: 'wall-back', facing: 0, offsetZ: -0.15 },                 // 荣誉奖杯柜
  'FN-08': { zone: 'edge', facing: 0 },                                      // 成长树
  // ── CAT-07 Door (D-xx) ──
  'D-01':  { zone: 'entrance', facing: 0 },                                  // 彩色门垫
  'D-02':  { zone: 'wall-back', facing: 0, offsetZ: -0.35 },                 // 精灵球门牌
  'D-03':  { zone: 'entrance', facing: 0 },                                  // 植物门帘
  'D-06':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.35 },       // 星星风铃
  // ── CAT-08 Bed (B-xx) ──
  'B-01':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.15 },       // 草编小窝
  'B-02':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.15 },       // 云朵床
  'B-03':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.15 },       // 星星睡袋
  'B-07':  { zone: 'corner', facing: Math.PI / 4, offsetX: -0.1, offsetZ: -0.1 }, // 皇家四柱床
  'B-08':  { zone: 'wall-left', facing: Math.PI / 2, offsetX: -0.15 },       // 梦境发生器
}

const ZONE_POSITIONS: Record<string, [number, number][]> = {
  'wall-back':  [[1, 0], [2, 0], [3, 0], [4, 0], [0, 0], [1, 1], [2, 1], [3, 1]],
  'wall-left':  [[0, 1], [0, 2], [0, 3], [0, 4], [0, 0], [1, 1], [1, 2], [1, 3]],
  'corner':     [[0, 0], [1, 0], [0, 1], [1, 1]],
  'center':     [[2, 2], [3, 3], [2, 3], [3, 2], [2, 4], [3, 4], [4, 2], [4, 3], [1, 2], [1, 3]],
  'entrance':   [[5, 5], [4, 5], [5, 4], [5, 3], [4, 4], [3, 5]],
  'edge':       [[5, 1], [5, 2], [5, 3], [4, 5], [3, 5], [5, 0], [5, 4], [4, 0], [1, 5], [2, 5]],
  'anywhere':   [[3, 4], [4, 3], [2, 4], [4, 2], [1, 4], [4, 1], [3, 1], [1, 3], [2, 2], [3, 3]],
  // Outdoor zone — right side of the house (columns 6–8)
  'outdoor':    [[6, 1], [7, 2], [6, 3], [7, 4], [8, 1], [8, 3], [6, 5], [7, 0], [8, 5]],
}

function computePlacements(
  placedItems: HouseItem[],
  getDecoInfo: (id: string) => Decoration | undefined,
): Map<number, { x: number; z: number; ry: number }> {
  const result = new Map<number, { x: number; z: number; ry: number }>()
  const occupied = new Set<string>()

  for (const item of placedItems) {
    const info = getDecoInfo(item.decoration_id)
    if (!info) continue
    if (info.category === 'floor' || info.category === 'wall') continue

    const meta = PLACEMENT_META[item.decoration_id] || { zone: 'anywhere', facing: 0 }

    // If slot contains a grid position (e.g. "3,2"), use it directly
    if (item.slot && item.slot.includes(',')) {
      const [sx, sz] = item.slot.split(',').map(Number)
      if (!isNaN(sx) && !isNaN(sz)) {
        occupied.add(`${sx},${sz}`)
        result.set(item.id, { x: sx, z: sz, ry: meta.facing })
        continue
      }
    }

    // Fallback: auto-assign based on zone
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
  default: '#E8D5B7', common: '#D2B48C', uncommon: '#8FBC8F', rare: '#87CEEB', epic: '#DDA0DD',
}
const WALL_COLORS: Record<string, string> = {
  default: '#FFF8F0', common: '#F5E6D3', uncommon: '#E8F5E9', rare: '#E3F2FD', epic: '#F3E5F5',
}

// ── 3D Components ─────────────────────────────────────────────────────────────

const HouseFloor = memo(function HouseFloor({ color }: { color: string }) {
  return (
    <group>
      <mesh receiveShadow position={[GRID_SIZE / 2 - 0.5, -0.05, GRID_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
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

const HouseWalls = memo(function HouseWalls({ color }: { color: string }) {
  const wallHeight = 1.2
  const wallThickness = 0.1
  return (
    <group>
      <mesh position={[GRID_SIZE / 2 - 0.5, wallHeight / 2, -0.5 - wallThickness / 2]} castShadow>
        <boxGeometry args={[GRID_SIZE, wallHeight, wallThickness]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.5 - wallThickness / 2, wallHeight / 2, GRID_SIZE / 2 - 0.5]} castShadow>
        <boxGeometry args={[wallThickness, wallHeight, GRID_SIZE]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
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

/** Outdoor grass area to the right of the house */
const OutdoorArea = memo(function OutdoorArea() {
  return (
    <group>
      {/* Grass plane */}
      <mesh receiveShadow position={[GRID_SIZE + OUTDOOR_SIZE / 2 - 0.5, -0.04, GRID_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[OUTDOOR_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color="#8BC34A" side={THREE.DoubleSide} />
      </mesh>
      {/* Subtle grid lines */}
      {Array.from({ length: OUTDOOR_SIZE + 1 }).map((_, i) => (
        <group key={`outdoor-grid-${i}`}>
          <mesh position={[GRID_SIZE + i - 0.5, 0.006, GRID_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.02, GRID_SIZE]} />
            <meshBasicMaterial color="#00000020" transparent opacity={0.08} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
        <mesh key={`outdoor-gridh-${i}`} position={[GRID_SIZE + OUTDOOR_SIZE / 2 - 0.5, 0.006, i - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[OUTDOOR_SIZE, 0.02]} />
          <meshBasicMaterial color="#00000020" transparent opacity={0.08} />
        </mesh>
      ))}
      {/* Low fence between indoor and outdoor */}
      <mesh position={[GRID_SIZE - 0.55, 0.15, GRID_SIZE / 2 - 0.5]} castShadow>
        <boxGeometry args={[0.06, 0.3, GRID_SIZE]} />
        <meshStandardMaterial color="#8D6E63" />
      </mesh>
      {/* Fence posts */}
      {[0, 2, 4].map(i => (
        <mesh key={`post-${i}`} position={[GRID_SIZE - 0.55, 0.2, i - 0.2]} castShadow>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshStandardMaterial color="#6D4C41" />
        </mesh>
      ))}
      {/* Small path from house to outdoor */}
      <mesh position={[GRID_SIZE - 0.3, -0.03, GRID_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 1.2]} />
        <meshStandardMaterial color="#D7CCC8" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
})

// ── Furniture3DModel — matches actual DB decoration IDs ──
function Furniture3DModel({ id, category, color }: { id: string; category: string; color: string }) {
  const wood = '#A0764A'
  const woodDark = '#7A5530'
  const white = '#F5F5F0'
  const metal = '#9E9E9E'

  // ── F-01 木质小圆桌 ──
  if (id === 'F-01') {
    return (
      <group>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.35, 0.35, 0.04, 16]} /><meshStandardMaterial color={wood} /></mesh>
        <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 0.4, 8]} /><meshStandardMaterial color={woodDark} /></mesh>
        {/* 两把椅子 */}
        {[-0.45, 0.45].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 0.25, 0]} castShadow><boxGeometry args={[0.25, 0.04, 0.25]} /><meshStandardMaterial color={wood} /></mesh>
            {[[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].map(([lx, lz], j) => (
              <mesh key={j} position={[lx, 0.12, lz]} castShadow><cylinderGeometry args={[0.015, 0.015, 0.24, 6]} /><meshStandardMaterial color={woodDark} /></mesh>
            ))}
            <mesh position={[0, 0.42, i === 0 ? 0.1 : -0.1]} castShadow><boxGeometry args={[0.25, 0.3, 0.03]} /><meshStandardMaterial color={wood} /></mesh>
          </group>
        ))}
      </group>
    )
  }
  // ── F-02 毛茸茸懒人沙发 ──
  if (id === 'F-02') {
    return (
      <group>
        <mesh position={[0, 0.2, 0]} castShadow><sphereGeometry args={[0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#F8BBD0" /></mesh>
        <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.36, 0.38, 0.1, 16]} /><meshStandardMaterial color="#F48FB1" /></mesh>
        <mesh position={[0, 0.3, 0]} castShadow><sphereGeometry args={[0.18, 12, 12]} /><meshStandardMaterial color="#FCE4EC" /></mesh>
      </group>
    )
  }
  // ── F-03 书架（小）——三层 ──
  if (id === 'F-03') {
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
  // ── F-04 皮卡丘台灯 ──
  if (id === 'F-04') {
    return (
      <group>
        <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.1, 0.12, 0.03, 16]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.015, 0.015, 0.44, 8]} /><meshStandardMaterial color={metal} /></mesh>
        {/* 皮卡丘头 */}
        <mesh position={[0, 0.5, 0]} castShadow><sphereGeometry args={[0.12, 12, 12]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.4} /></mesh>
        {/* 耳朵 */}
        <mesh position={[-0.08, 0.65, 0]} castShadow rotation={[0, 0, -0.3]}><coneGeometry args={[0.03, 0.12, 6]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        <mesh position={[0.08, 0.65, 0]} castShadow rotation={[0, 0, 0.3]}><coneGeometry args={[0.03, 0.12, 6]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        {/* 眼睛 */}
        <mesh position={[-0.04, 0.52, 0.1]} castShadow><sphereGeometry args={[0.015, 8, 8]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position={[0.04, 0.52, 0.1]} castShadow><sphereGeometry args={[0.015, 8, 8]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position={[-0.07, 0.48, 0.09]} castShadow><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0.07, 0.48, 0.09]} castShadow><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#E53935" /></mesh>
        <pointLight position={[0, 0.5, 0]} intensity={0.6} distance={2.5} color="#FFE0B2" />
      </group>
    )
  }
  // ── F-05 宝可梦图案地毯 ──
  if (id === 'F-05') {
    return (
      <group>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[0.4, 24]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.35, 24]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.06, 16]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.34, 0.36, 24]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>
    )
  }
  // ── F-06 贝壳形摇椅 ──
  if (id === 'F-06') {
    return (
      <group>
        <mesh position={[0, 0.25, -0.05]} castShadow><sphereGeometry args={[0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.25, -0.2]} castShadow><sphereGeometry args={[0.3, 12, 8, 0, Math.PI, Math.PI / 4, Math.PI / 2]} /><meshStandardMaterial color="#F5F5F5" /></mesh>
        {/* 摇椅底弧 */}
        <mesh position={[0, 0.02, 0]} castShadow rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.25, 0.02, 8, 16, Math.PI]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0, 0.2, 0.1]} castShadow><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#E0E0E0" /></mesh>
      </group>
    )
  }
  // ── F-07 星空吊床 ──
  if (id === 'F-07') {
    return (
      <group>
        {/* 支柱 */}
        <mesh position={[-0.4, 0.4, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.8, 8]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0.4, 0.4, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.8, 8]} /><meshStandardMaterial color={woodDark} /></mesh>
        {/* 床面（弧形近似） */}
        <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[0.7, 0.03, 0.35]} /><meshStandardMaterial color="#1A237E" /></mesh>
        <mesh position={[0, 0.33, 0]} castShadow><boxGeometry args={[0.6, 0.02, 0.3]} /><meshStandardMaterial color="#283593" /></mesh>
        {/* 星星装饰 */}
        {[[-0.15, 0.37, 0.05], [0.1, 0.38, -0.08], [0.2, 0.37, 0.1]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow><octahedronGeometry args={[0.025, 0]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.3} /></mesh>
        ))}
        {/* 绳子 */}
        {[-0.35, 0.35].map((x, i) => (
          <mesh key={i} position={[x, 0.6, 0]} castShadow><cylinderGeometry args={[0.008, 0.008, 0.3, 4]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        ))}
      </group>
    )
  }
  // ── F-08 水晶玻璃展示柜 ──
  if (id === 'F-08') {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.6, 1.0, 0.35]} /><meshStandardMaterial color="#E3F2FD" transparent opacity={0.3} /></mesh>
        {/* 木框 */}
        <mesh position={[0, 0.0, 0]} castShadow><boxGeometry args={[0.62, 0.04, 0.37]} /><meshStandardMaterial color={woodDark} /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><boxGeometry args={[0.62, 0.04, 0.37]} /><meshStandardMaterial color={woodDark} /></mesh>
        {/* 隔板 */}
        {[0.33, 0.66].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} castShadow><boxGeometry args={[0.56, 0.02, 0.32]} /><meshStandardMaterial color="#E3F2FD" transparent opacity={0.2} /></mesh>
        ))}
        {/* 展示物 */}
        <mesh position={[-0.1, 0.18, 0]} castShadow><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#FFD54F" metalness={0.6} /></mesh>
        <mesh position={[0.1, 0.5, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 0.08, 6]} /><meshStandardMaterial color="#C0C0C0" metalness={0.6} /></mesh>
      </group>
    )
  }
  // ── F-09 豪华双人大沙发 ──
  if (id === 'F-09') {
    return (
      <group>
        <mesh position={[0, 0.21, 0.05]} castShadow><boxGeometry args={[1.2, 0.42, 0.55]} /><meshStandardMaterial color="#2E7D32" /></mesh>
        <mesh position={[0, 0.48, -0.22]} castShadow><boxGeometry args={[1.2, 0.3, 0.1]} /><meshStandardMaterial color="#1B5E20" /></mesh>
        <mesh position={[-0.58, 0.35, 0.05]} castShadow><boxGeometry args={[0.08, 0.3, 0.55]} /><meshStandardMaterial color="#1B5E20" /></mesh>
        <mesh position={[0.58, 0.35, 0.05]} castShadow><boxGeometry args={[0.08, 0.3, 0.55]} /><meshStandardMaterial color="#1B5E20" /></mesh>
        <mesh position={[-0.25, 0.46, 0.05]} castShadow><boxGeometry args={[0.3, 0.06, 0.2]} /><meshStandardMaterial color="#A5D6A7" /></mesh>
        <mesh position={[0.25, 0.46, 0.05]} castShadow><boxGeometry args={[0.3, 0.06, 0.2]} /><meshStandardMaterial color="#A5D6A7" /></mesh>
      </group>
    )
  }
  // ── F-10 魔法音乐盒 ──
  if (id === 'F-10') {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><boxGeometry args={[0.25, 0.18, 0.2]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.26, 0.02, 0.21]} /><meshStandardMaterial color={woodDark} /></mesh>
        {/* 旋转装饰 */}
        <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.12, 8]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0, 0.38, 0]} castShadow><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#CE93D8" emissive="#CE93D8" emissiveIntensity={0.3} /></mesh>
        {/* 音符装饰 */}
        <mesh position={[0.12, 0.35, 0.05]} castShadow><sphereGeometry args={[0.02, 6, 6]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.4} /></mesh>
        <mesh position={[-0.1, 0.4, -0.03]} castShadow><sphereGeometry args={[0.015, 6, 6]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.4} /></mesh>
      </group>
    )
  }
  // ── F-11 宝可梦中心接待台 ──
  if (id === 'F-11') {
    return (
      <group>
        <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[1.0, 0.8, 0.5]} /><meshStandardMaterial color={white} /></mesh>
        {/* 红色顶部 */}
        <mesh position={[0, 0.81, 0]} castShadow><boxGeometry args={[1.02, 0.04, 0.52]} /><meshStandardMaterial color="#E53935" /></mesh>
        {/* 精灵球标志 */}
        <mesh position={[0, 0.5, 0.26]} castShadow><cylinderGeometry args={[0.1, 0.1, 0.02, 16]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.5, 0.27]} castShadow><cylinderGeometry args={[0.04, 0.04, 0.02, 12]} /><meshStandardMaterial color={white} /></mesh>
        {/* 十字标志 */}
        <mesh position={[0.35, 0.6, 0.26]} castShadow><boxGeometry args={[0.08, 0.12, 0.01]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0.35, 0.6, 0.26]} castShadow><boxGeometry args={[0.12, 0.08, 0.01]} /><meshStandardMaterial color="#E53935" /></mesh>
      </group>
    )
  }
  // ── F-12 冠军宝座 ──
  if (id === 'F-12') {
    return (
      <group>
        {/* 底座 */}
        <mesh position={[0, 0.08, 0]} castShadow><boxGeometry args={[0.6, 0.16, 0.5]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        {/* 座面 */}
        <mesh position={[0, 0.28, 0.05]} castShadow><boxGeometry args={[0.55, 0.08, 0.45]} /><meshStandardMaterial color="#B71C1C" /></mesh>
        {/* 靠背 */}
        <mesh position={[0, 0.6, -0.2]} castShadow><boxGeometry args={[0.55, 0.6, 0.06]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        {/* 扶手 */}
        <mesh position={[-0.28, 0.4, 0.05]} castShadow><boxGeometry args={[0.06, 0.2, 0.45]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        <mesh position={[0.28, 0.4, 0.05]} castShadow><boxGeometry args={[0.06, 0.2, 0.45]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        {/* 冠冕装饰 */}
        <mesh position={[0, 0.95, -0.2]} castShadow><coneGeometry args={[0.08, 0.12, 5]} /><meshStandardMaterial color="#FFD54F" metalness={0.6} /></mesh>
        <mesh position={[0, 0.95, -0.2]} castShadow><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#E53935" /></mesh>
      </group>
    )
  }

  // ── O-01 向日葵花盆 ──
  if (id === 'O-01') {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.12, 0.09, 0.2, 12]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        {/* 茎 */}
        <mesh position={[-0.03, 0.35, 0]} castShadow><cylinderGeometry args={[0.015, 0.015, 0.3, 6]} /><meshStandardMaterial color="#558B2F" /></mesh>
        <mesh position={[0.04, 0.3, 0]} castShadow><cylinderGeometry args={[0.015, 0.015, 0.22, 6]} /><meshStandardMaterial color="#558B2F" /></mesh>
        {/* 向日葵花 */}
        <mesh position={[-0.03, 0.52, 0]} castShadow><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        <mesh position={[-0.03, 0.52, 0]} castShadow><sphereGeometry args={[0.035, 8, 8]} /><meshStandardMaterial color="#5D4037" /></mesh>
        <mesh position={[0.04, 0.43, 0]} castShadow><sphereGeometry args={[0.055, 10, 10]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        <mesh position={[0.04, 0.43, 0]} castShadow><sphereGeometry args={[0.028, 8, 8]} /><meshStandardMaterial color="#5D4037" /></mesh>
      </group>
    )
  }
  // ── O-02 小木栅栏 ──
  if (id === 'O-02') {
    return (
      <group>
        {/* 横梁 */}
        <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[0.8, 0.04, 0.03]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.8, 0.04, 0.03]} /><meshStandardMaterial color={white} /></mesh>
        {/* 竖栏 */}
        {[-0.35, -0.2, -0.05, 0.1, 0.25, 0.35].map((x, i) => (
          <mesh key={i} position={[x, 0.2, 0]} castShadow><boxGeometry args={[0.04, 0.4, 0.03]} /><meshStandardMaterial color={white} /></mesh>
        ))}
        {/* 尖顶 */}
        {[-0.35, -0.05, 0.25].map((x, i) => (
          <mesh key={i} position={[x, 0.42, 0]} castShadow><coneGeometry args={[0.025, 0.05, 4]} /><meshStandardMaterial color={white} /></mesh>
        ))}
      </group>
    )
  }
  // ── O-03 石头小径 ──
  if (id === 'O-03') {
    return (
      <group>
        {[[-0.1, 0], [0.05, 0.12], [-0.08, -0.15], [0.12, -0.05], [0, 0.06]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.02, z]} castShadow rotation={[-Math.PI / 2, 0, i * 0.5]}>
            <circleGeometry args={[0.06 + i * 0.01, 8]} />
            <meshStandardMaterial color={['#9E9E9E', '#BDBDBD', '#757575', '#A0A0A0', '#8D8D8D'][i]} />
          </mesh>
        ))}
      </group>
    )
  }
  // ── O-04 樱桃树盆栽 ──
  if (id === 'O-04') {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.14, 0.11, 0.2, 10]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.04, 0.05, 0.4, 6]} /><meshStandardMaterial color="#5D4037" /></mesh>
        <mesh position={[0, 0.72, 0]} castShadow><sphereGeometry args={[0.25, 12, 12]} /><meshStandardMaterial color="#F8BBD0" /></mesh>
        <mesh position={[-0.15, 0.6, 0]} castShadow><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#F48FB1" /></mesh>
        <mesh position={[0.12, 0.64, 0.1]} castShadow><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#F48FB1" /></mesh>
        {/* 樱桃果 */}
        {[[-0.1, 0.58, 0.15], [0.15, 0.65, -0.1], [0.05, 0.78, 0.08]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow><sphereGeometry args={[0.025, 8, 8]} /><meshStandardMaterial color="#E53935" /></mesh>
        ))}
      </group>
    )
  }
  // ── O-05 蘑菇路灯 ──
  if (id === 'O-05') {
    return (
      <group>
        <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.03, 0.04, 0.6, 8]} /><meshStandardMaterial color="#BCAAA4" /></mesh>
        <mesh position={[0, 0.65, 0]} castShadow><sphereGeometry args={[0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#E53935" /></mesh>
        {/* 白色斑点 */}
        {[[0.08, 0.7, 0.08], [-0.06, 0.72, -0.05], [0.02, 0.73, 0.1]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow><sphereGeometry args={[0.02, 6, 6]} /><meshStandardMaterial color={white} /></mesh>
        ))}
        <pointLight position={[0, 0.55, 0]} intensity={0.4} distance={2} color="#FFE0B2" />
      </group>
    )
  }
  // ── O-06 精灵球喷水池 ──
  if (id === 'O-06') {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.4, 0.35, 0.2, 16]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.35, 0.35, 0.04, 16]} /><meshStandardMaterial color="#64B5F6" transparent opacity={0.7} /></mesh>
        {/* 精灵球中心柱 */}
        <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.06, 0.08, 0.2, 10]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0, 0.42, 0]} castShadow><sphereGeometry args={[0.1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.42, 0]} castShadow><sphereGeometry args={[0.1, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.52, 0]} castShadow><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#90CAF9" transparent opacity={0.5} /></mesh>
      </group>
    )
  }
  // ── O-09 宝可梦石像 ──
  if (id === 'O-09') {
    return (
      <group>
        {/* 底座 */}
        <mesh position={[0, 0.08, 0]} castShadow><boxGeometry args={[0.35, 0.16, 0.35]} /><meshStandardMaterial color="#9E9E9E" /></mesh>
        {/* 身体 */}
        <mesh position={[0, 0.3, 0]} castShadow><sphereGeometry args={[0.15, 10, 10]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        {/* 头 */}
        <mesh position={[0, 0.5, 0]} castShadow><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        {/* 耳朵 */}
        <mesh position={[-0.08, 0.62, 0]} castShadow rotation={[0, 0, -0.3]}><coneGeometry args={[0.04, 0.1, 6]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        <mesh position={[0.08, 0.62, 0]} castShadow rotation={[0, 0, 0.3]}><coneGeometry args={[0.04, 0.1, 6]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
      </group>
    )
  }
  // ── O-10 彩虹桥 ──
  if (id === 'O-10') {
    return (
      <group>
        {['#E53935', '#FF9800', '#FFD54F', '#66BB6A', '#42A5F5', '#5C6BC0', '#AB47BC'].map((c, i) => (
          <mesh key={i} position={[0, 0.02 + i * 0.025, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.35 - i * 0.03, 0.015, 8, 24, Math.PI]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </group>
    )
  }
  // ── O-11 光之树 ──
  if (id === 'O-11') {
    return (
      <group>
        <mesh position={[0, 0.35, 0]} castShadow><cylinderGeometry args={[0.05, 0.07, 0.7, 6]} /><meshStandardMaterial color="#E0E0E0" /></mesh>
        <mesh position={[0, 0.8, 0]} castShadow><sphereGeometry args={[0.3, 12, 12]} /><meshStandardMaterial color="#F5F5F5" emissive="#FFD54F" emissiveIntensity={0.3} /></mesh>
        <mesh position={[-0.2, 0.65, 0]} castShadow><sphereGeometry args={[0.15, 8, 8]} /><meshStandardMaterial color="#FAFAFA" emissive="#FFD54F" emissiveIntensity={0.2} /></mesh>
        <mesh position={[0.18, 0.7, 0.1]} castShadow><sphereGeometry args={[0.15, 8, 8]} /><meshStandardMaterial color="#FAFAFA" emissive="#FFD54F" emissiveIntensity={0.2} /></mesh>
        <pointLight position={[0, 0.8, 0]} intensity={0.8} distance={3} color="#FFF9C4" />
      </group>
    )
  }
  // ── O-12 胜利旗杆 ──
  if (id === 'O-12') {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.02, 0.025, 1.0, 8]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#FFD54F" metalness={0.5} /></mesh>
        {/* 旗帜 */}
        <mesh position={[0.12, 0.88, 0]} castShadow><boxGeometry args={[0.22, 0.15, 0.01]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0.12, 0.88, 0.006]} castShadow><boxGeometry args={[0.06, 0.06, 0.005]} /><meshStandardMaterial color="#FFD54F" /></mesh>
      </group>
    )
  }

  // ── T-01 毛线球 ──
  if (id === 'T-01') {
    return (
      <group>
        <mesh position={[0, 0.08, 0]} castShadow><sphereGeometry args={[0.08, 12, 12]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0.03, 0.12, 0.05]} castShadow><sphereGeometry args={[0.06, 10, 10]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        <mesh position={[-0.05, 0.06, -0.03]} castShadow><sphereGeometry args={[0.07, 10, 10]} /><meshStandardMaterial color="#42A5F5" /></mesh>
        <mesh position={[0.06, 0.05, -0.06]} castShadow><sphereGeometry args={[0.065, 10, 10]} /><meshStandardMaterial color="#66BB6A" /></mesh>
        <mesh position={[-0.03, 0.1, 0.06]} castShadow><sphereGeometry args={[0.055, 10, 10]} /><meshStandardMaterial color="#AB47BC" /></mesh>
      </group>
    )
  }
  // ── T-02 精灵球玩具 ──
  if (id === 'T-02') {
    return (
      <group>
        <mesh position={[0, 0.12, 0]} castShadow><sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.12, 0]} castShadow><sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.12, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.008, 8, 24]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position={[0, 0.12, 0.12]} castShadow><sphereGeometry args={[0.03, 10, 10]} /><meshStandardMaterial color={white} /></mesh>
      </group>
    )
  }
  // ── T-03 旋转风车 ──
  if (id === 'T-03') {
    return (
      <group>
        <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.015, 0.02, 0.5, 6]} /><meshStandardMaterial color={woodDark} /></mesh>
        {/* 风车叶 */}
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} position={[0, 0.48, 0.02]} castShadow rotation={[0, 0, (i / 4) * Math.PI * 2]}>
            <boxGeometry args={[0.04, 0.18, 0.005]} />
            <meshStandardMaterial color={['#E53935', '#FFD54F', '#42A5F5', '#66BB6A'][i]} />
          </mesh>
        ))}
        <mesh position={[0, 0.48, 0.025]} castShadow><sphereGeometry args={[0.015, 8, 8]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>
    )
  }
  // ── T-04 积木套装 ──
  if (id === 'T-04') {
    return (
      <group>
        {/* 底层 */}
        <mesh position={[-0.06, 0.04, -0.03]} castShadow><boxGeometry args={[0.1, 0.08, 0.1]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0.06, 0.04, -0.03]} castShadow><boxGeometry args={[0.1, 0.08, 0.1]} /><meshStandardMaterial color="#42A5F5" /></mesh>
        <mesh position={[0, 0.04, 0.08]} castShadow><boxGeometry args={[0.1, 0.08, 0.1]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        {/* 中层 */}
        <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.1, 0.08, 0.1]} /><meshStandardMaterial color="#66BB6A" /></mesh>
        <mesh position={[0.08, 0.12, 0.05]} castShadow><boxGeometry args={[0.08, 0.08, 0.08]} /><meshStandardMaterial color="#AB47BC" /></mesh>
        {/* 顶层 */}
        <mesh position={[0.02, 0.2, 0.02]} castShadow><boxGeometry args={[0.08, 0.08, 0.08]} /><meshStandardMaterial color="#FF9800" /></mesh>
      </group>
    )
  }
  // ── T-05 宝可梦拼图 ──
  if (id === 'T-05') {
    return (
      <group>
        <mesh position={[0, 0.01, 0]} receiveShadow><boxGeometry args={[0.4, 0.02, 0.3]} /><meshStandardMaterial color="#FFF9C4" /></mesh>
        {[[-0.1, -0.07], [0.1, -0.07], [-0.1, 0.07], [0.1, 0.07]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.025, z]} castShadow>
            <boxGeometry args={[0.16, 0.01, 0.12]} />
            <meshStandardMaterial color={['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC'][i]} />
          </mesh>
        ))}
      </group>
    )
  }
  // ── T-06 弹跳蹦床 ──
  if (id === 'T-06') {
    return (
      <group>
        <mesh position={[0, 0.15, 0]} castShadow><cylinderGeometry args={[0.3, 0.32, 0.06, 16]} /><meshStandardMaterial color="#42A5F5" /></mesh>
        <mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.32, 0.32, 0.24, 16]} /><meshStandardMaterial color={metal} /></mesh>
        {/* 弹簧装饰 */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const a = (i / 6) * Math.PI * 2
          return <mesh key={i} position={[Math.cos(a) * 0.28, 0.06, Math.sin(a) * 0.28]} castShadow><cylinderGeometry args={[0.015, 0.015, 0.12, 6]} /><meshStandardMaterial color="#BDBDBD" /></mesh>
        })}
      </group>
    )
  }
  // ── T-07 魔法水晶球 ──
  if (id === 'T-07') {
    return (
      <group>
        <mesh position={[0, 0.04, 0]} castShadow><cylinderGeometry args={[0.1, 0.12, 0.06, 12]} /><meshStandardMaterial color="#5D4037" /></mesh>
        <mesh position={[0, 0.2, 0]} castShadow><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color="#E3F2FD" transparent opacity={0.4} /></mesh>
        {/* 内部雪花 */}
        {[[-0.03, 0.22, 0.02], [0.04, 0.18, -0.03], [0, 0.25, 0.01]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow><octahedronGeometry args={[0.015, 0]} /><meshStandardMaterial color={white} emissive={white} emissiveIntensity={0.3} /></mesh>
        ))}
        <pointLight position={[0, 0.2, 0]} intensity={0.3} distance={1.5} color="#E3F2FD" />
      </group>
    )
  }
  // ── T-08 迷你滑梯 ──
  if (id === 'T-08') {
    return (
      <group>
        {/* 阶梯 */}
        <mesh position={[-0.15, 0.2, -0.1]} castShadow><boxGeometry args={[0.2, 0.4, 0.04]} /><meshStandardMaterial color="#42A5F5" /></mesh>
        {[0.08, 0.18, 0.28, 0.38].map((y, i) => (
          <mesh key={i} position={[-0.15, y, -0.1]} castShadow><boxGeometry args={[0.2, 0.02, 0.1]} /><meshStandardMaterial color="#1E88E5" /></mesh>
        ))}
        {/* 滑道 */}
        <mesh position={[0.1, 0.2, 0.05]} castShadow rotation={[0.5, 0, 0]}><boxGeometry args={[0.25, 0.02, 0.5]} /><meshStandardMaterial color="#FFD54F" /></mesh>
        {/* 平台 */}
        <mesh position={[-0.02, 0.39, -0.1]} castShadow><boxGeometry args={[0.3, 0.03, 0.15]} /><meshStandardMaterial color="#42A5F5" /></mesh>
      </group>
    )
  }
  // ── T-09 宝可梦乐器套装 ──
  if (id === 'T-09') {
    return (
      <group>
        {/* 小鼓 */}
        <mesh position={[-0.15, 0.08, 0]} castShadow><cylinderGeometry args={[0.08, 0.08, 0.1, 12]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[-0.15, 0.14, 0]} castShadow><cylinderGeometry args={[0.08, 0.08, 0.01, 12]} /><meshStandardMaterial color="#FFF9C4" /></mesh>
        {/* 小吉他 */}
        <mesh position={[0.05, 0.15, 0]} castShadow rotation={[0, 0, 0.2]}><capsuleGeometry args={[0.05, 0.08, 8, 8]} /><meshStandardMaterial color={wood} /></mesh>
        <mesh position={[0.08, 0.3, 0]} castShadow rotation={[0, 0, 0.2]}><boxGeometry args={[0.03, 0.15, 0.02]} /><meshStandardMaterial color={woodDark} /></mesh>
        {/* 木琴 */}
        <mesh position={[0, 0.02, 0.15]} castShadow><boxGeometry args={[0.25, 0.02, 0.1]} /><meshStandardMaterial color={wood} /></mesh>
        {[-0.08, -0.03, 0.02, 0.07].map((x, i) => (
          <mesh key={i} position={[x, 0.04, 0.15]} castShadow><boxGeometry args={[0.04, 0.01, 0.08 - i * 0.01]} /><meshStandardMaterial color={['#E53935', '#FF9800', '#FFD54F', '#66BB6A'][i]} /></mesh>
        ))}
      </group>
    )
  }
  // ── T-10 时光胶囊 ──
  if (id === 'T-10') {
    return (
      <group>
        <mesh position={[0, 0.15, 0]} castShadow><capsuleGeometry args={[0.1, 0.15, 12, 16]} /><meshStandardMaterial color="#CE93D8" transparent opacity={0.6} /></mesh>
        <mesh position={[0, 0.15, 0]} castShadow><capsuleGeometry args={[0.06, 0.08, 8, 12]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.5} /></mesh>
        <pointLight position={[0, 0.15, 0]} intensity={0.4} distance={1.5} color="#CE93D8" />
      </group>
    )
  }

  // ── FN-01 心愿便利贴板 ──
  if (id === 'FN-01') {
    return (
      <group>
        <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[0.5, 0.5, 0.03]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        {[[-0.12, 0.5, '#FFD54F'], [0.1, 0.45, '#F48FB1'], [-0.05, 0.3, '#81D4FA'], [0.15, 0.35, '#A5D6A7']].map(([x, y, c], i) => (
          <mesh key={i} position={[Number(x), Number(y), 0.02]} castShadow><boxGeometry args={[0.1, 0.1, 0.005]} /><meshStandardMaterial color={String(c)} /></mesh>
        ))}
      </group>
    )
  }
  // ── FN-03 宝可梦日历 ──
  if (id === 'FN-03') {
    return (
      <group>
        <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[0.25, 0.3, 0.04]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[0.25, 0.05, 0.045]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.15, 0.021]} castShadow><boxGeometry args={[0.2, 0.18, 0.005]} /><meshStandardMaterial color="#FAFAFA" /></mesh>
        {/* 日期格子 */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[-0.06 + (i % 3) * 0.06, 0.1 + Math.floor(i / 3) * 0.06, 0.024]} castShadow>
            <boxGeometry args={[0.04, 0.04, 0.002]} />
            <meshStandardMaterial color="#E0E0E0" />
          </mesh>
        ))}
      </group>
    )
  }
  // ── FN-06 时间沙漏 ──
  if (id === 'FN-06') {
    return (
      <group>
        {/* 上下框 */}
        <mesh position={[0, 0.0, 0]} castShadow><boxGeometry args={[0.15, 0.03, 0.1]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.15, 0.03, 0.1]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        {/* 支柱 */}
        {[-0.06, 0.06].map((x, i) => (
          <mesh key={i} position={[x, 0.225, 0]} castShadow><cylinderGeometry args={[0.01, 0.01, 0.42, 6]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        ))}
        {/* 上玻璃 */}
        <mesh position={[0, 0.32, 0]} castShadow><coneGeometry args={[0.06, 0.18, 12]} /><meshStandardMaterial color="#FFF9C4" transparent opacity={0.4} /></mesh>
        {/* 下玻璃 */}
        <mesh position={[0, 0.14, 0]} castShadow rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.06, 0.18, 12]} /><meshStandardMaterial color="#FFF9C4" transparent opacity={0.4} /></mesh>
        {/* 沙子 */}
        <mesh position={[0, 0.08, 0]} castShadow rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.04, 0.08, 10]} /><meshStandardMaterial color="#FFD54F" /></mesh>
      </group>
    )
  }
  // ── FN-07 荣誉奖杯柜 ──
  if (id === 'FN-07') {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.6, 1.0, 0.3]} /><meshStandardMaterial color={wood} /></mesh>
        <mesh position={[0, 0.5, 0.16]} castShadow><boxGeometry args={[0.56, 0.96, 0.01]} /><meshStandardMaterial color="#E3F2FD" transparent opacity={0.3} /></mesh>
        {/* 奖杯 */}
        <mesh position={[-0.12, 0.7, 0]} castShadow><cylinderGeometry args={[0.04, 0.02, 0.08, 8]} /><meshStandardMaterial color="#FFD54F" metalness={0.6} /></mesh>
        <mesh position={[0.12, 0.7, 0]} castShadow><cylinderGeometry args={[0.03, 0.02, 0.06, 8]} /><meshStandardMaterial color="#C0C0C0" metalness={0.6} /></mesh>
        <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.035, 0.02, 0.07, 8]} /><meshStandardMaterial color="#CD7F32" metalness={0.6} /></mesh>
        {/* 隔板 */}
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.56, 0.02, 0.28]} /><meshStandardMaterial color={woodDark} /></mesh>
      </group>
    )
  }
  // ── FN-08 成长树 ──
  if (id === 'FN-08') {
    return (
      <group>
        <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.15, 0.12, 0.16, 10]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.04, 0.05, 0.5, 6]} /><meshStandardMaterial color="#5D4037" /></mesh>
        <mesh position={[0, 0.75, 0]} castShadow><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#43A047" /></mesh>
        <mesh position={[-0.15, 0.65, 0]} castShadow><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial color="#66BB6A" /></mesh>
        <mesh position={[0.12, 0.68, 0.1]} castShadow><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial color="#66BB6A" /></mesh>
        {/* 果实/星星 */}
        {[[-0.08, 0.82, 0.1], [0.12, 0.78, -0.05], [0.02, 0.88, 0]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow><octahedronGeometry args={[0.025, 0]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.3} /></mesh>
        ))}
      </group>
    )
  }

  // ── D-01 彩色门垫 ──
  if (id === 'D-01') {
    return (
      <group>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><boxGeometry args={[0.5, 0.35, 0.02]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        {['#E53935', '#FF9800', '#FFD54F', '#66BB6A', '#42A5F5', '#AB47BC'].map((c, i) => (
          <mesh key={i} position={[-0.2 + i * 0.08, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><boxGeometry args={[0.06, 0.3, 0.005]} /><meshStandardMaterial color={c} /></mesh>
        ))}
      </group>
    )
  }
  // ── D-02 精灵球门牌 ──
  if (id === 'D-02') {
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow><cylinderGeometry args={[0.12, 0.12, 0.03, 20]} /><meshStandardMaterial color="#E53935" /></mesh>
        <mesh position={[0, 0.6, 0.016]} castShadow><cylinderGeometry args={[0.11, 0.11, 0.01, 20, 1, false, 0, Math.PI]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[0, 0.6, 0.02]} castShadow><sphereGeometry args={[0.025, 10, 10]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>
    )
  }
  // ── D-03 植物门帘 ──
  if (id === 'D-03') {
    return (
      <group>
        <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[0.5, 0.04, 0.03]} /><meshStandardMaterial color={woodDark} /></mesh>
        {[-0.18, -0.06, 0.06, 0.18].map((x, i) => (
          <group key={i}>
            <mesh position={[x, 0.5, 0]} castShadow><cylinderGeometry args={[0.008, 0.008, 0.8, 4]} /><meshStandardMaterial color="#558B2F" /></mesh>
            {[0.3, 0.5, 0.7].map((y, j) => (
              <mesh key={j} position={[x + (j % 2 === 0 ? 0.03 : -0.03), y, 0.01]} castShadow>
                <boxGeometry args={[0.05, 0.025, 0.005]} />
                <meshStandardMaterial color="#66BB6A" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    )
  }
  // ── D-06 星星风铃 ──
  if (id === 'D-06') {
    return (
      <group>
        <mesh position={[0, 0.85, 0]} castShadow><cylinderGeometry args={[0.06, 0.06, 0.02, 12]} /><meshStandardMaterial color="#FFD54F" metalness={0.4} /></mesh>
        {[-0.04, 0, 0.04].map((x, i) => (
          <group key={i}>
            <mesh position={[x, 0.6 - i * 0.08, 0]} castShadow><cylinderGeometry args={[0.002, 0.002, 0.3 + i * 0.08, 4]} /><meshStandardMaterial color="#FFD54F" /></mesh>
            <mesh position={[x, 0.45 - i * 0.1, 0]} castShadow><octahedronGeometry args={[0.025, 0]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.3} /></mesh>
          </group>
        ))}
      </group>
    )
  }

  // ── B-01 草编小窝 ──
  if (id === 'B-01') {
    return (
      <group>
        <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.25, 0.2, 0.16, 12]} /><meshStandardMaterial color="#A1887F" /></mesh>
        <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.22, 0.18, 0.12, 12]} /><meshStandardMaterial color="#D7CCC8" /></mesh>
        <mesh position={[0, 0.16, -0.15]} castShadow><sphereGeometry args={[0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#A1887F" /></mesh>
      </group>
    )
  }
  // ── B-02 云朵床 ──
  if (id === 'B-02') {
    return (
      <group>
        <mesh position={[0, 0.12, 0]} castShadow><sphereGeometry args={[0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={white} /></mesh>
        <mesh position={[-0.15, 0.1, 0]} castShadow><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#FAFAFA" /></mesh>
        <mesh position={[0.15, 0.1, 0]} castShadow><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#FAFAFA" /></mesh>
        <mesh position={[0, 0.1, -0.12]} castShadow><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#F5F5F5" /></mesh>
        <mesh position={[0, 0.1, 0.12]} castShadow><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#F5F5F5" /></mesh>
      </group>
    )
  }
  // ── B-03 星星睡袋 ──
  if (id === 'B-03') {
    return (
      <group>
        <mesh position={[0, 0.06, 0]} castShadow><boxGeometry args={[0.35, 0.08, 0.6]} /><meshStandardMaterial color="#1A237E" /></mesh>
        <mesh position={[0, 0.1, 0]} castShadow><boxGeometry args={[0.32, 0.04, 0.55]} /><meshStandardMaterial color="#283593" /></mesh>
        {/* 星星图案 */}
        {[[-0.08, 0.11, 0.1], [0.06, 0.11, -0.1], [0.1, 0.11, 0.15]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow><octahedronGeometry args={[0.018, 0]} /><meshStandardMaterial color="#FFD54F" emissive="#FFD54F" emissiveIntensity={0.3} /></mesh>
        ))}
        {/* 头部开口 */}
        <mesh position={[0, 0.1, -0.28]} castShadow><cylinderGeometry args={[0.12, 0.15, 0.04, 10]} /><meshStandardMaterial color="#303F9F" /></mesh>
      </group>
    )
  }
  // ── B-07 皇家四柱床 ──
  if (id === 'B-07') {
    return (
      <group>
        <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.6, 0.12, 0.8]} /><meshStandardMaterial color="#8D6E63" /></mesh>
        <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.55, 0.06, 0.75]} /><meshStandardMaterial color="#CE93D8" /></mesh>
        <mesh position={[0, 0.26, -0.3]} castShadow><boxGeometry args={[0.4, 0.06, 0.1]} /><meshStandardMaterial color={white} /></mesh>
        {/* 四柱 */}
        {[[-0.28, -0.38], [0.28, -0.38], [-0.28, 0.38], [0.28, 0.38]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.55, z]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.9, 8]} /><meshStandardMaterial color="#5D4037" /></mesh>
        ))}
        {/* 顶篷 */}
        <mesh position={[0, 0.95, 0]} castShadow><boxGeometry args={[0.62, 0.02, 0.82]} /><meshStandardMaterial color="#5D4037" /></mesh>
        {/* 帷幔 */}
        <mesh position={[0, 0.7, -0.39]} castShadow><boxGeometry args={[0.58, 0.5, 0.01]} /><meshStandardMaterial color="#E1BEE7" transparent opacity={0.6} /></mesh>
      </group>
    )
  }
  // ── B-08 梦境发生器 ──
  if (id === 'B-08') {
    return (
      <group>
        {/* 底座 */}
        <mesh position={[0, 0.06, 0]} castShadow><boxGeometry args={[0.6, 0.1, 0.8]} /><meshStandardMaterial color="#37474F" /></mesh>
        {/* 舱体 */}
        <mesh position={[0, 0.25, 0]} castShadow><capsuleGeometry args={[0.2, 0.5, 12, 16]} /><meshStandardMaterial color="#455A64" /></mesh>
        {/* 透明盖 */}
        <mesh position={[0, 0.3, 0.15]} castShadow><sphereGeometry args={[0.18, 12, 8, 0, Math.PI, 0, Math.PI / 2]} /><meshStandardMaterial color="#80DEEA" transparent opacity={0.3} /></mesh>
        {/* 灯光条 */}
        {[-0.15, 0, 0.15].map((z, i) => (
          <mesh key={i} position={[0.21, 0.25, z]} castShadow><boxGeometry args={[0.01, 0.04, 0.08]} /><meshStandardMaterial color="#64FFDA" emissive="#64FFDA" emissiveIntensity={0.5} /></mesh>
        ))}
        <pointLight position={[0, 0.3, 0]} intensity={0.3} distance={1.5} color="#80DEEA" />
      </group>
    )
  }

  // ── Fallback: generic colored box ──
  return (
    <RoundedBox args={[0.5, 0.5, 0.5]} radius={0.06} smoothness={4} position={[0, 0.25, 0]} castShadow>
      <meshStandardMaterial color={color} />
    </RoundedBox>
  )
}

/** Single decoration item in 3D */
const DecorationItem3D = memo(function DecorationItem3D({
  decoration, gridX, gridZ, rotationY, isSelected, onClick,
}: {
  decoration: Decoration
  gridX: number; gridZ: number; rotationY: number
  isSelected: boolean
  onClick: () => void
}) {
  const color = DECO_COLORS[decoration.category] || '#AAAAAA'

  const labelH = (['toy', 'plant'].includes(decoration.category)) ? 0.6 : 1.0

  return (
    <group position={[gridX, 0, gridZ]}>
      <group
        rotation={[0, rotationY, 0]}
        onClick={(e) => { e.stopPropagation(); onClick() }}
      >
        <Furniture3DModel id={decoration.id} category={decoration.category} color={color} />
      </group>
      {isSelected && (
        <Html center position={[0, labelH, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(76,175,80,0.95)',
            borderRadius: '12px',
            padding: '4px 12px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#fff',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            fontFamily: "'ZCOOL KuaiLe', sans-serif",
          }}>
            {decoration.name} (选中)
          </div>
        </Html>
      )}
    </group>
  )
})

/** Pokemon character with real sprite texture */
function PokemonSpriteCharacter({ speciesId, name, gridX, gridZ, isSelected, onClick }: {
  speciesId: number; name: string; gridX: number; gridZ: number; isSelected?: boolean; onClick?: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const [hasError, setHasError] = useState(false)

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.6 + Math.sin(clock.getElapsedTime() * 2) * 0.1
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.2
    }
  })

  if (hasError) {
    return <PokemonCharacterFallback name={name} groupRef={groupRef} />
  }

  return (
    <group ref={groupRef} position={[gridX, 0.6, gridZ]}
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick() } }}
    >
      <Suspense fallback={<PokemonLoadingPlaceholder />}>
        <PokemonSpritePlane speciesId={speciesId} onError={() => setHasError(true)} />
      </Suspense>
      <Html center position={[0, 0.7, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: "'ZCOOL KuaiLe', sans-serif",
          fontSize: '14px',
          fontWeight: 'bold',
          color: isSelected ? '#fff' : '#6366f1',
          textShadow: '0 1px 3px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
          background: isSelected ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.85)',
          borderRadius: '10px',
          padding: '2px 10px',
        }}>
          {name}{isSelected ? ' 📍' : ''}
        </div>
      </Html>
    </group>
  )
}

function PokemonSpritePlane({ speciesId, onError }: { speciesId: number; onError: () => void }) {
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (loadFailed) onError()
  }, [loadFailed, onError])

  if (loadFailed) return null

  try {
    const texture = useTexture(HOME_SPRITE(speciesId))
    texture.colorSpace = THREE.SRGBColorSpace
    return (
      <Billboard>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={texture} transparent alphaTest={0.1} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    )
  } catch (e) {
    // useTexture throws a promise for Suspense — only treat non-promise as error
    if (e instanceof Promise) throw e
    setTimeout(() => setLoadFailed(true), 0)
    return null
  }
}

/** Subtle loading placeholder — small translucent circle instead of a big sphere */
function PokemonLoadingPlaceholder() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 2
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.3 + Math.sin(clock.getElapsedTime() * 3) * 0.15
    }
  })
  return (
    <mesh ref={ref as any}>
      <ringGeometry args={[0.15, 0.25, 24]} />
      <meshBasicMaterial color="#6366f1" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  )
}

function PokemonCharacterFallback({ name, groupRef }: { name: string; groupRef: React.RefObject<THREE.Group | null> }) {
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.6 + Math.sin(clock.getElapsedTime() * 2) * 0.1
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.2
    }
  })
  return (
    <group ref={groupRef} position={[GRID_SIZE / 2 - 0.5, 0.6, GRID_SIZE / 2 - 0.5]}>
      <Html center position={[0, 0.2, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: "'ZCOOL KuaiLe', sans-serif",
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#6366f1',
          background: 'rgba(255,255,255,0.85)',
          borderRadius: '10px',
          padding: '2px 10px',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
      </Html>
    </group>
  )
}

/** Floor grid highlight for edit mode */
function FloorGridHighlight({
  editMode, occupiedCells, onSlotClick,
}: {
  editMode: boolean
  occupiedCells: Set<string>
  onSlotClick: (x: number, z: number) => void
}) {
  const [hoverSlot, setHoverSlot] = useState<{ x: number; z: number } | null>(null)

  if (!editMode) return null

  // Indoor cells (0..5, 0..5) + outdoor cells (6..8, 0..5)
  const totalCols = GRID_SIZE + OUTDOOR_SIZE
  const totalRows = GRID_SIZE

  return (
    <group>
      {Array.from({ length: totalCols }).flatMap((_, x) =>
        Array.from({ length: totalRows }).map((_, z) => {
          const isHover = hoverSlot?.x === x && hoverSlot?.z === z
          const isOccupied = occupiedCells.has(`${x},${z}`)
          const isOutdoor = x >= GRID_SIZE
          return (
            <mesh
              key={`slot-${x}-${z}`}
              position={[x, 0.01, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(e) => { e.stopPropagation(); if (!isOccupied) onSlotClick(x, z) }}
              onPointerOver={(e) => { e.stopPropagation(); setHoverSlot({ x, z }); document.body.style.cursor = isOccupied ? 'not-allowed' : 'crosshair' }}
              onPointerOut={() => { setHoverSlot(null); document.body.style.cursor = 'default' }}
            >
              <planeGeometry args={[CELL_SIZE * 0.9, CELL_SIZE * 0.9]} />
              <meshStandardMaterial
                color={isOccupied ? '#EF5350' : isHover ? '#66BB6A' : isOutdoor ? '#81C784' : '#A5D6A7'}
                transparent
                opacity={isHover ? 0.5 : isOccupied ? 0.15 : 0.25}
              />
            </mesh>
          )
        })
      )}
    </group>
  )
}

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
  const [pokemonInfo, setPokemonInfo] = useState<PokemonInfo | null>(null)

  // UI state
  const [mode, setMode] = useState<'view' | 'edit' | 'shop'>('view')
  const [editCategory, setEditCategory] = useState('all')
  const [selectedUnplacedId, setSelectedUnplacedId] = useState<number | null>(null) // item id to place
  const [selectedPlacedId, setSelectedPlacedId] = useState<number | null>(null) // placed item to remove
  const [movingPokemon, setMovingPokemon] = useState(false) // whether we're moving the pokemon
  const [pokemonPos, setPokemonPos] = useState<{ x: number; z: number }>({ x: GRID_SIZE / 2 - 0.5, z: GRID_SIZE / 2 - 0.5 })
  const [buying, setBuying] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [message, setMessage] = useState('')
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load pokemon position from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pokemon_house_pos')
      if (saved) {
        const p = JSON.parse(saved)
        if (typeof p.x === 'number' && typeof p.z === 'number') setPokemonPos(p)
      }
    } catch {}
  }, [])

  const [floorColor, setFloorColor] = useState(FLOOR_COLORS.default)
  const [wallColor, setWallColor] = useState(WALL_COLORS.default)

  const showMessage = useCallback((msg: string) => {
    setMessage(msg)
    if (messageTimer.current) clearTimeout(messageTimer.current)
    messageTimer.current = setTimeout(() => setMessage(''), 3000)
  }, [])

  const load = useCallback(() => {
    fetch('/api/decorations').then(r => r.json()).then(data => {
      setCatalog(data.catalog || [])
      setOwned(data.owned || [])
      setCandyBalance(data.candyBalance || 0)
      setLoading(false)

      const ownedItems = data.owned || []
      const catalogItems = data.catalog || []
      for (const item of ownedItems as HouseItem[]) {
        if (!item.placed) continue
        const info = (catalogItems as Decoration[]).find(d => d.id === item.decoration_id)
        if (info?.category === 'floor') setFloorColor(FLOOR_COLORS[info.rarity] || FLOOR_COLORS.default)
        if (info?.category === 'wall') setWallColor(WALL_COLORS[info.rarity] || WALL_COLORS.default)
      }
    })
  }, [])

  // Load Pokemon data
  useEffect(() => {
    fetch('/api/pokemon').then(r => r.json()).then(data => {
      if (data.pokemon) {
        setPokemonInfo({ species_id: data.pokemon.species_id, name: data.pokemon.name })
      }
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const getDecoInfo = (decorId: string) => catalog.find(d => d.id === decorId)
  const placedItems = owned.filter(i => i.placed)
  const unplacedItems = owned.filter(i => !i.placed)
  const placements = computePlacements(placedItems, getDecoInfo)

  // Build occupied cells set for grid highlight
  const occupiedCells = new Set<string>()
  placements.forEach(pos => {
    occupiedCells.add(`${Math.round(pos.x)},${Math.round(pos.z)}`)
  })

  const handleBuy = async (decorationId: string) => {
    setBuying(decorationId)
    const res = await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'buy', decorationId }),
    })
    const data = await res.json()
    if (res.ok) {
      showMessage(data.message || '购买成功！')
      load()
      // Switch to edit mode after buying
      setTimeout(() => setMode('edit'), 500)
    } else {
      showMessage(data.error || '购买失败')
    }
    setBuying(null)
  }

  const handlePlace = async (houseItemId: number, gridX: number, gridZ: number) => {
    setPlacing(true)
    const slot = `${gridX},${gridZ}`
    const res = await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'place', houseItemId, slot }),
    })
    if (res.ok) {
      const info = getDecoInfo(unplacedItems.find(i => i.id === houseItemId)?.decoration_id || '')
      showMessage(`${info?.icon || '🪑'} ${info?.name || '装饰品'}已放置！`)
    }
    setSelectedUnplacedId(null)
    setPlacing(false)
    load()
  }

  const handleRemove = async (houseItemId: number) => {
    const res = await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', houseItemId }),
    })
    if (res.ok) {
      const info = getDecoInfo(placedItems.find(i => i.id === houseItemId)?.decoration_id || '')
      showMessage(`${info?.icon || '🪑'} ${info?.name || '装饰品'}已收回背包`)
    }
    setSelectedPlacedId(null)
    load()
  }

  // Move a placed item to a new grid position
  const handleMoveItem = async (houseItemId: number, gridX: number, gridZ: number) => {
    const slot = `${gridX},${gridZ}`
    const res = await fetch('/api/decorations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'place', houseItemId, slot }),
    })
    if (res.ok) {
      const info = getDecoInfo(placedItems.find(i => i.id === houseItemId)?.decoration_id || '')
      showMessage(`${info?.icon || '🪑'} ${info?.name || '装饰品'}已移动！`)
    }
    setSelectedPlacedId(null)
    load()
  }

  const handleSlotClick = (x: number, z: number) => {
    if (movingPokemon) {
      setPokemonPos({ x, z })
      try { localStorage.setItem('pokemon_house_pos', JSON.stringify({ x, z })) } catch {}
      setMovingPokemon(false)
      showMessage('🎉 宝可梦已移动！')
    } else if (selectedUnplacedId) {
      handlePlace(selectedUnplacedId, x, z)
    } else if (selectedPlacedId) {
      handleMoveItem(selectedPlacedId, x, z)
    }
  }

  const filteredUnplaced = unplacedItems.filter(i => {
    if (editCategory === 'all') return true
    const info = getDecoInfo(i.decoration_id)
    return info?.category === editCategory
  })

  const shopCatalog = editCategory === 'all' ? catalog : catalog.filter(d => d.category === editCategory)

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

  const collectionCount = owned.length
  const totalCount = catalog.length

  return (
    <div className="h-full bg-gray-50 flex flex-col relative">
      {/* Header */}
      <div className="border-b-3 border-teal-200 px-4 md:px-6 py-2 flex items-center justify-between flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="game-title-green leading-tight flex-shrink-0" style={{ fontSize: 'clamp(1.2rem, 3vw, 1.8rem)', color: '#065f46' }}>宝可梦小屋 🏠</h1>
          <div className="hidden md:flex items-center gap-2 text-emerald-600 font-bold" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}>
            <span>|</span>
            <span>{mode === 'edit' ? '🎨 选中物品后点击地板放置' : mode === 'shop' ? '🛍️ 选购装饰品' : '✨ 温馨小窝'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Collection progress */}
          <div className="hidden md:flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
            <span className="text-lg">📦</span>
            <span className="font-bold text-emerald-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}>
              {collectionCount}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-yellow-50 border-2 border-yellow-300 rounded-xl px-3 py-1.5">
            <span className="text-xl">⭐</span>
            <span className="font-bold text-yellow-700" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1.1rem' }}>
              {candyBalance}
            </span>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-2.5 text-green-700 font-bold shadow-lg"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        {/* 3D Canvas */}
        <div className="flex-1 relative" style={{ minHeight: '280px' }}>
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-sky-100 to-green-50">
              <p className="text-xl text-gray-400 font-bold">加载3D场景...</p>
            </div>
          }>
            <Canvas
              orthographic
              camera={{ position: [12, 10, 12], zoom: 55, near: 0.1, far: 1000 }}
              shadows
              dpr={[1, 2]}
              frameloop="demand"
              style={{ background: 'linear-gradient(180deg, #E3F2FD 0%, #C8E6C9 60%, #A5D6A7 100%)' }}
            >
              <SceneInvalidator deps={[placedItems, selectedPlacedId, selectedUnplacedId, mode, floorColor, wallColor]} />

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

              <HouseFloor color={floorColor} />
              <HouseWalls color={wallColor} />
              <OutdoorArea />

              {placedItems.map((item) => {
                const info = getDecoInfo(item.decoration_id)
                if (!info) return null
                if (info.category === 'floor' || info.category === 'wall') return null
                const pos = placements.get(item.id)
                if (!pos) return null
                return (
                  <DecorationItem3D
                    key={item.id}
                    decoration={info}
                    gridX={pos.x}
                    gridZ={pos.z}
                    rotationY={pos.ry}
                    isSelected={selectedPlacedId === item.id}
                    onClick={() => {
                      if (mode === 'edit') {
                        setSelectedPlacedId(selectedPlacedId === item.id ? null : item.id)
                        setSelectedUnplacedId(null)
                        setMovingPokemon(false)
                      }
                    }}
                  />
                )
              })}

              {pokemonInfo ? (
                <PokemonSpriteCharacter
                  speciesId={pokemonInfo.species_id}
                  name={pokemonInfo.name}
                  gridX={pokemonPos.x}
                  gridZ={pokemonPos.z}
                  isSelected={movingPokemon}
                  onClick={() => {
                    if (mode === 'edit') {
                      setMovingPokemon(!movingPokemon)
                      setSelectedPlacedId(null)
                      setSelectedUnplacedId(null)
                    }
                  }}
                />
              ) : (
                <group />
              )}

              <FloorGridHighlight
                editMode={mode === 'edit' && (!!selectedUnplacedId || !!selectedPlacedId || movingPokemon)}
                occupiedCells={occupiedCells}
                onSlotClick={handleSlotClick}
              />

              <OrbitControls
                enablePan={false}
                target={[(GRID_SIZE + OUTDOOR_SIZE / 2) / 2, 0, GRID_SIZE / 2 - 0.5]}
                minPolarAngle={Math.PI / 6}
                maxPolarAngle={Math.PI / 3}
                minAzimuthAngle={-Math.PI / 6}
                maxAzimuthAngle={Math.PI / 6}
                minZoom={35}
                maxZoom={100}
                makeDefault
              />
            </Canvas>
          </Suspense>

          {/* Empty room guide */}
          {owned.length === 0 && mode === 'view' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <motion.div
                className="text-center pointer-events-auto"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-2xl font-bold text-emerald-700 mb-3" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                  小屋还空空的呢~
                </p>
                <motion.button
                  onClick={() => setMode('shop')}
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-6 py-3 rounded-2xl font-bold text-lg shadow-lg"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  🛍️ 去商店逛逛
                </motion.button>
              </motion.div>
            </div>
          )}

          {/* Selected placed item action (near the 3D scene) */}
          <AnimatePresence>
            {mode === 'edit' && selectedPlacedId && (
              <motion.div
                className="absolute top-4 right-4 flex flex-col gap-2 z-20"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <div className="bg-white/90 backdrop-blur rounded-xl px-3 py-2 text-center font-bold shadow-lg"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.9rem', color: '#4CAF50' }}>
                  📍 点击地板格子移动位置
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemove(selectedPlacedId)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-colors"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}
                  >
                    🗑️ 收回背包
                  </button>
                  <button
                    onClick={() => setSelectedPlacedId(null)}
                    className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-colors"
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Moving pokemon indicator */}
          <AnimatePresence>
            {mode === 'edit' && movingPokemon && (
              <motion.div
                className="absolute top-4 right-4 flex flex-col gap-2 z-20"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <div className="bg-indigo-500/90 backdrop-blur rounded-xl px-4 py-2.5 text-center font-bold shadow-lg text-white"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}>
                  📍 点击地板格子移动宝可梦
                </div>
                <button
                  onClick={() => setMovingPokemon(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-colors"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}
                >
                  取消
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected unplaced item hint */}
          <AnimatePresence>
            {mode === 'edit' && selectedUnplacedId && (
              <motion.div
                className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-emerald-500 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg flex items-center gap-2"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.95rem' }}
              >
                <span>👆 点击绿色格子放置</span>
                <button
                  onClick={() => setSelectedUnplacedId(null)}
                  className="ml-2 bg-white/30 hover:bg-white/50 rounded-lg px-2 py-0.5 transition-colors"
                >
                  取消
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode buttons */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {mode === 'view' ? (
              <>
                <motion.button
                  onClick={() => setMode('edit')}
                  className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-5 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-xl shadow-xl border-2 border-emerald-300"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  🎨 装饰
                </motion.button>
                <motion.button
                  onClick={() => setMode('shop')}
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-5 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-xl shadow-xl border-2 border-yellow-300"
                  style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  🛍️ 商店
                </motion.button>
              </>
            ) : (
              <motion.button
                onClick={() => { setMode('view'); setSelectedUnplacedId(null); setSelectedPlacedId(null) }}
                className="bg-gradient-to-r from-indigo-400 to-purple-500 text-white px-5 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-xl shadow-xl border-2 border-indigo-300"
                style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              >
                ✓ 完成
              </motion.button>
            )}
          </div>
        </div>

        {/* Bottom panels */}
        <AnimatePresence>
          {mode === 'edit' && (
            <motion.div
              className="bg-white border-t-4 border-emerald-200 flex-shrink-0"
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="flex gap-1.5 px-4 md:px-6 pt-3 pb-1.5 overflow-x-auto">
                {CATEGORY_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setEditCategory(t.key)}
                    className={`px-3 py-1.5 rounded-lg font-bold border-2 whitespace-nowrap transition-all flex items-center gap-1 text-sm ${
                      editCategory === t.key
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                    }`}
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              <div className="px-4 md:px-6 pb-3 flex gap-3 overflow-x-auto" style={{ maxHeight: '110px' }}>
                {filteredUnplaced.map(item => {
                  const info = getDecoInfo(item.decoration_id)
                  if (!info) return null
                  const isActive = selectedUnplacedId === item.id
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => {
                        if (placing) return
                        setSelectedUnplacedId(isActive ? null : item.id)
                        setSelectedPlacedId(null)
                      }}
                      disabled={placing}
                      className={`flex-shrink-0 w-20 md:w-24 rounded-2xl p-2 md:p-3 text-center transition-all ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-300'
                          : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                      }`}
                      style={{ borderWidth: 3 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="text-2xl md:text-3xl mb-1">{info.icon}</div>
                      <p className="text-xs font-bold text-gray-700 truncate" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                        {info.name}
                      </p>
                    </motion.button>
                  )
                })}
                {filteredUnplaced.length === 0 && (
                  <div className="flex items-center justify-center w-full py-3">
                    <button
                      onClick={() => setMode('shop')}
                      className="text-emerald-500 font-bold hover:text-emerald-700 transition-colors"
                      style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '1rem' }}
                    >
                      背包空空的，去商店逛逛 →
                    </button>
                  </div>
                )}
              </div>

              {/* Placed count */}
              <div className="px-4 md:px-6 pb-2 flex items-center justify-between text-xs text-gray-400" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                <span>已放置 {placedItems.filter(i => { const info = getDecoInfo(i.decoration_id); return info && info.category !== 'floor' && info.category !== 'wall' }).length} 件</span>
                <span>背包 {unplacedItems.length} 件</span>
              </div>
            </motion.div>
          )}

          {mode === 'shop' && (
            <motion.div
              className="bg-white border-t-4 border-yellow-200 flex-shrink-0 overflow-y-auto"
              style={{ maxHeight: '38vh' }}
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="flex gap-1.5 px-4 md:px-6 pt-3 pb-1.5 overflow-x-auto sticky top-0 bg-white z-10">
                {CATEGORY_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setEditCategory(t.key)}
                    className={`px-3 py-1.5 rounded-lg font-bold border-2 whitespace-nowrap transition-all flex items-center gap-1 text-sm ${
                      editCategory === t.key
                        ? 'bg-yellow-400 text-white border-yellow-400'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300'
                    }`}
                    style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 px-4 md:px-6 pb-4">
                {shopCatalog.map(d => {
                  const ownedItem = owned.find(o => o.decoration_id === d.id)
                  const isOwned = !!ownedItem
                  const isPlaced = ownedItem?.placed === 1
                  const canAfford = candyBalance >= d.price
                  return (
                    <motion.div
                      key={d.id}
                      className={`rounded-2xl p-3 md:p-4 border-2 ${RARITY_COLORS[d.rarity] || 'border-gray-200 bg-white'}`}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="text-3xl md:text-4xl text-center mb-1">{d.icon}</div>
                      <p className="font-bold text-gray-800 text-center text-xs md:text-sm" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>{d.name}</p>
                      {/* Description */}
                      {d.description && (
                        <p className="text-gray-400 text-center mt-0.5 leading-tight" style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif", fontSize: '0.7rem' }}>
                          {d.description}
                        </p>
                      )}
                      <div className="flex justify-center mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          d.rarity === 'epic' ? 'bg-purple-100 text-purple-600' :
                          d.rarity === 'rare' ? 'bg-blue-100 text-blue-600' :
                          d.rarity === 'uncommon' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>{RARITY_LABELS[d.rarity] || '普通'}</span>
                      </div>
                      <div className="mt-1.5 text-center">
                        {isOwned ? (
                          <span className={`font-bold text-xs ${isPlaced ? 'text-emerald-500' : 'text-amber-500'}`} style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}>
                            {isPlaced ? '✓ 已放置' : '📦 背包中'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBuy(d.id)}
                            disabled={!canAfford || buying === d.id}
                            className={`px-3 py-1 rounded-xl font-bold text-white text-xs transition-all ${
                              canAfford ? 'bg-yellow-400 hover:bg-yellow-500 active:scale-95' : 'bg-gray-300 cursor-not-allowed'
                            }`}
                            style={{ fontFamily: "'ZCOOL KuaiLe', sans-serif" }}
                          >
                            {buying === d.id ? '购买中...' : `⭐ ${d.price}`}
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

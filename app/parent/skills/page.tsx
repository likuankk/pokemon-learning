'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────

interface Skill {
  id: string; name: string; type: string; power: number
  accuracy: number; pp: number; effect: string | null; unlock_level: number
  usedBySpecies: number; usedByPokemon: number
}

interface Species {
  id: number; name: string; emoji: string; type1: string; type2: string | null
  rarity: number; region: number
  skill1: string | null; skill2: string | null; skill3: string | null; skill4: string | null
  skill1_name: string | null; skill2_name: string | null; skill3_name: string | null; skill4_name: string | null
  skill1_type: string | null; skill2_type: string | null; skill3_type: string | null; skill4_type: string | null
  skill1_power: number | null; skill2_power: number | null; skill3_power: number | null; skill4_power: number | null
}

interface Region { id: number; name: string; emoji: string }

interface PokemonWithSkills {
  id: number; name: string; species_id: number; child_id: number
  emoji: string; type1: string; type2: string | null; species_name: string
  child_name: string; battle_level: number
  skills: { slot: number; skill_id: string; current_pp: number; name: string; type: string; power: number; accuracy: number; pp: number }[]
}

// ── Constants ─────────────────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  normal: '⭐', fire: '🔥', water: '💧', grass: '🌿', electric: '⚡',
  ground: '🌍', ice: '❄️', flying: '🪽', bug: '🐛', fairy: '🧚'
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030',
  ground: '#e0c068', ice: '#98d8d8', flying: '#a890f0', bug: '#a8b820', fairy: '#ee99ac'
}

const TIER_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1:  { label: 'Lv.1 基础', color: '#16a34a', bg: '#dcfce7' },
  3:  { label: 'Lv.3 中级', color: '#2563eb', bg: '#dbeafe' },
  8:  { label: 'Lv.8 辅助', color: '#9333ea', bg: '#f3e8ff' },
  15: { label: 'Lv.15 终极', color: '#dc2626', bg: '#fee2e2' },
}

const EFFECT_LABELS: Record<string, string> = {
  burn: '灼伤', paralyze: '麻痹', freeze: '冰冻', sleep: '催眠',
  heal: '治愈', attack_up: '攻击提升', defense_up: '防御提升',
  speed_down: '速度降低', charge: '蓄力', recharge: '休息',
}

const SKILL_UNLOCK_LEVELS: Record<number, number> = { 1: 1, 2: 3, 3: 8, 4: 15 }

const font = "'ZCOOL KuaiLe', sans-serif"

// ── Helpers ───────────────────────────────────────────────────────────────

function parseEffect(effectStr: string | null): string {
  if (!effectStr) return ''
  try {
    const e = JSON.parse(effectStr)
    const label = EFFECT_LABELS[e.type] || e.type
    if (e.chance) return `${e.chance}%${label}`
    if (e.amount && e.duration) return `${label}+${Math.round(e.amount * 100)}% ${e.duration}回合`
    if (e.amount) return `${label}${Math.round(e.amount * 100)}%`
    if (e.duration) return `${label}${e.duration}回合`
    if (e.turns) return `${label}${e.turns}回合`
    return label
  } catch { return '' }
}

function buildEffectJson(effectType: string, effectChance: number, effectAmount: number, effectDuration: number): string | null {
  if (!effectType || effectType === 'none') return null
  const obj: any = { type: effectType }
  if (['burn', 'paralyze', 'freeze'].includes(effectType)) {
    obj.chance = effectChance
  } else if (['sleep'].includes(effectType)) {
    obj.duration = effectDuration
  } else if (['heal'].includes(effectType)) {
    obj.amount = effectAmount / 100
  } else if (['attack_up', 'defense_up'].includes(effectType)) {
    obj.amount = effectAmount / 100
    obj.duration = effectDuration
  } else if (['speed_down'].includes(effectType)) {
    obj.chance = effectChance
    obj.amount = effectAmount / 100
  } else if (['charge', 'recharge'].includes(effectType)) {
    obj.turns = effectDuration
  }
  return JSON.stringify(obj)
}

function parseEffectFields(effectStr: string | null): { effectType: string; effectChance: number; effectAmount: number; effectDuration: number } {
  if (!effectStr) return { effectType: 'none', effectChance: 10, effectAmount: 30, effectDuration: 2 }
  try {
    const e = JSON.parse(effectStr)
    return {
      effectType: e.type || 'none',
      effectChance: e.chance ?? 10,
      effectAmount: e.amount ? Math.round(e.amount * 100) : 30,
      effectDuration: e.duration ?? e.turns ?? 2,
    }
  } catch { return { effectType: 'none', effectChance: 10, effectAmount: 30, effectDuration: 2 } }
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SkillsManagementPage() {
  const [tab, setTab] = useState<'library' | 'species' | 'pokemon'>('library')

  const tabs = [
    { key: 'library' as const, label: '技能图鉴', emoji: '📖' },
    { key: 'species' as const, label: '物种配置', emoji: '🐾' },
    { key: 'pokemon' as const, label: '宝可梦技能', emoji: '⚔️' },
  ]

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b-4 border-indigo-200 px-4 md:px-8 py-6"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
        <h1 className="game-title-indigo leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', color: '#4338ca' }}>
          技能管理 ⚔️
        </h1>
        <p className="text-indigo-400 mt-2 font-bold" style={{ fontFamily: font, fontSize: '1.5rem' }}>
          管理战斗技能库和宝可梦技能配置
        </p>
      </div>

      {/* Tab Bar */}
      <div className="px-4 md:px-8 pt-6">
        <div className="flex items-center gap-3 bg-white rounded-2xl border-2 border-gray-200 p-2 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                tab === t.key
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              style={{ fontFamily: font, fontSize: '1.25rem' }}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 md:px-8 py-6">
        {tab === 'library' && <SkillLibraryTab />}
        {tab === 'species' && <SpeciesConfigTab />}
        {tab === 'pokemon' && <PokemonSkillsTab />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Tab 1: Skill Library
// ══════════════════════════════════════════════════════════════════════════

function SkillLibraryTab() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [tierFilter, setTierFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const loadSkills = useCallback(() => {
    setLoading(true)
    fetch('/api/skills').then(r => r.json()).then(d => {
      setSkills(d.skills || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { loadSkills() }, [loadSkills])

  const filtered = skills.filter(s => {
    if (tierFilter && s.unlock_level !== tierFilter) return false
    if (typeFilter && s.type !== typeFilter) return false
    return true
  })

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该技能？')) return
    const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error + (data.usedBySpecies ? `\n被 ${data.usedBySpecies} 个物种使用` : '') + (data.usedByPokemon ? `\n被 ${data.usedByPokemon} 只宝可梦装备` : ''))
      return
    }
    loadSkills()
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-6 space-y-3">
        {/* Tier filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-500" style={{ fontFamily: font, fontSize: '1.1rem' }}>等级:</span>
          <button
            onClick={() => setTierFilter(null)}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${!tierFilter ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
            style={{ fontFamily: font, fontSize: '1.1rem' }}
          >全部</button>
          {[1, 3, 8, 15].map(tier => (
            <button
              key={tier}
              onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${tierFilter === tier ? 'text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
              style={{
                fontFamily: font, fontSize: '1.1rem',
                background: tierFilter === tier ? TIER_LABELS[tier].color : 'white',
                color: tierFilter === tier ? 'white' : TIER_LABELS[tier].color,
              }}
            >{TIER_LABELS[tier].label}</button>
          ))}
        </div>
        {/* Type filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-500" style={{ fontFamily: font, fontSize: '1.1rem' }}>属性:</span>
          <button
            onClick={() => setTypeFilter(null)}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${!typeFilter ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
            style={{ fontFamily: font, fontSize: '1.1rem' }}
          >全部</button>
          {Object.entries(TYPE_EMOJI).map(([type, emoji]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={`px-3 py-2 rounded-xl font-bold transition-all text-lg ${typeFilter === type ? 'ring-2 ring-offset-1 ring-indigo-400' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}
              style={{
                background: typeFilter === type ? TYPE_COLORS[type] + '30' : undefined,
              }}
              title={type}
            >{emoji}</button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="text-center py-16">
          <span className="text-6xl animate-bounce inline-block">⚔️</span>
          <p className="text-gray-400 mt-4 font-bold" style={{ fontFamily: font, fontSize: '1.5rem' }}>加载中...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((skill, i) => (
              <motion.div
                key={skill.id}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl border-2 border-gray-200 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{TYPE_EMOJI[skill.type] || '⭐'}</span>
                    <div>
                      <h3 className="font-bold" style={{ fontFamily: font, fontSize: '1.4rem', color: TYPE_COLORS[skill.type] }}>
                        {skill.name}
                      </h3>
                      <span className="text-xs font-mono text-gray-400">{skill.id}</span>
                    </div>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full font-bold text-sm"
                    style={{
                      background: TIER_LABELS[skill.unlock_level]?.bg || '#f3f4f6',
                      color: TIER_LABELS[skill.unlock_level]?.color || '#6b7280',
                      fontFamily: font,
                    }}
                  >
                    {TIER_LABELS[skill.unlock_level]?.label || `Lv.${skill.unlock_level}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 font-bold" style={{ fontFamily: font }}>威力</p>
                    <p className="font-bold text-lg" style={{ fontFamily: font, color: skill.power > 0 ? '#1f2937' : '#9ca3af' }}>
                      {skill.power || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 font-bold" style={{ fontFamily: font }}>命中</p>
                    <p className="font-bold text-lg" style={{ fontFamily: font }}>{skill.accuracy}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 font-bold" style={{ fontFamily: font }}>PP</p>
                    <p className="font-bold text-lg" style={{ fontFamily: font }}>{skill.pp}</p>
                  </div>
                </div>

                {skill.effect && (
                  <div className="mb-3 px-3 py-2 bg-yellow-50 rounded-xl border border-yellow-200">
                    <span className="font-bold text-yellow-700" style={{ fontFamily: font, fontSize: '1rem' }}>
                      ✨ {parseEffect(skill.effect)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 font-bold" style={{ fontFamily: font }}>
                    {skill.usedBySpecies}个物种 · {skill.usedByPokemon}只宝可梦
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingSkill(skill)}
                      className="px-4 py-2 rounded-xl font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      style={{ fontFamily: font, fontSize: '1rem' }}
                    >编辑</button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      className="px-4 py-2 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                      style={{ fontFamily: font, fontSize: '1rem' }}
                    >删除</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Create button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowCreate(true)}
              className="text-white px-8 py-4 rounded-2xl font-bold transition-colors inline-flex items-center gap-3"
              style={{
                fontFamily: font, fontSize: '1.5rem',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                boxShadow: '0 5px 0 #3730a3, 0 8px 16px rgba(99,102,241,0.3)',
              }}
            >
              <span>➕</span> 新建技能
            </button>
          </div>
        </>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {(editingSkill || showCreate) && (
          <SkillEditModal
            skill={editingSkill}
            skills={skills}
            onClose={() => { setEditingSkill(null); setShowCreate(false) }}
            onSaved={() => { setEditingSkill(null); setShowCreate(false); loadSkills() }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Skill Edit Modal ──────────────────────────────────────────────────────

function SkillEditModal({ skill, skills, onClose, onSaved }: {
  skill: Skill | null; skills: Skill[]; onClose: () => void; onSaved: () => void
}) {
  const isCreate = !skill
  const [id, setId] = useState(skill?.id || suggestNextId(skills))
  const [name, setName] = useState(skill?.name || '')
  const [type, setType] = useState(skill?.type || 'normal')
  const [power, setPower] = useState(skill?.power ?? 40)
  const [accuracy, setAccuracy] = useState(skill?.accuracy ?? 100)
  const [pp, setPP] = useState(skill?.pp ?? 20)
  const [unlockLevel, setUnlockLevel] = useState(skill?.unlock_level ?? 1)
  const [saving, setSaving] = useState(false)

  const ef = parseEffectFields(skill?.effect || null)
  const [effectType, setEffectType] = useState(ef.effectType)
  const [effectChance, setEffectChance] = useState(ef.effectChance)
  const [effectAmount, setEffectAmount] = useState(ef.effectAmount)
  const [effectDuration, setEffectDuration] = useState(ef.effectDuration)

  const handleSave = async () => {
    if (!name.trim()) { alert('请输入技能名称'); return }
    setSaving(true)
    const effectJson = buildEffectJson(effectType, effectChance, effectAmount, effectDuration)
    const payload = { id, name: name.trim(), type, power, accuracy, pp, effect: effectJson, unlock_level: unlockLevel }

    const url = isCreate ? '/api/skills' : `/api/skills/${skill!.id}`
    const method = isCreate ? 'POST' : 'PUT'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error); return }
    onSaved()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold mb-6 flex items-center gap-2" style={{ fontFamily: font, fontSize: '1.8rem', color: '#4338ca' }}>
          {isCreate ? '➕ 新建技能' : '✏️ 编辑技能'}
        </h2>

        <div className="space-y-4">
          {/* ID */}
          <div>
            <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1.1rem' }}>技能ID</label>
            <input
              value={id} onChange={e => setId(e.target.value)} disabled={!isCreate}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 font-mono text-lg disabled:bg-gray-100 disabled:text-gray-400"
              placeholder="S30"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1.1rem' }}>技能名称</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-lg"
              style={{ fontFamily: font }}
              placeholder="技能名称"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1.1rem' }}>属性</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_EMOJI).map(([t, emoji]) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1 ${
                    type === t ? 'text-white ring-2 ring-offset-1' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={{
                    background: type === t ? TYPE_COLORS[t] : undefined,
                    fontFamily: font, fontSize: '1rem',
                  }}
                >{emoji} {t}</button>
              ))}
            </div>
          </div>

          {/* Power / Accuracy / PP */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1rem' }}>威力</label>
              <input type="number" value={power} onChange={e => setPower(Number(e.target.value))} min={0} max={200}
                className="w-full px-3 py-3 rounded-xl border-2 border-gray-200 text-lg text-center" style={{ fontFamily: font }} />
            </div>
            <div>
              <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1rem' }}>命中</label>
              <input type="number" value={accuracy} onChange={e => setAccuracy(Number(e.target.value))} min={1} max={100}
                className="w-full px-3 py-3 rounded-xl border-2 border-gray-200 text-lg text-center" style={{ fontFamily: font }} />
            </div>
            <div>
              <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1rem' }}>PP</label>
              <input type="number" value={pp} onChange={e => setPP(Number(e.target.value))} min={1} max={50}
                className="w-full px-3 py-3 rounded-xl border-2 border-gray-200 text-lg text-center" style={{ fontFamily: font }} />
            </div>
          </div>

          {/* Unlock Level */}
          <div>
            <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1.1rem' }}>解锁等级</label>
            <div className="flex gap-2">
              {[1, 3, 8, 15].map(lv => (
                <button
                  key={lv}
                  onClick={() => setUnlockLevel(lv)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${unlockLevel === lv ? 'text-white' : 'border border-gray-200'}`}
                  style={{
                    fontFamily: font, fontSize: '1.1rem',
                    background: unlockLevel === lv ? TIER_LABELS[lv].color : 'white',
                    color: unlockLevel === lv ? 'white' : TIER_LABELS[lv].color,
                  }}
                >Lv.{lv}</button>
              ))}
            </div>
          </div>

          {/* Effect */}
          <div>
            <label className="block font-bold text-gray-600 mb-1" style={{ fontFamily: font, fontSize: '1.1rem' }}>特殊效果</label>
            <select
              value={effectType} onChange={e => setEffectType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-lg mb-2"
              style={{ fontFamily: font }}
            >
              <option value="none">无</option>
              {Object.entries(EFFECT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {effectType !== 'none' && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {['burn', 'paralyze', 'freeze', 'speed_down'].includes(effectType) && (
                  <div>
                    <label className="text-xs text-gray-400 font-bold" style={{ fontFamily: font }}>概率%</label>
                    <input type="number" value={effectChance} onChange={e => setEffectChance(Number(e.target.value))}
                      min={1} max={100} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-center" />
                  </div>
                )}
                {['heal', 'attack_up', 'defense_up', 'speed_down'].includes(effectType) && (
                  <div>
                    <label className="text-xs text-gray-400 font-bold" style={{ fontFamily: font }}>数值%</label>
                    <input type="number" value={effectAmount} onChange={e => setEffectAmount(Number(e.target.value))}
                      min={1} max={100} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-center" />
                  </div>
                )}
                {['sleep', 'attack_up', 'defense_up', 'charge', 'recharge'].includes(effectType) && (
                  <div>
                    <label className="text-xs text-gray-400 font-bold" style={{ fontFamily: font }}>回合数</label>
                    <input type="number" value={effectDuration} onChange={e => setEffectDuration(Number(e.target.value))}
                      min={1} max={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-center" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            style={{ fontFamily: font, fontSize: '1.3rem' }}
          >取消</button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 py-4 rounded-xl font-bold text-white transition-colors disabled:opacity-50"
            style={{
              fontFamily: font, fontSize: '1.3rem',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 4px 0 #3730a3',
            }}
          >{saving ? '保存中...' : '💾 保存'}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function suggestNextId(skills: Skill[]): string {
  const nums = skills.map(s => parseInt(s.id.replace('S', ''))).filter(n => !isNaN(n))
  const next = Math.max(0, ...nums) + 1
  return `S${String(next).padStart(2, '0')}`
}

// ══════════════════════════════════════════════════════════════════════════
// Tab 2: Species Config
// ══════════════════════════════════════════════════════════════════════════

function SpeciesConfigTab() {
  const [species, setSpecies] = useState<Species[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [regionFilter, setRegionFilter] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [editedSpecies, setEditedSpecies] = useState<Record<number, { skill1: string | null; skill2: string | null; skill3: string | null; skill4: string | null }>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/skills/species').then(r => r.json()),
      fetch('/api/skills').then(r => r.json()),
    ]).then(([speciesData, skillsData]) => {
      setSpecies(speciesData.species || [])
      setRegions(speciesData.regions || [])
      setSkills(skillsData.skills || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = regionFilter ? species.filter(s => s.region === regionFilter) : species

  const getSkillsForSlot = (slot: number) => {
    const maxLevel = SKILL_UNLOCK_LEVELS[slot] || 15
    return skills.filter(s => s.unlock_level <= maxLevel)
  }

  const getEdited = (sp: Species) => editedSpecies[sp.id] || { skill1: sp.skill1, skill2: sp.skill2, skill3: sp.skill3, skill4: sp.skill4 }
  const isEdited = (sp: Species) => {
    const ed = editedSpecies[sp.id]
    if (!ed) return false
    return ed.skill1 !== sp.skill1 || ed.skill2 !== sp.skill2 || ed.skill3 !== sp.skill3 || ed.skill4 !== sp.skill4
  }

  const updateSlot = (speciesId: number, slot: number, skillId: string | null, sp: Species) => {
    const current = getEdited(sp)
    setEditedSpecies(prev => ({
      ...prev,
      [speciesId]: { ...current, [`skill${slot}`]: skillId || null }
    }))
  }

  const handleSave = async (sp: Species) => {
    const edited = getEdited(sp)
    if (!edited.skill1) { alert('技能槽1不能为空'); return }
    setSavingId(sp.id)
    const res = await fetch(`/api/skills/species/${sp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edited),
    })
    const data = await res.json()
    setSavingId(null)
    if (!res.ok) { alert(data.error); return }
    // Update local state
    setSpecies(prev => prev.map(s => s.id === sp.id ? {
      ...s,
      skill1: edited.skill1, skill2: edited.skill2, skill3: edited.skill3, skill4: edited.skill4,
      skill1_name: skills.find(sk => sk.id === edited.skill1)?.name || null,
      skill2_name: skills.find(sk => sk.id === edited.skill2)?.name || null,
      skill3_name: skills.find(sk => sk.id === edited.skill3)?.name || null,
      skill4_name: skills.find(sk => sk.id === edited.skill4)?.name || null,
      skill1_type: skills.find(sk => sk.id === edited.skill1)?.type || null,
      skill2_type: skills.find(sk => sk.id === edited.skill2)?.type || null,
      skill3_type: skills.find(sk => sk.id === edited.skill3)?.type || null,
      skill4_type: skills.find(sk => sk.id === edited.skill4)?.type || null,
      skill1_power: skills.find(sk => sk.id === edited.skill1)?.power ?? null,
      skill2_power: skills.find(sk => sk.id === edited.skill2)?.power ?? null,
      skill3_power: skills.find(sk => sk.id === edited.skill3)?.power ?? null,
      skill4_power: skills.find(sk => sk.id === edited.skill4)?.power ?? null,
    } : s))
    setEditedSpecies(prev => { const next = { ...prev }; delete next[sp.id]; return next })
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <span className="text-6xl animate-bounce inline-block">🐾</span>
        <p className="text-gray-400 mt-4 font-bold" style={{ fontFamily: font, fontSize: '1.5rem' }}>加载中...</p>
      </div>
    )
  }

  return (
    <>
      {/* Region filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="font-bold text-gray-500" style={{ fontFamily: font, fontSize: '1.1rem' }}>区域:</span>
        <button
          onClick={() => setRegionFilter(null)}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${!regionFilter ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
          style={{ fontFamily: font, fontSize: '1.1rem' }}
        >全部</button>
        {regions.map(r => (
          <button
            key={r.id}
            onClick={() => setRegionFilter(regionFilter === r.id ? null : r.id)}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1 ${regionFilter === r.id ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
            style={{ fontFamily: font, fontSize: '1.1rem' }}
          >{r.emoji} {r.name}</button>
        ))}
      </div>

      <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl mb-4 font-bold border border-amber-200" style={{ fontFamily: font }}>
        💡 修改物种技能配置仅影响未来捕获的宝可梦，已有宝可梦的技能不会改变
      </p>

      {/* Species cards */}
      <div className="space-y-4">
        {filtered.map((sp, i) => {
          const edited = getEdited(sp)
          const changed = isEdited(sp)
          return (
            <motion.div
              key={sp.id}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`bg-white rounded-2xl border-2 p-5 transition-colors ${changed ? 'border-amber-400' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{sp.emoji}</span>
                <div>
                  <h3 className="font-bold" style={{ fontFamily: font, fontSize: '1.3rem' }}>
                    {sp.name} <span className="text-gray-400 text-sm font-mono">#{sp.id}</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: TYPE_COLORS[sp.type1] }}>
                      {TYPE_EMOJI[sp.type1]} {sp.type1}
                    </span>
                    {sp.type2 && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: TYPE_COLORS[sp.type2] }}>
                        {TYPE_EMOJI[sp.type2]} {sp.type2}
                      </span>
                    )}
                    <span className="text-amber-500">{'★'.repeat(sp.rarity)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(slot => {
                  const skillKey = `skill${slot}` as keyof typeof edited
                  const currentSkillId = edited[skillKey]
                  const availableSkills = getSkillsForSlot(slot)
                  return (
                    <div key={slot} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-400 mb-1" style={{ fontFamily: font }}>
                        技能{slot} <span className="text-gray-300">Lv.{SKILL_UNLOCK_LEVELS[slot]}</span>
                      </p>
                      <select
                        value={currentSkillId || ''}
                        onChange={e => updateSlot(sp.id, slot, e.target.value || null, sp)}
                        className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm font-bold bg-white"
                        style={{ fontFamily: font }}
                      >
                        <option value="">— 无 —</option>
                        {availableSkills.map(sk => (
                          <option key={sk.id} value={sk.id}>
                            {TYPE_EMOJI[sk.type]} {sk.name} (威力:{sk.power})
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              {changed && (
                <div className="mt-3 text-right">
                  <button
                    onClick={() => { setEditedSpecies(prev => { const next = { ...prev }; delete next[sp.id]; return next }) }}
                    className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 mr-2"
                    style={{ fontFamily: font }}
                  >取消</button>
                  <button
                    onClick={() => handleSave(sp)}
                    disabled={savingId === sp.id}
                    className="px-6 py-2 rounded-xl font-bold text-white disabled:opacity-50"
                    style={{
                      fontFamily: font,
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      boxShadow: '0 3px 0 #3730a3',
                    }}
                  >{savingId === sp.id ? '保存中...' : '💾 保存'}</button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <span className="text-7xl block mb-4">🔍</span>
          <p className="text-gray-400 font-bold" style={{ fontFamily: font, fontSize: '1.5rem' }}>没有找到物种</p>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Tab 3: Pokemon Skills
// ══════════════════════════════════════════════════════════════════════════

function PokemonSkillsTab() {
  const [pokemons, setPokemons] = useState<PokemonWithSkills[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [childFilter, setChildFilter] = useState<string | null>(null)
  const [editedSkills, setEditedSkills] = useState<Record<number, { slot: number; skillId: string }[]>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/pokemon-skills').then(r => r.json()),
      fetch('/api/skills').then(r => r.json()),
    ]).then(([pokemonData, skillsData]) => {
      setPokemons(pokemonData.pokemons || [])
      setSkills(skillsData.skills || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const childNames = [...new Set(pokemons.map(p => p.child_name))]
  const filtered = childFilter ? pokemons.filter(p => p.child_name === childFilter) : pokemons

  const getEditedSlots = (poke: PokemonWithSkills) => {
    const edited = editedSkills[poke.id]
    if (edited) return edited
    return poke.skills.map(s => ({ slot: s.slot, skillId: s.skill_id }))
  }

  const isEdited = (poke: PokemonWithSkills) => {
    const edited = editedSkills[poke.id]
    if (!edited) return false
    const orig = poke.skills.map(s => `${s.slot}:${s.skill_id}`).sort().join(',')
    const curr = edited.map(s => `${s.slot}:${s.skillId}`).sort().join(',')
    return orig !== curr
  }

  const updateSlot = (pokeId: number, slot: number, skillId: string, poke: PokemonWithSkills) => {
    const current = getEditedSlots(poke)
    const updated = current.filter(s => s.slot !== slot)
    if (skillId) updated.push({ slot, skillId })
    updated.sort((a, b) => a.slot - b.slot)
    setEditedSkills(prev => ({ ...prev, [pokeId]: updated }))
  }

  const handleSave = async (poke: PokemonWithSkills) => {
    const edited = getEditedSlots(poke)
    if (edited.length === 0) { alert('至少需要一个技能'); return }
    setSavingId(poke.id)
    const res = await fetch(`/api/pokemon-skills/${poke.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: edited }),
    })
    const data = await res.json()
    setSavingId(null)
    if (!res.ok) { alert(data.error); return }
    // Update local state
    setPokemons(prev => prev.map(p => p.id === poke.id ? {
      ...p,
      skills: edited.map(e => {
        const sk = skills.find(s => s.id === e.skillId)!
        return { slot: e.slot, skill_id: e.skillId, current_pp: sk.pp, name: sk.name, type: sk.type, power: sk.power, accuracy: sk.accuracy, pp: sk.pp }
      })
    } : p))
    setEditedSkills(prev => { const next = { ...prev }; delete next[poke.id]; return next })
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <span className="text-6xl animate-bounce inline-block">⚔️</span>
        <p className="text-gray-400 mt-4 font-bold" style={{ fontFamily: font, fontSize: '1.5rem' }}>加载中...</p>
      </div>
    )
  }

  return (
    <>
      {/* Child filter */}
      {childNames.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="font-bold text-gray-500" style={{ fontFamily: font, fontSize: '1.1rem' }}>孩子:</span>
          <button
            onClick={() => setChildFilter(null)}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${!childFilter ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
            style={{ fontFamily: font, fontSize: '1.1rem' }}
          >全部</button>
          {childNames.map(name => (
            <button
              key={name}
              onClick={() => setChildFilter(childFilter === name ? null : name)}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${childFilter === name ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
              style={{ fontFamily: font, fontSize: '1.1rem' }}
            >👦 {name}</button>
          ))}
        </div>
      )}

      {/* Pokemon cards */}
      <div className="space-y-4">
        {filtered.map((poke, i) => {
          const editedSlots = getEditedSlots(poke)
          const changed = isEdited(poke)
          return (
            <motion.div
              key={poke.id}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-white rounded-2xl border-2 p-5 transition-colors ${changed ? 'border-amber-400' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{poke.emoji}</span>
                <div>
                  <h3 className="font-bold" style={{ fontFamily: font, fontSize: '1.3rem' }}>
                    {poke.emoji} {poke.name}
                    {poke.name !== poke.species_name && (
                      <span className="text-gray-400 text-sm ml-1">({poke.species_name})</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: TYPE_COLORS[poke.type1] }}>
                      {TYPE_EMOJI[poke.type1]} {poke.type1}
                    </span>
                    {poke.type2 && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: TYPE_COLORS[poke.type2] }}>
                        {TYPE_EMOJI[poke.type2]} {poke.type2}
                      </span>
                    )}
                    <span className="font-bold text-indigo-500" style={{ fontFamily: font }}>Lv.{poke.battle_level}</span>
                    <span className="text-gray-400 font-bold" style={{ fontFamily: font }}>👦 {poke.child_name}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(slot => {
                  const requiredLevel = SKILL_UNLOCK_LEVELS[slot] || 1
                  const unlocked = poke.battle_level >= requiredLevel
                  const currentSkill = editedSlots.find(s => s.slot === slot)

                  if (!unlocked) {
                    return (
                      <div key={slot} className="bg-gray-100 rounded-xl p-3 opacity-60">
                        <p className="text-xs font-bold text-gray-400 mb-1" style={{ fontFamily: font }}>技能{slot}</p>
                        <div className="text-center py-2">
                          <span className="text-2xl">🔒</span>
                          <p className="text-xs text-gray-400 font-bold mt-1" style={{ fontFamily: font }}>Lv.{requiredLevel}解锁</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={slot} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-400 mb-1" style={{ fontFamily: font }}>
                        技能{slot}
                      </p>
                      <select
                        value={currentSkill?.skillId || ''}
                        onChange={e => updateSlot(poke.id, slot, e.target.value, poke)}
                        className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm font-bold bg-white"
                        style={{ fontFamily: font }}
                      >
                        <option value="">— 无 —</option>
                        {skills.map(sk => (
                          <option key={sk.id} value={sk.id}>
                            {TYPE_EMOJI[sk.type]} {sk.name} (威力:{sk.power})
                          </option>
                        ))}
                      </select>
                      {currentSkill && (() => {
                        const origSkill = poke.skills.find(s => s.slot === slot)
                        if (origSkill) {
                          return (
                            <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: font }}>
                              PP: {origSkill.current_pp}/{origSkill.pp}
                            </p>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )
                })}
              </div>

              {changed && (
                <div className="mt-3 text-right">
                  <button
                    onClick={() => { setEditedSkills(prev => { const next = { ...prev }; delete next[poke.id]; return next }) }}
                    className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 mr-2"
                    style={{ fontFamily: font }}
                  >取消</button>
                  <button
                    onClick={() => handleSave(poke)}
                    disabled={savingId === poke.id}
                    className="px-6 py-2 rounded-xl font-bold text-white disabled:opacity-50"
                    style={{
                      fontFamily: font,
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      boxShadow: '0 3px 0 #3730a3',
                    }}
                  >{savingId === poke.id ? '保存中...' : '💾 保存'}</button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <span className="text-7xl block mb-4">🔍</span>
          <p className="text-gray-400 font-bold" style={{ fontFamily: font, fontSize: '1.5rem' }}>
            {pokemons.length === 0 ? '还没有捕获任何宝可梦' : '没有找到宝可梦'}
          </p>
        </div>
      )}
    </>
  )
}

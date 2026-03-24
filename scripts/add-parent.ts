#!/usr/bin/env tsx
/**
 * 添加家长账号脚本
 *
 * Usage:
 *   npx tsx scripts/add-parent.ts <名字> <密码>
 *   npx tsx scripts/add-parent.ts <名字> <密码> --family <family_id>
 *   npx tsx scripts/add-parent.ts --list
 *
 * Examples:
 *   npx tsx scripts/add-parent.ts 妈妈 123456
 *   npx tsx scripts/add-parent.ts 爸爸 abcdef --family 1
 *   npx tsx scripts/add-parent.ts --list
 *
 * Options:
 *   --family <id>  指定加入的家庭 ID（默认创建新家庭）
 *   --list         列出所有家长账号
 *   --help         显示帮助
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'pokemon.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Password hash (matches lib/auth.ts hashPassword) ──
function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

// ── Invite code generation (matches api/auth/route.ts) ──
function generateInviteCode(familyId: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const base = familyId * 7919 + 100000
  let code = ''
  let n = base
  for (let i = 0; i < 6; i++) {
    code += chars[n % chars.length]
    n = Math.floor(n / chars.length) + familyId
  }
  return code
}

// ── List all parents ──
function listParents() {
  const parents = db.prepare(
    'SELECT id, name, family_id, created_at FROM users WHERE role = ? ORDER BY family_id, id'
  ).all('parent') as any[]

  if (parents.length === 0) {
    console.log('\n📭 暂无家长账号\n')
    return
  }

  console.log(`\n👨‍👩‍👧‍👦 家长账号列表 (${parents.length} 个):\n`)
  console.log('  ID   名字         家庭ID   邀请码     创建时间')
  console.log('  ─────────────────────────────────────────────────')

  for (const p of parents) {
    const inviteCode = generateInviteCode(p.family_id)
    const childCount = (db.prepare(
      'SELECT COUNT(*) as c FROM users WHERE family_id = ? AND role = ?'
    ).get(p.family_id, 'child') as any).c

    console.log(
      `  ${String(p.id).padEnd(5)}${p.name.padEnd(12)} ` +
      `${String(p.family_id).padEnd(9)}${inviteCode.padEnd(11)}` +
      `${p.created_at || 'N/A'}  (${childCount} 个孩子)`
    )
  }
  console.log()
}

// ── Add parent ──
function addParent(name: string, password: string, familyId?: number) {
  // Check duplicate
  const existing = db.prepare('SELECT id FROM users WHERE name = ? AND role = ?').get(name, 'parent') as any
  if (existing) {
    console.error(`\n❌ 家长 "${name}" 已存在 (ID: ${existing.id})\n`)
    process.exit(1)
  }

  // Determine family_id
  let targetFamilyId: number
  if (familyId !== undefined) {
    targetFamilyId = familyId
  } else {
    const maxFamily = db.prepare('SELECT MAX(family_id) as maxF FROM users').get() as any
    targetFamilyId = (maxFamily?.maxF || 0) + 1
  }

  const pwHash = hashPassword(password)
  const result = db.prepare(
    'INSERT INTO users (name, role, family_id, password_hash) VALUES (?, ?, ?, ?)'
  ).run(name, 'parent', targetFamilyId, pwHash)

  const userId = result.lastInsertRowid as number
  const inviteCode = generateInviteCode(targetFamilyId)

  // Ensure family_settings exists
  db.prepare('INSERT OR IGNORE INTO family_settings (family_id) VALUES (?)').run(targetFamilyId)

  console.log(`
╔════════════════════════════════════════╗
║       ✅ 家长账号创建成功！              ║
╚════════════════════════════════════════╝

  👤 名字:      ${name}
  🆔 用户ID:    ${userId}
  👨‍👩‍👧‍👦 家庭ID:    ${targetFamilyId}
  🔑 密码:      ${password}
  📮 邀请码:    ${inviteCode}

  登录方式: 打开应用 → 选择"家长" → 输入名字和密码

  孩子注册: 将邀请码 ${inviteCode} 发给孩子
            孩子打开应用 → 选择"小朋友" → 输入邀请码注册
`)
}

// ── CLI ──
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help') {
  console.log(`
╔════════════════════════════════════════════════════════╗
║          🎮 宝可梦学习乐园 - 添加家长账号脚本            ║
╚════════════════════════════════════════════════════════╝

用法:
  npx tsx scripts/add-parent.ts <名字> <密码>
  npx tsx scripts/add-parent.ts <名字> <密码> --family <family_id>
  npx tsx scripts/add-parent.ts --list

示例:
  npx tsx scripts/add-parent.ts 妈妈 123456           # 创建新家庭
  npx tsx scripts/add-parent.ts 爸爸 abcdef --family 1 # 加入家庭1

选项:
  --family <id>  指定加入的家庭 ID（默认创建新家庭）
  --list         列出所有家长账号
  --help         显示帮助
`)
  process.exit(0)
}

if (args[0] === '--list') {
  listParents()
  db.close()
  process.exit(0)
}

// Parse name and password
const parentName = args[0]
const parentPassword = args[1]

if (!parentName || !parentPassword) {
  console.error('\n❌ 请提供名字和密码: npx tsx scripts/add-parent.ts <名字> <密码>\n')
  process.exit(1)
}

// Parse --family option
let familyId: number | undefined
const familyIdx = args.indexOf('--family')
if (familyIdx !== -1) {
  const fid = parseInt(args[familyIdx + 1])
  if (isNaN(fid)) {
    console.error('\n❌ --family 参数必须是数字\n')
    process.exit(1)
  }
  familyId = fid
}

try {
  addParent(parentName, parentPassword, familyId)
} catch (err) {
  console.error('\n❌ 创建失败:', err)
  process.exit(1)
} finally {
  db.close()
}

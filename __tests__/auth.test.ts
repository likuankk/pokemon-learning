import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth'

describe('Auth - Password Hashing', () => {
  it('hashPassword returns a string starting with h_', () => {
    const hash = hashPassword('test123')
    expect(hash).toMatch(/^h_/)
  })

  it('hashPassword is deterministic', () => {
    const h1 = hashPassword('mypassword')
    const h2 = hashPassword('mypassword')
    expect(h1).toBe(h2)
  })

  it('different passwords produce different hashes', () => {
    const h1 = hashPassword('password1')
    const h2 = hashPassword('password2')
    expect(h1).not.toBe(h2)
  })

  it('hash includes password length suffix', () => {
    const hash = hashPassword('hello')
    expect(hash).toMatch(/_5$/) // "hello" has 5 chars
  })

  it('empty string produces valid hash', () => {
    const hash = hashPassword('')
    expect(hash).toMatch(/^h_/)
    expect(hash).toMatch(/_0$/) // empty string has 0 chars
  })

  it('verifyPassword returns true for matching password', () => {
    const hash = hashPassword('correctPassword')
    expect(verifyPassword('correctPassword', hash)).toBe(true)
  })

  it('verifyPassword returns false for wrong password', () => {
    const hash = hashPassword('correctPassword')
    expect(verifyPassword('wrongPassword', hash)).toBe(false)
  })

  it('verifyPassword returns false for empty password vs non-empty hash', () => {
    const hash = hashPassword('somePassword')
    expect(verifyPassword('', hash)).toBe(false)
  })

  it('unicode passwords work correctly', () => {
    const hash = hashPassword('密码测试')
    expect(verifyPassword('密码测试', hash)).toBe(true)
    expect(verifyPassword('密码', hash)).toBe(false)
  })

  it('very long passwords work', () => {
    const longPassword = 'a'.repeat(10000)
    const hash = hashPassword(longPassword)
    expect(verifyPassword(longPassword, hash)).toBe(true)
  })
})

describe('Auth - Session helpers', () => {
  // getChildId and getFamilyId are tested here with null session
  // (they don't require DB for the null case)
  it('getFamilyId returns 1 for null session', async () => {
    const { getFamilyId } = await import('@/lib/auth')
    expect(getFamilyId(null)).toBe(1)
  })

  it('getFamilyId returns session familyId', async () => {
    const { getFamilyId } = await import('@/lib/auth')
    expect(getFamilyId({ id: 5, name: 'test', role: 'parent', familyId: 42 })).toBe(42)
  })

  it('getChildId returns 2 for null session (default demo child)', async () => {
    // Note: getChildId with null returns default 2
    // We can't easily test the DB path without a real DB, but the null case is safe
    const { getChildId } = await import('@/lib/auth')
    expect(getChildId(null)).toBe(2)
  })

  it('getChildId returns session id for child role', async () => {
    const { getChildId } = await import('@/lib/auth')
    expect(getChildId({ id: 10, name: 'child', role: 'child', familyId: 1 })).toBe(10)
  })
})

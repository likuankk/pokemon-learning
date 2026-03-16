// Test setup - ensure clean test DB
import { vi } from 'vitest'

// Mock next/headers for cookie-based auth
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

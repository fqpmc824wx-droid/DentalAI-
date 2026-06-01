/**
 * User store — durable users with in-memory fallback for tests.
 *
 * Seeds demo staff from lib/mock/users.ts on first database open.
 */

import type { Role } from '@/types'
import { MOCK_USERS } from '@/lib/mock/users'
import { persistenceEnabled } from '@/lib/db/client'
import {
  repoGetUserByEmail,
  repoGetUserById,
  repoListUsers,
  repoUpsertUser,
  repoUpsertUsers,
  repoUsersIsEmpty,
  type StoredUser,
  type UserStatus,
} from '@/lib/db/repositories/users'
import { seedSuperAdminMfaIfNeeded } from '@/lib/auth/mfa/store'
import { hashPassword, verifyPassword } from '@/lib/users/password'

export type { StoredUser, UserStatus }

const globalStore = globalThis as typeof globalThis & {
  __users?: StoredUser[]
  __usersSeeded?: boolean
}

function mockToStored(user: (typeof MOCK_USERS)[number], passwordHash: string): StoredUser {
  const now = new Date().toISOString()
  return {
    id: user.id,
    email: user.email,
    passwordHash,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId,
    clinicIds: user.clinicIds ?? [user.clinicId],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

function seedMemoryUsers(): StoredUser[] {
  const demoHash = hashPassword('demo')
  return MOCK_USERS.map(u => mockToStored(u, demoHash))
}

function seedDiskUsers(): void {
  if (!persistenceEnabled() || !repoUsersIsEmpty()) return
  const demoHash = hashPassword('demo')
  repoUpsertUsers(MOCK_USERS.map(u => mockToStored(u, demoHash)))
  const superAdmin = MOCK_USERS.find(u => u.role === 'super_admin')
  if (superAdmin) seedSuperAdminMfaIfNeeded(superAdmin.id)
}

function loadMemory(): StoredUser[] {
  if (!globalStore.__users) {
    globalStore.__users = seedMemoryUsers()
    const superAdmin = globalStore.__users.find(u => u.role === 'super_admin')
    if (superAdmin) seedSuperAdminMfaIfNeeded(superAdmin.id)
  }
  return globalStore.__users
}

function ensureLoaded(): void {
  if (persistenceEnabled()) {
    seedDiskUsers()
  } else {
    loadMemory()
  }
}

export function __resetUsersForTests(): void {
  delete globalStore.__users
  delete globalStore.__usersSeeded
}

export function getUserByEmail(email: string): StoredUser | undefined {
  ensureLoaded()
  const key = email.toLowerCase().trim()
  if (persistenceEnabled()) return repoGetUserByEmail(key)
  return loadMemory().find(u => u.email === key)
}

export function getUserById(id: string): StoredUser | undefined {
  ensureLoaded()
  if (persistenceEnabled()) return repoGetUserById(id)
  return loadMemory().find(u => u.id === id)
}

export function listUsers(clinicIds?: string[]): StoredUser[] {
  ensureLoaded()
  if (persistenceEnabled()) return repoListUsers(clinicIds)
  const users = loadMemory()
  if (!clinicIds || clinicIds.length === 0) return [...users]
  const allowed = new Set(clinicIds)
  return users.filter(u => u.clinicIds.some(id => allowed.has(id)))
}

export function verifyUserPassword(user: StoredUser, password: string): boolean {
  if (persistenceEnabled()) {
    return verifyPassword(password, user.passwordHash)
  }
  // Test mode: accept plaintext demo from mock for backward compat
  const mock = MOCK_USERS.find(u => u.id === user.id)
  if (mock && mock.password === password) return true
  return verifyPassword(password, user.passwordHash)
}

export function isUserLoginAllowed(user: StoredUser): boolean {
  return user.status === 'active'
}

export function createUserRecord(input: {
  id?: string
  email: string
  name: string
  role: Role
  clinicId: string
  clinicIds?: string[]
  passwordHash?: string | null
  status?: UserStatus
}): StoredUser {
  ensureLoaded()
  const now = new Date().toISOString()
  const user: StoredUser = {
    id: input.id ?? `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    email: input.email.toLowerCase().trim(),
    passwordHash: input.passwordHash ?? null,
    name: input.name,
    role: input.role,
    clinicId: input.clinicId,
    clinicIds: input.clinicIds ?? [input.clinicId],
    status: input.status ?? (input.passwordHash ? 'active' : 'pending_invite'),
    createdAt: now,
    updatedAt: now,
  }

  if (persistenceEnabled()) {
    repoUpsertUser(user)
  } else {
    loadMemory().push(user)
  }

  return user
}

export function updateUserRecord(id: string, patch: Partial<StoredUser>): StoredUser | undefined {
  ensureLoaded()
  const existing = getUserById(id)
  if (!existing) return undefined

  const updated: StoredUser = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  }

  if (persistenceEnabled()) {
    repoUpsertUser(updated)
  } else {
    const mem = loadMemory()
    const idx = mem.findIndex(u => u.id === id)
    if (idx !== -1) mem[idx] = updated
  }

  return updated
}

export function setUserPassword(userId: string, password: string): StoredUser | undefined {
  const now = new Date().toISOString()
  return updateUserRecord(userId, {
    passwordHash: hashPassword(password),
    passwordChangedAt: now,
    status: 'active',
  })
}

export function deactivateUserRecord(userId: string): StoredUser | undefined {
  const now = new Date().toISOString()
  return updateUserRecord(userId, {
    status: 'archived',
    deactivatedAt: now,
  })
}

/** Session-facing shape (no password hash). */
export function toAuthUser(user: StoredUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId,
    clinicIds: user.clinicIds,
  }
}

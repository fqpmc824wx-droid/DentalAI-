/**
 * P06 · S024–S028 — schema foundation verification band.
 *
 * Ledger items largely delivered in S016; this file consolidates sign-off
 * evidence that migrations, durable repositories, hashed credentials, and
 * restart survival are in place before the P07 Dentally gate.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  getDb,
  __closeForTests,
  runInTransaction,
} from '@/lib/db/client'
import {
  addQueueItem,
  getQueueItem,
  invalidateQueueCache,
  __resetQueueForTests,
} from '@/lib/queue/store'
import {
  logAuditEvent,
  getAuditEvents,
  __resetAuditForTests,
} from '@/lib/audit/store'
import {
  checkRateLimit,
  recordFailedAttempt,
  __resetRateLimitForTests,
} from '@/lib/auth/rate-limit'
import {
  getUserByEmail,
  verifyUserPassword,
  __resetUsersForTests,
} from '@/lib/users/store'
import type { QueueItem } from '@/lib/queue/types'

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentalai-schema-band-'))
  process.env.DENTALAI_DATA_DIR = tmpDir
  __resetQueueForTests()
  __resetAuditForTests()
  __resetRateLimitForTests()
  __resetUsersForTests()
})

afterAll(() => {
  __closeForTests()
  delete process.env.DENTALAI_DATA_DIR
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch { /* ignore */ }
})

describe('S024 schema-version table and migration runner', () => {
  it('records migrations through v6 on fresh database open', () => {
    const db = getDb()
    const versions = db.prepare(
      'SELECT version, name FROM schema_migrations ORDER BY version',
    ).all() as { version: number; name: string }[]
    expect(versions.length).toBeGreaterThanOrEqual(6)
    expect(versions.some(v => v.version === 1 && v.name === 'schema_version')).toBe(true)
    expect(versions.some(v => v.version === 6 && v.name === 'app_settings')).toBe(true)
  })
})

describe('S025 durable queue repository', () => {
  it('persists queue items through cache invalidation (simulated restart)', () => {
    const probe: Omit<QueueItem, 'id'> = {
      type: 'booking_request',
      priority: 'normal',
      status: 'pending',
      clinicId: 'clinic-1',
      createdAt: new Date().toISOString(),
      callerPhone: '07700900999',
      callerState: 'no_match',
      title: 'Schema band probe',
      summary: 'Restart survival check',
      confidence: 80,
      source: 'mock',
    }
    const item = addQueueItem(probe)
    invalidateQueueCache()
    expect(getQueueItem(item.id)?.title).toBe('Schema band probe')
  })
})

describe('S026 append-only durable audit repository', () => {
  it('stores audit events in typed table without in-memory cap', () => {
    const actor = {
      userId: 'u-schema',
      name: 'Schema Test',
      role: 'receptionist' as const,
      email: 'schema@test.com',
    }
    logAuditEvent({
      action: 'auth.login',
      status: 'success',
      actor,
      clinicId: 'clinic-1',
      summary: 'schema band audit probe',
    })
    invalidateQueueCache()
    __resetAuditForTests()
    const events = getAuditEvents({ clinicId: 'clinic-1' })
    expect(events.some(e => e.summary === 'schema band audit probe')).toBe(true)
  })

  it('blocks audit UPDATE via SQLite trigger', () => {
    const db = getDb()
    const row = db.prepare('SELECT id FROM audit_events LIMIT 1').get() as { id: string } | undefined
    if (!row) return
    expect(() => {
      db.prepare('UPDATE audit_events SET summary = ? WHERE id = ?').run('mutated', row.id)
    }).toThrow()
  })
})

describe('S027 seeded hashed credentials', () => {
  it('stores scrypt hashes for demo seed users', () => {
    const user = getUserByEmail('reception@smile-dental.co.uk')
    expect(user).toBeTruthy()
    expect(user?.passwordHash).toMatch(/^scrypt:/)
    expect(verifyUserPassword(user!, 'demo')).toBe(true)
    expect(verifyUserPassword(user!, 'wrong')).toBe(false)
  })
})

describe('S028 login attempt persistence and restart survival', () => {
  it('persists rate-limit buckets across cache invalidation', () => {
    const email = 'schema-band@test.com'
    for (let i = 0; i < 3; i++) recordFailedAttempt(email)
    expect(checkRateLimit(email).allowed).toBe(true)

    __resetRateLimitForTests()
    expect(checkRateLimit(email).remaining).toBeLessThan(5)
  })

  it('supports transactional queue + audit writes', () => {
    runInTransaction(() => {
      addQueueItem({
        type: 'booking_request',
        priority: 'low',
        status: 'pending',
        clinicId: 'clinic-1',
        createdAt: new Date().toISOString(),
        callerPhone: '07700900888',
        callerState: 'no_match',
        title: 'Transactional probe',
        summary: 'tx check',
        confidence: 70,
        source: 'mock',
      })
      logAuditEvent({
        action: 'booking.request_created',
        status: 'success',
        actor: {
          userId: 'u-tx',
          name: 'Tx',
          role: 'receptionist',
          email: 'tx@test.com',
        },
        clinicId: 'clinic-1',
        summary: 'transactional audit probe',
      })
    })
    invalidateQueueCache()
    expect(getAuditEvents({ clinicId: 'clinic-1' }).some(e => e.summary === 'transactional audit probe')).toBe(true)
  })
})

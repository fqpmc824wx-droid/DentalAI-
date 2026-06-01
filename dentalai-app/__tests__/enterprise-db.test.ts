/**
 * Enterprise database proof — typed schema, migrations, append-only audit.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  getDb,
  __dbPathForTests,
  __persistenceEnabledForTests,
  __closeForTests,
  runInTransaction,
} from '@/lib/db/client'
import { logAuditEvent, getAuditEvents, __resetAuditForTests } from '@/lib/audit/store'
import { __resetQueueForTests } from '@/lib/queue/store'
import { __resetUsersForTests } from '@/lib/users/store'
import { __resetRateLimitForTests } from '@/lib/auth/rate-limit'

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentalai-enterprise-'))
  process.env.DENTALAI_DATA_DIR = tmpDir
  __resetQueueForTests()
  __resetAuditForTests()
  __resetUsersForTests()
  __resetRateLimitForTests()
})

afterAll(() => {
  __closeForTests()
  delete process.env.DENTALAI_DATA_DIR
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch { /* ignore */ }
})

describe('enterprise schema', () => {
  it('creates typed tables via migrations', () => {
    expect(__persistenceEnabledForTests()).toBe(true)
    const db = getDb()
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as { name: string }[]
    const names = tables.map(t => t.name)
    expect(names).toContain('schema_migrations')
    expect(names).toContain('queue_items')
    expect(names).toContain('audit_events')
    expect(names).toContain('login_attempts')
    expect(names).toContain('users')
    expect(names).toContain('user_invitations')
    expect(names).toContain('password_reset_tokens')
    expect(names).toContain('session_revocations')
    expect(fs.existsSync(__dbPathForTests())).toBe(true)
  })

  it('records applied migration versions', () => {
    const db = getDb()
    const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })
})

describe('append-only audit', () => {
  it('does not cap events at 500', () => {
    const actor = {
      userId: 'user-test',
      name: 'Test',
      role: 'receptionist',
      email: 'test@example.com',
    }

    for (let i = 0; i < 520; i++) {
      logAuditEvent({
        action: 'auth.login',
        status: 'success',
        actor,
        clinicId: 'clinic-test',
        summary: `event ${i}`,
      })
    }

    __resetAuditForTests()

    const events = getAuditEvents({ clinicId: 'clinic-test', limit: 600 })
    expect(events.length).toBeGreaterThanOrEqual(520)
  })
})

describe('transactions', () => {
  it('commits runInTransaction atomically', () => {
    const db = getDb()
    runInTransaction(() => {
      db.prepare('INSERT INTO login_attempts (email, count, window_start) VALUES (?, ?, ?)').run('tx@test.com', 1, Date.now())
    })
    const row = db.prepare('SELECT count FROM login_attempts WHERE email = ?').get('tx@test.com') as { count: number }
    expect(row.count).toBe(1)
  })
})

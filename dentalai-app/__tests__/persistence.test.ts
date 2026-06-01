/**
 * Permanent-memory proof (P03 · S012).
 *
 * Plain English: these tests prove that data written by the app survives a
 * server restart. We point the app at a throwaway database folder, write some
 * data, then SIMULATE A RESTART by dropping the in-process memory cache — which
 * forces the next read to come from the database file on disk rather than RAM.
 * If the data is still there, permanent memory works.
 *
 * Isolation: the rest of the suite runs with persistence OFF (no
 * DENTALAI_DATA_DIR), so it never loads the native SQLite module and never
 * touches the real .data/ folder. Only this file opts in, into a temp dir.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  readCollection,
  writeCollection,
  __dbPathForTests,
  __persistenceEnabledForTests,
  __closeForTests,
} from '@/lib/db/persistence'
import {
  addQueueItem,
  getQueueItem,
  updateQueueItem,
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
  resetRateLimit,
  __resetRateLimitForTests,
  MAX_ATTEMPTS,
} from '@/lib/auth/rate-limit'
import { __resetUsersForTests } from '@/lib/users/store'
import type { QueueItem } from '@/lib/queue/types'

let tmpDir: string

beforeAll(() => {
  // Send all reads/writes to a throwaway folder so the real .data/ is untouched.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentalai-persist-'))
  process.env.DENTALAI_DATA_DIR = tmpDir
  // Start each store from a clean cache so the first access loads from this DB.
  __resetQueueForTests()
  __resetAuditForTests()
  __resetRateLimitForTests()
  __resetUsersForTests()
})

afterAll(() => {
  // Close the SQLite handle so the temp folder can be deleted on every OS.
  __closeForTests()
  delete process.env.DENTALAI_DATA_DIR
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* best-effort cleanup */
  }
})

const actor = {
  userId: 'user-test',
  name: 'Test User',
  role: 'receptionist',
  email: 'test@example.com',
}

/** A synthetic queue item used only to prove data survives a restart. */
function probeItem(title: string): Omit<QueueItem, 'id'> {
  return {
    type: 'booking_request',
    priority: 'normal',
    status: 'pending',
    clinicId: 'clinic-test',
    createdAt: new Date().toISOString(),
    callerPhone: '07700900123',
    callerState: 'confirmed',
    title,
    summary: 'Synthetic item used only to prove data survives a restart.',
    confidence: 100,
    source: 'manual',
  }
}

describe('persistence seam', () => {
  it('turns permanent memory ON when a data dir is configured', () => {
    expect(__persistenceEnabledForTests()).toBe(true)
  })

  it('returns null for a collection that was never written', () => {
    expect(readCollection('never-written')).toBeNull()
  })

  it('reads back exactly what was written (round-trip)', () => {
    const rows = [{ a: 1 }, { a: 2, nested: { ok: true } }]
    writeCollection('roundtrip', rows)
    expect(readCollection('roundtrip')).toEqual(rows)
  })

  it('creates a real database file on disk', () => {
    writeCollection('touch', [{ ok: true }])
    expect(fs.existsSync(__dbPathForTests())).toBe(true)
  })
})

describe('queue survives a restart', () => {
  it('keeps a newly added queue item after a simulated restart', () => {
    const created = addQueueItem(probeItem('Restart-survival probe'))

    // Simulate a server restart: drop the in-process cache so the next read
    // must come from the database file, not memory.
    __resetQueueForTests()

    const found = getQueueItem(created.id)
    expect(found).toBeDefined()
    expect(found?.title).toBe('Restart-survival probe')
  })

  it('keeps an edit to a queue item after a simulated restart', () => {
    const created = addQueueItem(probeItem('Edit-survival probe'))
    updateQueueItem(created.id, { status: 'resolved', notes: 'handled in test' })

    __resetQueueForTests()

    const found = getQueueItem(created.id)
    expect(found?.status).toBe('resolved')
    expect(found?.notes).toBe('handled in test')
  })
})

describe('audit log survives a restart', () => {
  it('keeps a logged event after a simulated restart', () => {
    const evt = logAuditEvent({
      action: 'auth.login',
      status: 'success',
      actor,
      clinicId: 'clinic-test',
      summary: 'login for restart proof',
    })

    __resetAuditForTests()

    const events = getAuditEvents({ clinicId: 'clinic-test' })
    expect(events.some(e => e.id === evt.id)).toBe(true)
  })

  it('still stores patientRef as an ID only — no names — when persisted', () => {
    logAuditEvent({
      action: 'booking.request_approved',
      status: 'success',
      actor,
      clinicId: 'clinic-test',
      patientRef: 'pat-001',
      summary: 'Booking request approved',
    })

    __resetAuditForTests()

    const events = getAuditEvents({ clinicId: 'clinic-test' })
    const persisted = events.find(e => e.patientRef === 'pat-001')
    expect(persisted).toBeDefined()
    expect(persisted?.summary).not.toMatch(/James|Patel/)
  })
})

describe('login rate limit survives a restart', () => {
  it('persists failed attempts and blocks after the limit', () => {
    const email = 'locked@smile-dental.co.uk'
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedAttempt(email)
    expect(checkRateLimit(email).allowed).toBe(false)

    __resetRateLimitForTests()

    expect(checkRateLimit(email).allowed).toBe(false)
  })

  it('clears the bucket after a successful login reset', () => {
    const email = 'reset-me@smile-dental.co.uk'
    recordFailedAttempt(email)
    resetRateLimit(email)

    __resetRateLimitForTests()

    expect(checkRateLimit(email).allowed).toBe(true)
    expect(checkRateLimit(email).remaining).toBe(MAX_ATTEMPTS)
  })
})

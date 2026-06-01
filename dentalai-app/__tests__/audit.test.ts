import { describe, it, expect, beforeEach } from 'vitest'
import { logAuditEvent, getAuditEvents, getAuditEventCount } from '@/lib/audit/store'

// Reset in-memory store before each test
beforeEach(() => {
  const g = globalThis as typeof globalThis & { __auditEvents?: unknown[] }
  g.__auditEvents = []
})

const actor = {
  userId: 'user-1',
  name: 'Sarah Ahmed',
  role: 'receptionist',
  email: 'reception@smile-dental.co.uk',
}

describe('logAuditEvent', () => {
  it('creates an event with a generated id and ISO timestamp', () => {
    const evt = logAuditEvent({
      action: 'auth.login',
      status: 'success',
      actor,
      clinicId: 'clinic-1',
      summary: 'Sarah Ahmed signed in',
    })

    expect(evt.id).toBeTruthy()
    expect(evt.id).toMatch(/^evt_/)
    expect(new Date(evt.timestamp).getTime()).toBeGreaterThan(0)
  })

  it('stores patientRef as ID only — no names', () => {
    const evt = logAuditEvent({
      action: 'booking.request_approved',
      status: 'success',
      actor,
      clinicId: 'clinic-1',
      patientRef: 'pat-001',
      summary: 'Booking request approved',
    })

    expect(evt.patientRef).toBe('pat-001')
    // summary should not contain names from patientRef
    expect(evt.summary).not.toContain('James')
    expect(evt.summary).not.toContain('Patel')
  })

  it('stores events in newest-first order', () => {
    logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-1', summary: 'first' })
    logAuditEvent({ action: 'auth.logout', status: 'success', actor, clinicId: 'clinic-1', summary: 'second' })

    const events = getAuditEvents()
    expect(events[0].summary).toBe('second')
    expect(events[1].summary).toBe('first')
  })

  it('generates unique IDs for rapid sequential events', () => {
    const ids = Array.from({ length: 10 }, () =>
      logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-1', summary: 'test' }).id
    )
    expect(new Set(ids).size).toBe(10)
  })
})

describe('getAuditEvents', () => {
  beforeEach(() => {
    logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-1', summary: 'login c1' })
    logAuditEvent({ action: 'booking.request_approved', status: 'success', actor, clinicId: 'clinic-2', summary: 'approved c2' })
    logAuditEvent({ action: 'auth.logout', status: 'success', actor, clinicId: 'clinic-1', summary: 'logout c1' })
  })

  it('returns all events with no filter', () => {
    expect(getAuditEvents()).toHaveLength(3)
  })

  it('filters by clinicId', () => {
    const c1 = getAuditEvents({ clinicId: 'clinic-1' })
    expect(c1).toHaveLength(2)
    expect(c1.every(e => e.clinicId === 'clinic-1')).toBe(true)
  })

  it('filters by action', () => {
    const logins = getAuditEvents({ action: 'auth.login' })
    expect(logins).toHaveLength(1)
    expect(logins[0].summary).toBe('login c1')
  })

  it('respects limit', () => {
    expect(getAuditEvents({ limit: 2 })).toHaveLength(2)
    expect(getAuditEvents({ limit: 1 })).toHaveLength(1)
  })
})

describe('getAuditEventCount', () => {
  it('returns 0 on empty store', () => {
    expect(getAuditEventCount()).toBe(0)
  })

  it('counts all events without filter', () => {
    logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-1', summary: 'a' })
    logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-2', summary: 'b' })
    expect(getAuditEventCount()).toBe(2)
  })

  it('counts only clinic-scoped events', () => {
    logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-1', summary: 'c1' })
    logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-2', summary: 'c2' })
    logAuditEvent({ action: 'auth.login', status: 'success', actor, clinicId: 'clinic-1', summary: 'c1b' })
    expect(getAuditEventCount({ clinicId: 'clinic-1' })).toBe(2)
    expect(getAuditEventCount({ clinicId: 'clinic-2' })).toBe(1)
  })
})

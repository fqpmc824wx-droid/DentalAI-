/**
 * Dentally audit emission tests — Phase 2.23 closure.
 *
 * Verifies:
 *   - readSafePatientContext audits every sub-read with action types
 *     `dentally.read.patient`, `dentally.read.appointments`,
 *     `dentally.read.treatment_appointments`,
 *     `dentally.read.treatment_plans`, `dentally.read.treatment_plan_items`,
 *     `dentally.read.financial`
 *   - getDentallyReadinessReport audits health + user + practice + sites
 *     with action types `dentally.read.health`, `dentally.read.user`,
 *     `dentally.read.practice`, `dentally.read.sites`
 *   - Audit events carry the actor, not "system", when an actor is provided
 *   - Audit events NEVER contain the token, response bodies, patient
 *     names, DOBs, balances, or other PII
 *   - Failure paths emit audit events with status: 'failure' and the
 *     correct error category
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { __setDentallyTransport, __resetDentallyTransport } from '@/lib/dentally/client'
import { readSafePatientContext } from '@/lib/dentally/patient-context'
import { getDentallyReadinessReport } from '@/lib/dentally/readiness'
import { getAuditEvents } from '@/lib/audit/store'
import type { SessionActor } from '@/lib/access-control'

const TEST_BASE = 'https://api.dentally.test'
const TEST_TOKEN = 'audit-emission-token-XYZ-secret'

function configuredEnv() {
  return () => ({ configured: true as const, baseUrl: TEST_BASE, getAuthorizationHeader: () => `Bearer ${TEST_TOKEN}`, timeoutMs: 1000 })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathFromInput(input: RequestInfo | URL): string {
  return new URL(String(input)).pathname
}

function actor(overrides: Partial<SessionActor> = {}): SessionActor {
  return {
    userId: 'u-audit-1',
    name: 'Audit Tester',
    email: 'audit@dentalai.test',
    role: 'practice_manager',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1'],
    ...overrides,
  }
}

/**
 * Reset the in-memory audit store before each test so emission counts are
 * deterministic. The store lives on globalThis so we mutate it directly.
 */
function resetAuditStore() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (g.__auditEvents) g.__auditEvents.length = 0
}

afterEach(() => __resetDentallyTransport())
beforeEach(() => resetAuditStore())

describe('readSafePatientContext audit emission', () => {
  it('emits dentally.read.* events for every sub-read on success', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/patients/p-1') return jsonResponse({ patient: { id: 'p-1', name: 'Patient A' } })
        if (path === '/v1/appointments') return jsonResponse({ appointments: [{ id: 'a-1' }] })
        if (path === '/v1/treatment_appointments') return jsonResponse({ treatment_appointments: [{ id: 'ta-1', bookable: true }] })
        if (path === '/v1/treatment_plans') return jsonResponse({ treatment_plans: [{ id: 'tp-1' }] })
        if (path === '/v1/treatment_plan_items') return jsonResponse({ treatment_plan_items: [{ id: 'tpi-1', nomenclature: 'UR6' }] })
        if (path === '/v1/accounts') return jsonResponse({ accounts: [{ id: 'acc-1', balance: 0 }] })
        return jsonResponse({}, 404)
      },
    })

    const result = await readSafePatientContext('p-1', { siteId: 's-1', actor: actor() })
    expect(result.ok).toBe(true)

    const events = getAuditEvents({ clinicId: 'clinic-1', limit: 50 })
    const actions = events.map(e => e.action).sort()
    expect(actions).toEqual([
      'dentally.read.appointments',
      'dentally.read.financial',
      'dentally.read.patient',
      'dentally.read.treatment_appointments',
      'dentally.read.treatment_plan_items',
      'dentally.read.treatment_plans',
    ])
    for (const e of events) {
      expect(e.status).toBe('success')
      expect(e.actor.userId).toBe('u-audit-1')
      expect(e.clinicId).toBe('clinic-1')
      expect(e.patientRef).toBe('p-1')
    }
  })

  it('marks sub-reads as failure when their Dentally call fails', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/patients/p-1') return jsonResponse({ patient: { id: 'p-1', name: 'Patient A' } })
        // Every sub-read fails with 500
        return jsonResponse({ error: 'boom' }, 500)
      },
    })

    const result = await readSafePatientContext('p-1', { actor: actor() })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.readiness).toBe('partial')

    const events = getAuditEvents({ clinicId: 'clinic-1', limit: 50 })
    const failures = events.filter(e => e.status === 'failure')
    expect(failures.length).toBeGreaterThanOrEqual(4)
    for (const e of failures) {
      expect(e.metadata?.category).toBe('server_error')
      expect(e.metadata?.statusCode).toBeUndefined() // we don't pass statusCode to the audit, only category
    }
  })

  it('falls back to "system" actor when no actor is provided', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ patient: { id: 'p-2', name: 'X' } }),
    })

    await readSafePatientContext('p-2')
    const events = getAuditEvents({ clinicId: 'system', limit: 50 })
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.actor.userId).toBe('system')
      expect(e.actor.role).toBe('system')
    }
  })

  it('NEVER includes the Dentally token in any audit event', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ patient: { id: 'p-3', name: TEST_TOKEN /* prove token-in-body cannot leak */ } }),
    })

    await readSafePatientContext('p-3', { actor: actor() })
    const events = getAuditEvents({ clinicId: 'clinic-1', limit: 50 })
    const serialised = JSON.stringify(events)
    expect(serialised).not.toContain(TEST_TOKEN)
  })

  it('NEVER includes patient names, DOBs, phone, balances in audit metadata', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/patients/p-4') return jsonResponse({ patient: { id: 'p-4', name: 'Jane Doe', date_of_birth: '1985-03-12', phone: '07700900001' } })
        if (path === '/v1/accounts') return jsonResponse({ accounts: [{ id: 'acc-1', balance: 9999.99 }] })
        return jsonResponse({}, 404)
      },
    })

    await readSafePatientContext('p-4', { actor: actor() })
    const events = getAuditEvents({ clinicId: 'clinic-1', limit: 50 })
    const serialised = JSON.stringify(events)
    expect(serialised).not.toContain('Jane Doe')
    expect(serialised).not.toContain('1985-03-12')
    expect(serialised).not.toContain('07700900001')
    expect(serialised).not.toContain('9999.99')
  })
})

describe('getDentallyReadinessReport audit emission', () => {
  it('emits dentally.read.health + user + practice + sites events', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/user') return jsonResponse({ user: { id: 'u-9', name: 'Admin', email: 'a@a.t' } })
        if (path === '/v1/practice') return jsonResponse({ practice: { id: 'pr-9', name: 'Test Practice' } })
        if (path === '/v1/sites') return jsonResponse({ sites: [{ id: 's-1', name: 'Site A' }, { id: 's-2', name: 'Site B' }] })
        return jsonResponse({}, 404)
      },
    })

    await getDentallyReadinessReport(actor({ role: 'super_admin' }))
    const events = getAuditEvents({ clinicId: 'clinic-1', limit: 50 })
    const actions = events.map(e => e.action).sort()
    expect(actions).toEqual([
      'dentally.read.health',
      'dentally.read.practice',
      'dentally.read.sites',
      'dentally.read.user',
    ])
  })

  it('records the site count in audit metadata without exposing site detail', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/user') return jsonResponse({ user: { id: 'u-1' } })
        if (path === '/v1/practice') return jsonResponse({ practice: { id: 'pr-1', name: 'P' } })
        if (path === '/v1/sites') return jsonResponse({ sites: [{ id: 's-1', name: 'X' }, { id: 's-2', name: 'Y' }, { id: 's-3', name: 'Z' }] })
        return jsonResponse({}, 404)
      },
    })

    await getDentallyReadinessReport(actor())
    const sitesEvent = getAuditEvents({ clinicId: 'clinic-1', limit: 50 }).find(e => e.action === 'dentally.read.sites')
    expect(sitesEvent).toBeDefined()
    expect(sitesEvent?.metadata?.count_sites).toBe(3)
    // Site names must NOT appear in the audit row
    expect(JSON.stringify(sitesEvent)).not.toContain('Site A')
  })

  it('reports the not_configured health event without leaking the token', async () => {
    __setDentallyTransport({
      env: () => ({ configured: false }),
      fetch: async () => jsonResponse({}),
    })

    await getDentallyReadinessReport(actor())
    const events = getAuditEvents({ clinicId: 'clinic-1', limit: 50 })
    const healthEvent = events.find(e => e.action === 'dentally.read.health')
    expect(healthEvent).toBeDefined()
    expect(healthEvent?.status).toBe('failure')
    expect(healthEvent?.metadata?.category).toBe('not_configured')
    // No token in this report either
    expect(JSON.stringify(events)).not.toContain(TEST_TOKEN)
  })
})

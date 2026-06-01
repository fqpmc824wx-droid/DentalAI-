/**
 * Mapping + site-read tests — Phase 2.4.
 *
 * Covers:
 *   - clinicSiteMappingStatus: mapped vs setup_required
 *   - clinicSiteMappingStatusesForActor: respects clinic scope
 *   - siteMappingStatusesForActor: cross-clinic isolation, super_admin sees unmapped
 *   - readDentallyPractice: ok / malformed / 404 / not_configured
 *   - readDentallySites: bare-array, wrapped, malformed, transport error
 */

import { describe, it, expect, afterEach } from 'vitest'
import type { SessionActor } from '@/lib/access-control'
import {
  __setDentallyTransport,
  __resetDentallyTransport,
} from '@/lib/dentally/client'
import { readDentallyPractice } from '@/lib/dentally/practice'
import { readDentallySites } from '@/lib/dentally/site'
import {
  CLINIC_SITE_BINDINGS,
  clinicSiteMappingStatus,
  clinicSiteMappingStatusesForActor,
  siteMappingStatusesForActor,
} from '@/lib/dentally/mapping'

// ── Helpers ──────────────────────────────────────────────────────────────

const TEST_BASE = 'https://api.dentally.test'
const TEST_TOKEN = 'mapping-test-token'

function configuredEnv() {
  return () => ({ configured: true as const, baseUrl: TEST_BASE, getAuthorizationHeader: () => `Bearer ${TEST_TOKEN}`, timeoutMs: 1000 })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function actor(overrides: Partial<SessionActor> = {}): SessionActor {
  return {
    userId: 'u-1',
    name: 'Test User',
    email: 't@t.t',
    role: 'practice_manager',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1'],
    ...overrides,
  }
}

/**
 * Mutate the test-only mapping table and restore it immediately so cross-test
 * pollution is impossible.
 */
function withBindings<T>(
  bindings: Array<{ clinicId: string; dentallySiteId: string; note?: string }>,
  fn: () => T,
): T {
  const snapshot = CLINIC_SITE_BINDINGS.slice()
  CLINIC_SITE_BINDINGS.length = 0
  CLINIC_SITE_BINDINGS.push(...bindings)
  try {
    return fn()
  } finally {
    CLINIC_SITE_BINDINGS.length = 0
    CLINIC_SITE_BINDINGS.push(...snapshot)
  }
}

// ── clinicSiteMappingStatus ─────────────────────────────────────────────

describe('clinicSiteMappingStatus', () => {
  it('returns "mapped" for a bound clinic', () => {
    withBindings([{ clinicId: 'clinic-1', dentallySiteId: 'd-100', note: 'UAT' }], () => {
      const r = clinicSiteMappingStatus('clinic-1')
      expect(r.status).toBe('mapped')
      if (r.status === 'mapped') {
        expect(r.dentallySiteId).toBe('d-100')
        expect(r.note).toBe('UAT')
      }
    })
  })

  it('returns "setup_required" for an unbound clinic', () => {
    withBindings([], () => {
      const r = clinicSiteMappingStatus('clinic-1')
      expect(r.status).toBe('setup_required')
    })
  })
})

// ── clinicSiteMappingStatusesForActor ──────────────────────────────────

describe('clinicSiteMappingStatusesForActor', () => {
  it('returns only the actor\'s clinic for a receptionist', () => {
    withBindings([{ clinicId: 'clinic-1', dentallySiteId: 'd-100' }], () => {
      const list = clinicSiteMappingStatusesForActor(actor({ role: 'receptionist' }))
      expect(list).toHaveLength(1)
      expect(list[0].status).toBe('mapped')
    })
  })

  it('returns all assigned clinics for a group owner', () => {
    withBindings(
      [
        { clinicId: 'clinic-1', dentallySiteId: 'd-100' },
        { clinicId: 'clinic-2', dentallySiteId: 'd-200' },
      ],
      () => {
        const list = clinicSiteMappingStatusesForActor(actor({
          role: 'group_owner',
          clinicIds: ['clinic-1', 'clinic-2'],
        }))
        expect(list).toHaveLength(2)
        expect(list.every(l => l.status === 'mapped')).toBe(true)
      },
    )
  })

  it('marks unbound clinics as setup_required', () => {
    withBindings([{ clinicId: 'clinic-1', dentallySiteId: 'd-100' }], () => {
      const list = clinicSiteMappingStatusesForActor(actor({
        role: 'group_owner',
        clinicIds: ['clinic-1', 'clinic-2'],
      }))
      const statuses = list.map(l => `${l.clinicId}:${l.status}`).sort()
      expect(statuses).toEqual(['clinic-1:mapped', 'clinic-2:setup_required'])
    })
  })

  it('super_admin sees clinics in the mapping table even outside their assigned clinics', () => {
    withBindings(
      [
        { clinicId: 'clinic-9', dentallySiteId: 'd-900' },
      ],
      () => {
        const list = clinicSiteMappingStatusesForActor(actor({
          role: 'super_admin',
          clinicId: 'clinic-1',
          clinicIds: ['clinic-1'],
        }))
        const ids = list.map(l => l.clinicId).sort()
        expect(ids).toContain('clinic-9')
      },
    )
  })
})

// ── siteMappingStatusesForActor ─────────────────────────────────────

describe('siteMappingStatusesForActor', () => {
  it('shows mapped practice only when actor can access its clinic', () => {
    withBindings(
      [
        { clinicId: 'clinic-1', dentallySiteId: 'd-100' },
        { clinicId: 'clinic-2', dentallySiteId: 'd-200' },
      ],
      () => {
        const list = siteMappingStatusesForActor(
          [{ id: 'd-100' }, { id: 'd-200' }],
          actor({ clinicId: 'clinic-1', clinicIds: ['clinic-1'] }),
        )
        expect(list).toHaveLength(1)
        expect(list[0].dentallySiteId).toBe('d-100')
      },
    )
  })

  it('hides unmapped sites from non-super_admin actors', () => {
    withBindings([{ clinicId: 'clinic-1', dentallySiteId: 'd-100' }], () => {
      const list = siteMappingStatusesForActor(
        [{ id: 'd-100' }, { id: 'd-999-unmapped' }],
        actor({ role: 'practice_manager', clinicIds: ['clinic-1'] }),
      )
      expect(list).toHaveLength(1)
      expect(list[0].status).toBe('mapped')
    })
  })

  it('surfaces unmapped sites to super_admin', () => {
    withBindings([], () => {
      const list = siteMappingStatusesForActor(
        [{ id: 'd-999-unmapped' }],
        actor({ role: 'super_admin' }),
      )
      expect(list).toHaveLength(1)
      expect(list[0].status).toBe('unmapped')
    })
  })

  it('returns empty for an actor with no mapped sites and no super_admin role', () => {
    withBindings([{ clinicId: 'clinic-2', dentallySiteId: 'd-200' }], () => {
      const list = siteMappingStatusesForActor(
        [{ id: 'd-200' }],
        actor({ role: 'receptionist', clinicId: 'clinic-1', clinicIds: ['clinic-1'] }),
      )
      expect(list).toHaveLength(0)
    })
  })
})

// ── readDentallyPractice ────────────────────────────────────────────────

describe('readDentallyPractice', () => {
  afterEach(() => __resetDentallyTransport())

  it('parses a bare practice object', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ id: 'd-100', name: 'Smile Dental UAT', timezone: 'Europe/London' }),
    })
    const r = await readDentallyPractice()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.id).toBe('d-100')
      expect(r.data.name).toBe('Smile Dental UAT')
      expect(r.data.timezone).toBe('Europe/London')
    }
  })

  it('parses a practice wrapped under "practice"', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ practice: { id: 'd-100', name: 'Smile' } }),
    })
    const r = await readDentallyPractice()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.name).toBe('Smile')
  })

  it('returns "malformed" when shape is wrong', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ wrong: 'shape' }),
    })
    const r = await readDentallyPractice()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.category).toBe('malformed')
  })

  it('propagates 404 from the client', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({}, 404),
    })
    const r = await readDentallyPractice()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.category).toBe('not_found')
  })

  it('returns not_configured when env is empty', async () => {
    __setDentallyTransport({
      env: () => ({ configured: false }),
      fetch: async () => {
        throw new Error('not called')
      },
    })
    const r = await readDentallyPractice()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.category).toBe('not_configured')
  })

  it('uses the singular /v1/practice endpoint', async () => {
    let capturedUrl = ''
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async (input) => {
        capturedUrl = String(input)
        return jsonResponse({ id: 'current-practice', name: 'Smile' })
      },
    })
    const r = await readDentallyPractice()
    expect(r.ok).toBe(true)
    expect(capturedUrl).toBe(`${TEST_BASE}/v1/practice`)
  })
})

// ── readDentallySites ───────────────────────────────────────────────

describe('readDentallySites', () => {
  afterEach(() => __resetDentallyTransport())

  it('parses a bare array response', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse([
        { id: 'd-100', name: 'A' },
        { id: 'd-200', name: 'B' },
      ]),
    })
    const r = await readDentallySites()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toHaveLength(2)
  })

  it('parses a `{ sites: [...] }` wrapper', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ sites: [{ id: 'd-100', name: 'A' }] }),
    })
    const r = await readDentallySites()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toHaveLength(1)
  })

  it('parses a `{ data: [...] }` wrapper', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ data: [{ id: 'd-100', name: 'A' }] }),
    })
    const r = await readDentallySites()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toHaveLength(1)
  })

  it('filters out unparseable entries silently', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse([
        { id: 'd-100', name: 'A' },
        { id: null, name: 'oops' },          // bad
        { id: 'd-300' /* no name */ },        // bad
        { id: 'd-400', name: 'D' },
      ]),
    })
    const r = await readDentallySites()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.map(p => p.id)).toEqual(['d-100', 'd-400'])
  })

  it('returns malformed for non-array, non-object response', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse('a string'),
    })
    const r = await readDentallySites()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.category).toBe('malformed')
  })

  it('propagates 403 as forbidden', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({}, 403),
    })
    const r = await readDentallySites()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.category).toBe('forbidden')
  })

  it('propagates transport error', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    const r = await readDentallySites()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.category).toBe('network_error')
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import {
  __resetDentallyTransport,
  __setDentallyTransport,
} from '@/lib/dentally/client'
import { DENTALLY_ENDPOINTS } from '@/lib/dentally/endpoints'
import { searchAndResolvePatientMatch, readDentallyPatient } from '@/lib/dentally/patient'
import { readDentallyPatientAppointments } from '@/lib/dentally/appointments'
import {
  getUnbookedTreatmentAppointments,
  readDentallyTreatmentAppointments,
  readDentallyTreatmentPlanItem,
  readDentallyTreatmentPlanItems,
  readDentallyTreatmentPlans,
} from '@/lib/dentally/treatment'
import {
  readFinancialAccountFlagForPatient,
  summariseFinancialFlags,
} from '@/lib/dentally/financial'
import { readSafePatientContext } from '@/lib/dentally/patient-context'
import { getDentallyReadinessReport } from '@/lib/dentally/readiness'
import type { SessionActor } from '@/lib/access-control'

const TEST_BASE = 'https://api.dentally.test'
const TEST_TOKEN = 'read-service-token'

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
    userId: 'u-1',
    name: 'Hamza Khan',
    email: 'manager@dentalai.test',
    role: 'practice_manager',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1'],
    ...overrides,
  }
}

afterEach(() => __resetDentallyTransport())

describe('Dentally endpoint constants', () => {
  it('uses real singular foundation endpoints and never the guessed /v1/practices path', () => {
    expect(DENTALLY_ENDPOINTS.currentUser).toBe('/v1/user')
    expect(DENTALLY_ENDPOINTS.practice).toBe('/v1/practice')
    expect(DENTALLY_ENDPOINTS.sites).toBe('/v1/sites')
    expect(JSON.stringify(DENTALLY_ENDPOINTS)).not.toContain('/v1/practices')
  })
})

describe('patient search and match states', () => {
  it('resolves one candidate as confirmed', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ patients: [{ id: 'p-1', first_name: 'Graeme', last_name: 'Anderson' }] }),
    })

    const result = await searchAndResolvePatientMatch('Graeme Anderson')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.state).toBe('confirmed')
      if (result.data.state === 'confirmed') expect(result.data.patient.fullName).toBe('Graeme Anderson')
    }
  })

  it('resolves multiple candidates as human review', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ patients: [{ id: 'p-1', name: 'A' }, { id: 'p-2', name: 'B' }] }),
    })

    const result = await searchAndResolvePatientMatch('07700')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.state).toBe('multiple')
  })

  it('reads a patient detail without requiring unnecessary fields', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ patient: { id: 'p-1', name: 'Graeme Anderson', date_of_birth: '1977-12-02' } }),
    })

    const result = await readDentallyPatient('p-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.dateOfBirth).toBe('1977-12-02')
  })
})

describe('appointment and treatment reads', () => {
  it('reads patient appointments scoped by patient and site', async () => {
    let captured = ''
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        captured = String(input)
        return jsonResponse({ appointments: [{ id: 'a-1', patient_id: 'p-1', site_id: 's-1', start_time: '2026-05-28T10:30:00Z' }] })
      },
    })

    const result = await readDentallyPatientAppointments('p-1', 's-1')
    expect(result.ok).toBe(true)
    expect(captured).toContain('/v1/appointments?')
    expect(captured).toContain('patient_id=p-1')
    expect(captured).toContain('site_id=s-1')
    if (result.ok) expect(result.data[0].startTime).toContain('2026-05-28')
  })

  it('identifies unbooked treatment appointments from read-only data', () => {
    const unbooked = getUnbookedTreatmentAppointments([
      { id: 'ta-1', bookable: true, completed: false },
      { id: 'ta-2', bookable: true, completed: false, appointmentId: 'a-1' },
      { id: 'ta-3', bookable: false, completed: false },
      { id: 'ta-4', bookable: true, completed: true },
    ])
    expect(unbooked.map(item => item.id)).toEqual(['ta-1'])
  })

  it('reads treatment appointments and treatment plans', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/treatment_appointments') {
          return jsonResponse({ treatment_appointments: [{ id: 'ta-1', patient_id: 'p-1', bookable: true }] })
        }
        if (path === '/v1/treatment_plans') {
          return jsonResponse({ treatment_plans: [{ id: 'tp-1', patient_id: 'p-1', nickname: 'Filling plan' }] })
        }
        return jsonResponse({}, 404)
      },
    })

    const appointments = await readDentallyTreatmentAppointments({ patientId: 'p-1' })
    const plans = await readDentallyTreatmentPlans({ patientId: 'p-1' })
    expect(appointments.ok).toBe(true)
    expect(plans.ok).toBe(true)
    if (appointments.ok) expect(appointments.data[0].bookable).toBe(true)
    if (plans.ok) expect(plans.data[0].nickname).toBe('Filling plan')
  })

  it('reads treatment plan items scoped by patient, plan, and appointment', async () => {
    let captured = ''
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        captured = String(input)
        return jsonResponse({
          treatment_plan_items: [
            {
              id: 'tpi-1',
              patient_id: 'p-1',
              treatment_plan_id: 'tp-1',
              treatment_appointment_id: 'ta-1',
              nomenclature: 'UR6 MOD composite',
              patient_nomenclature: 'White filling, upper right back tooth',
              duration: 30,
              completed: false,
              charged: false,
              price: '95.00',
            },
            {
              id: 'tpi-2',
              patient_id: 'p-1',
              treatment_plan_id: 'tp-1',
              treatment_appointment_id: 'ta-1',
              nomenclature: 'Hygiene visit',
              duration: 30,
              completed: true,
            },
          ],
        })
      },
    })
    const items = await readDentallyTreatmentPlanItems({ patientId: 'p-1', treatmentPlanId: 'tp-1', treatmentAppointmentId: 'ta-1' })
    expect(items.ok).toBe(true)
    expect(captured).toContain('/v1/treatment_plan_items?')
    expect(captured).toContain('patient_id=p-1')
    expect(captured).toContain('treatment_plan_id=tp-1')
    expect(captured).toContain('treatment_appointment_id=ta-1')
    if (items.ok) {
      expect(items.data).toHaveLength(2)
      expect(items.data[0].nomenclature).toBe('UR6 MOD composite')
      expect(items.data[0].durationMinutes).toBe(30)
      expect(items.data[0].patientNomenclature).toBe('White filling, upper right back tooth')
      expect(items.data[1].completed).toBe(true)
    }
  })

  it('reads a single treatment plan item by id', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ treatment_plan_item: { id: 'tpi-9', nomenclature: 'Root canal LL6' } }),
    })
    const result = await readDentallyTreatmentPlanItem('tpi-9')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.nomenclature).toBe('Root canal LL6')
  })

  it('rejects an empty treatment plan item id without hitting the network', async () => {
    let calls = 0
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => { calls += 1; return jsonResponse({}) },
    })
    const result = await readDentallyTreatmentPlanItem('   ')
    expect(result.ok).toBe(false)
    expect(calls).toBe(0)
  })

  it('returns malformed when the list response has the wrong shape', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ wrong: 'shape' }),
    })
    const result = await readDentallyTreatmentPlanItems({ patientId: 'p-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.category).toBe('malformed')
  })
})

describe('financial flags', () => {
  it('summarises outstanding balance and restriction states safely', () => {
    const flags = summariseFinancialFlags([
      { id: 'acc-1', balance: 25, state: 'active' },
      { id: 'acc-2', accountBalance: 15, state: 'restricted' },
    ])
    expect(flags.hasOutstandingBalance).toBe(true)
    expect(flags.restricted).toBe(true)
    expect(flags.reviewReason).toContain('restriction')
  })

  it('reads patient accounts and returns a review flag', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ accounts: [{ id: 'acc-1', patient_id: 'p-1', balance: 40 }] }),
    })

    const result = await readFinancialAccountFlagForPatient('p-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.hasOutstandingBalance).toBe(true)
  })
})

describe('safe combined patient context', () => {
  it('returns complete context when all reads succeed', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/patients/p-1') return jsonResponse({ patient: { id: 'p-1', name: 'Graeme Anderson' } })
        if (path === '/v1/appointments') return jsonResponse({ appointments: [{ id: 'a-1', patient_id: 'p-1' }] })
        if (path === '/v1/treatment_appointments') {
          return jsonResponse({ treatment_appointments: [{ id: 'ta-1', patient_id: 'p-1', bookable: true, completed: false }] })
        }
        if (path === '/v1/treatment_plans') return jsonResponse({ treatment_plans: [{ id: 'tp-1', patient_id: 'p-1' }] })
        if (path === '/v1/treatment_plan_items') {
          return jsonResponse({ treatment_plan_items: [{ id: 'tpi-1', patient_id: 'p-1', treatment_plan_id: 'tp-1', nomenclature: 'UR6 MOD composite', duration: 30 }] })
        }
        if (path === '/v1/accounts') return jsonResponse({ accounts: [{ id: 'acc-1', patient_id: 'p-1', balance: 0 }] })
        return jsonResponse({}, 404)
      },
    })

    const result = await readSafePatientContext('p-1', { siteId: 's-1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.readiness).toBe('complete')
      expect(result.data.unbookedTreatmentAppointments).toHaveLength(1)
      expect(result.data.treatmentPlanItems).toHaveLength(1)
      expect(result.data.treatmentPlanItems[0].nomenclature).toBe('UR6 MOD composite')
      expect(result.data.warnings).toHaveLength(0)
    }
  })

  it('returns partial context when non-critical reads fail', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/patients/p-1') return jsonResponse({ patient: { id: 'p-1', name: 'Graeme Anderson' } })
        return jsonResponse({}, 500)
      },
    })

    const result = await readSafePatientContext('p-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.readiness).toBe('partial')
      expect(result.data.warnings.length).toBeGreaterThan(0)
      expect(result.data.financial.reviewReason).toContain('unavailable')
    }
  })
})

describe('readiness service', () => {
  it('aggregates health, user, practice, sites, and GK Hawick mapping without exposing the token', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/user') return jsonResponse({ user: { id: 'u-1', name: 'Hamza Abrar', email: 'h@example.test' } })
        if (path === '/v1/practice') return jsonResponse({ practice: { id: 'pr-1', name: 'Saint Visage Dental Group' } })
        if (path === '/v1/sites') {
          return jsonResponse({
            sites: [
              { id: '8e0f35a8-a7b1-4fe7-8c85-780505eeb2ce', name: 'GK Hawick', postcode: 'TD9 9EE' },
              { id: 'rollout-2', name: 'Rollout Candidate' },
            ],
          })
        }
        return jsonResponse({}, 404)
      },
    })

    const result = await getDentallyReadinessReport(actor({ role: 'super_admin' }))
    expect(result.status).toBe('connected')
    expect(result.visibleSiteCount).toBe(2)
    expect(result.mappedSiteCount).toBe(1)
    expect(result.rolloutCandidateCount).toBe(1)
    expect(JSON.stringify(result)).not.toContain(TEST_TOKEN)
  })

  it('degrades, rather than setup-blocking, when Dentally works but some accessible clinics are unmapped', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async input => {
        const path = pathFromInput(input)
        if (path === '/v1/user') return jsonResponse({ user: { id: 'u-1', email: 'manager@example.test' } })
        if (path === '/v1/practice') return jsonResponse({ practice: { id: 'pr-1', name: 'The Dental Practice' } })
        if (path === '/v1/sites') {
          return jsonResponse({
            sites: [
              { id: '8e0f35a8-a7b1-4fe7-8c85-780505eeb2ce', name: 'GK Hawick', postcode: 'TD9 9EE' },
            ],
          })
        }
        return jsonResponse({}, 404)
      },
    })

    const result = await getDentallyReadinessReport(actor({
      role: 'group_owner',
      clinicIds: ['clinic-1', 'clinic-2'],
    }))

    expect(result.status).toBe('degraded')
    expect(result.mappedSiteCount).toBe(1)
    expect(result.warnings).toContain('One or more accessible clinics is not mapped to a Dentally site.')
  })

  it('reports setup_required without calling user/practice/sites when env is missing', async () => {
    let calls = 0
    __setDentallyTransport({
      env: () => ({ configured: false }),
      fetch: async () => {
        calls += 1
        return jsonResponse({})
      },
    })

    const result = await getDentallyReadinessReport(actor())
    expect(result.status).toBe('setup_required')
    expect(calls).toBe(0)
  })
})

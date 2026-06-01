/**
 * P07–P08 · S032–S040 — Dentally data contracts and read-proof sign-off.
 */

import { describe, expect, it } from 'vitest'
import {
  DENTALLY_ENDPOINT_TRUTH,
  DENTALLY_READ_METHOD,
  assertReadOnlyEndpointRegistry,
  getEndpointTruth,
} from '@/lib/dentally/endpoints'
import {
  mapConfirmedPatientToIdentityContract,
  mapPatientMatchToIdentityLookup,
  verificationHintsFromPatient,
} from '@/lib/dentally/contracts/identity'
import { mapSafePatientContextToQueueCard } from '@/lib/dentally/contracts/queue-card'
import { mapSafePatientContextToApprovalCard } from '@/lib/dentally/contracts/approval-card'
import {
  deriveRecallSegments,
  mapSafePatientContextToRecallRecovery,
} from '@/lib/dentally/contracts/recall-recovery'
import {
  DEGRADED_STATE_COVERAGE,
  resolveIntegrationBanner,
} from '@/lib/dentally/contracts/integration-states'
import {
  buildReadProofSignoffArtifact,
  isReadProofSignoffComplete,
  proveGetOnlyClientExports,
} from '@/lib/dentally/contracts/read-proof-signoff'
import type { DentallyPatient, SafePatientContext } from '@/lib/dentally/types'

const samplePatient: DentallyPatient = {
  id: 'p-1',
  firstName: 'Graeme',
  lastName: 'Anderson',
  fullName: 'Graeme Anderson',
  dateOfBirth: '1980-01-01',
  postcode: 'TD9 9EE',
  mobile: '07700900123',
  siteId: 'site-1',
}

const sampleContext: SafePatientContext = {
  patient: samplePatient,
  appointments: [
    {
      id: 'a-1',
      patientId: 'p-1',
      startTime: '2030-06-01T09:00:00Z',
      state: 'booked',
    },
  ],
  treatmentAppointments: [],
  unbookedTreatmentAppointments: [{ id: 'ta-1', patientId: 'p-1', bookable: true, completed: false }],
  treatmentPlans: [{ id: 'tp-1', patientId: 'p-1', completed: false }],
  treatmentPlanItems: [],
  financial: {
    accountIds: ['acct-1'],
    hasAccountData: true,
    hasOutstandingBalance: true,
    outstandingBalance: 120,
    creditBalance: false,
    restricted: false,
  },
  readiness: 'complete',
  warnings: [],
}

describe('S032 endpoint truth registry', () => {
  it('documents every foundation read with GET-only method', () => {
    const proof = assertReadOnlyEndpointRegistry()
    expect(proof.ok).toBe(true)
    expect(proof.count).toBeGreaterThanOrEqual(10)
    expect(DENTALLY_ENDPOINT_TRUTH.every(entry => entry.method === DENTALLY_READ_METHOD)).toBe(true)
  })

  it('links patient reads to identity and queue contracts', () => {
    const patients = getEndpointTruth('patients')
    expect(patients?.consumers).toContain('identity')
    expect(patients?.requiredScope).toBe('patient:read')
  })
})

describe('S033 identity contract', () => {
  it('maps confirmed match without storing full name in contract fields', () => {
    const lookup = mapPatientMatchToIdentityLookup({
      state: 'confirmed',
      patient: samplePatient,
      candidates: [samplePatient],
    })
    expect(lookup.matchState).toBe('confirmed')
    expect(lookup.displayInitials).toBe('GA')
    expect(lookup.verificationHints.hasDateOfBirth).toBe(true)

    const confirmed = mapConfirmedPatientToIdentityContract(samplePatient)
    expect(confirmed.dentallyPatientId).toBe('p-1')
    expect(confirmed.displayInitials).toBe('GA')
    expect(JSON.stringify(confirmed)).not.toContain('Graeme')
  })

  it('maps multiple-match state for human review', () => {
    const lookup = mapPatientMatchToIdentityLookup({
      state: 'multiple',
      candidates: [samplePatient, { ...samplePatient, id: 'p-2' }],
      reason: 'Multiple matches',
    })
    expect(lookup.matchState).toBe('multiple')
    expect(lookup.candidateCount).toBe(2)
    expect(verificationHintsFromPatient(samplePatient).hasMobile).toBe(true)
  })
})

describe('S034 queue-card contract', () => {
  it('maps safe patient context to counts and flags only', () => {
    const card = mapSafePatientContextToQueueCard(sampleContext)
    expect(card.dentallyPatientId).toBe('p-1')
    expect(card.upcomingAppointmentCount).toBe(1)
    expect(card.unbookedTreatmentCount).toBe(1)
    expect(card.hasOutstandingBalance).toBe(true)
    expect(card.linkState).toBe('linked')
    expect(JSON.stringify(card)).not.toContain('Graeme')
  })
})

describe('S035 approval-card contract', () => {
  it('blocks context when financial restriction applies', () => {
    const blocked = mapSafePatientContextToApprovalCard({
      ...sampleContext,
      financial: { ...sampleContext.financial, restricted: true, reviewReason: 'Restricted' },
    })
    expect(blocked.contextState).toBe('blocked')
    expect(blocked.ruleReviewRequired).toBe(true)
    expect(blocked.nextAppointment?.appointmentId).toBe('a-1')
  })
})

describe('S036 recall/recovery contract', () => {
  it('derives recovery segments from read-only context', () => {
    const segments = deriveRecallSegments(sampleContext)
    expect(segments).toContain('unbooked_treatment')
    expect(segments).toContain('open_treatment_plan')

    const recall = mapSafePatientContextToRecallRecovery(sampleContext)
    expect(recall.segments.length).toBeGreaterThan(0)
    expect(recall.humanReviewRequired).toBe(true)
  })

  it('requires human review when financial gate triggers', () => {
    const recall = mapSafePatientContextToRecallRecovery({
      ...sampleContext,
      financial: { ...sampleContext.financial, restricted: true },
    })
    expect(recall.segments).toContain('financial_review_gate')
    expect(recall.humanReviewRequired).toBe(true)
  })
})

describe('S037 degraded integration states', () => {
  it('covers all staff-visible banner states', () => {
    expect(DEGRADED_STATE_COVERAGE).toEqual([
      'connected',
      'degraded',
      'unavailable',
      'setup_required',
      'human_only',
    ])
  })

  it('escalates to human-only when forced', () => {
    const banner = resolveIntegrationBanner({
      healthStatus: 'connected',
      readinessStatus: 'connected',
      forceHumanOnly: true,
    })
    expect(banner.state).toBe('human_only')
    expect(banner.allowBookingPreparation).toBe(false)
  })

  it('prefers unavailable over degraded health', () => {
    const banner = resolveIntegrationBanner({
      healthStatus: 'unavailable',
      readinessStatus: 'degraded',
    })
    expect(banner.state).toBe('unavailable')
    expect(banner.showDentallyLinkPanel).toBe(false)
  })
})

describe('S038–S040 read-proof sign-off artifact', () => {
  it('proves GET-only client exports', () => {
    const proof = proveGetOnlyClientExports()
    expect(proof.getOnlyClient).toBe(true)
    expect(proof.writeHelpersExported).toBe(false)
  })

  it('builds complete sign-off when rotation and live probe evidence exist', () => {
    const artifact = buildReadProofSignoffArtifact({
      rotationEvidence: {
        rotationRecorded: true,
        rotationAt: '2026-05-01T00:00:00Z',
        rotationBy: 'Practice owner (confirmed pre-build)',
      },
      liveProbe: {
        configured: true,
        healthStatus: 'connected',
        userEndpointReachable: true,
        durationMs: 165,
        apiHost: 'api.dentally.co',
      },
    })
    expect(isReadProofSignoffComplete(artifact)).toBe(true)
    expect(artifact.roleGatedIntegrationsPage.route).toBe('/integrations')
    expect(artifact).not.toHaveProperty('authorization')
    expect(Object.keys(artifact)).not.toContain('apiToken')
  })
})

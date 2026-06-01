/**
 * Dentally read-only endpoint constants.
 *
 * Live discovery with the available read-only token showed these are the
 * correct foundation endpoints for Phase 2:
 *
 *   - /v1/user
 *   - /v1/practice
 *   - /v1/sites
 *
 * Do not scatter Dentally URL strings across the codebase. Add new endpoints
 * here first, then consume the constant from the relevant reader.
 */

export const DENTALLY_ENDPOINTS = {
  currentUser: '/v1/user',
  practice: '/v1/practice',
  sites: '/v1/sites',
  siteById: (siteId: string) => `/v1/sites/${encodeURIComponent(siteId)}`,
  patients: '/v1/patients',
  patientById: (patientId: string) => `/v1/patients/${encodeURIComponent(patientId)}`,
  patientStats: (patientId: string) => `/v1/patients/${encodeURIComponent(patientId)}/stats`,
  accounts: '/v1/accounts',
  appointments: '/v1/appointments',
  treatmentAppointments: '/v1/treatment_appointments',
  treatmentAppointmentById: (treatmentAppointmentId: string) =>
    `/v1/treatment_appointments/${encodeURIComponent(treatmentAppointmentId)}`,
  treatmentPlans: '/v1/treatment_plans',
  treatmentPlanById: (treatmentPlanId: string) =>
    `/v1/treatment_plans/${encodeURIComponent(treatmentPlanId)}`,
  treatmentPlanItems: '/v1/treatment_plan_items',
  treatmentPlanItemById: (treatmentPlanItemId: string) =>
    `/v1/treatment_plan_items/${encodeURIComponent(treatmentPlanItemId)}`,
} as const

/** Read-only HTTP method enforced for every registry entry. */
export const DENTALLY_READ_METHOD = 'GET' as const

/**
 * Endpoint truth registry — S032.
 *
 * Single documentation source for which Dentally paths DentalAI may call,
 * which token scope each read requires, and which downstream contracts consume
 * the parsed fields. Every path must exist in DENTALLY_ENDPOINTS first.
 */
export type DentallyEndpointConsumer =
  | 'integration_health'
  | 'identity'
  | 'queue_card'
  | 'approval_card'
  | 'recall_recovery'

export type DentallyEndpointTruthEntry = {
  /** Stable registry id — matches DENTALLY_ENDPOINTS key where possible. */
  id: string
  /** Example path (parameterised routes show a placeholder segment). */
  examplePath: string
  method: typeof DENTALLY_READ_METHOD
  requiredScope: string
  purpose: string
  consumers: DentallyEndpointConsumer[]
}

export const DENTALLY_ENDPOINT_TRUTH: readonly DentallyEndpointTruthEntry[] = [
  {
    id: 'currentUser',
    examplePath: DENTALLY_ENDPOINTS.currentUser,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'user:read',
    purpose: 'Token health probe and integration readiness without patient data.',
    consumers: ['integration_health'],
  },
  {
    id: 'practice',
    examplePath: DENTALLY_ENDPOINTS.practice,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'practice:read',
    purpose: 'Practice identity and timezone for clinic mapping checks.',
    consumers: ['integration_health'],
  },
  {
    id: 'sites',
    examplePath: DENTALLY_ENDPOINTS.sites,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'practice:read',
    purpose: 'Rollout-unit list for DentalAI ↔ Dentally site binding.',
    consumers: ['integration_health', 'queue_card', 'approval_card'],
  },
  {
    id: 'siteById',
    examplePath: '/v1/sites/{siteId}',
    method: DENTALLY_READ_METHOD,
    requiredScope: 'practice:read',
    purpose: 'Single-site detail when a mapped clinic needs confirmation.',
    consumers: ['integration_health'],
  },
  {
    id: 'patients',
    examplePath: DENTALLY_ENDPOINTS.patients,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'patient:read',
    purpose: 'Patient search for identity verification — never treated as proof on its own.',
    consumers: ['identity', 'queue_card'],
  },
  {
    id: 'patientById',
    examplePath: '/v1/patients/{patientId}',
    method: DENTALLY_READ_METHOD,
    requiredScope: 'patient:read',
    purpose: 'Confirmed patient identity fields after human verification.',
    consumers: ['identity', 'queue_card', 'approval_card', 'recall_recovery'],
  },
  {
    id: 'patientStats',
    examplePath: '/v1/patients/{patientId}/stats',
    method: DENTALLY_READ_METHOD,
    requiredScope: 'patient:read',
    purpose: 'Optional recall segmentation signals (last visit / recall timing).',
    consumers: ['recall_recovery'],
  },
  {
    id: 'accounts',
    examplePath: DENTALLY_ENDPOINTS.accounts,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'financials:read',
    purpose: 'Outstanding balance and restriction flags — no raw ledger export.',
    consumers: ['queue_card', 'approval_card', 'recall_recovery'],
  },
  {
    id: 'appointments',
    examplePath: DENTALLY_ENDPOINTS.appointments,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'appointment:read',
    purpose: 'Future and past appointments for queue context and recall gaps.',
    consumers: ['queue_card', 'approval_card', 'recall_recovery'],
  },
  {
    id: 'treatmentAppointments',
    examplePath: DENTALLY_ENDPOINTS.treatmentAppointments,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'treatments',
    purpose: 'Unbooked treatment appointments for recovery and approval context.',
    consumers: ['queue_card', 'approval_card', 'recall_recovery'],
  },
  {
    id: 'treatmentPlans',
    examplePath: DENTALLY_ENDPOINTS.treatmentPlans,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'treatments',
    purpose: 'Open treatment plans for treatment-not-booked recall segments.',
    consumers: ['approval_card', 'recall_recovery'],
  },
  {
    id: 'treatmentPlanItems',
    examplePath: DENTALLY_ENDPOINTS.treatmentPlanItems,
    method: DENTALLY_READ_METHOD,
    requiredScope: 'treatments',
    purpose: 'Line-item treatment detail for approval review and recovery priority.',
    consumers: ['approval_card', 'recall_recovery'],
  },
] as const

/** Lookup endpoint truth by registry id. */
export function getEndpointTruth(id: string): DentallyEndpointTruthEntry | undefined {
  return DENTALLY_ENDPOINT_TRUTH.find(entry => entry.id === id)
}

/** Every registered path must stay GET-only. */
export function assertReadOnlyEndpointRegistry(): { ok: true; count: number } {
  const invalid = DENTALLY_ENDPOINT_TRUTH.filter(entry => entry.method !== DENTALLY_READ_METHOD)
  if (invalid.length > 0) {
    throw new Error(`Dentally endpoint registry contains non-GET entries: ${invalid.map(e => e.id).join(', ')}`)
  }
  return { ok: true, count: DENTALLY_ENDPOINT_TRUTH.length }
}

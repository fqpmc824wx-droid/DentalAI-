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

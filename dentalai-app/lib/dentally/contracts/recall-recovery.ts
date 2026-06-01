/**
 * S036 — Dentally → recall and recovery contract.
 *
 * Derives recovery segment hints from read-only Dentally context. Outreach
 * and booking preparation still require human approval — this contract only
 * surfaces prioritisation signals.
 */

import type {
  DentallyAppointment,
  DentallyTreatmentAppointment,
  DentallyTreatmentPlan,
  FinancialAccountFlag,
  SafePatientContext,
} from '@/lib/dentally/types'

export type RecallRecoverySegment =
  | 'overdue_exam_gap'
  | 'unbooked_treatment'
  | 'open_treatment_plan'
  | 'no_upcoming_appointment'
  | 'financial_review_gate'

export type RecallRecoveryContract = {
  dentallyPatientId: string
  dentallySiteId?: string
  segments: RecallRecoverySegment[]
  unbookedTreatmentCount: number
  openTreatmentPlanCount: number
  upcomingAppointmentCount: number
  humanReviewRequired: boolean
  reviewReasons: string[]
}

function countUpcoming(appointments: DentallyAppointment[]): number {
  const now = Date.now()
  return appointments.filter(a => a.startTime && Date.parse(a.startTime) >= now).length
}

function openPlans(plans: DentallyTreatmentPlan[]): number {
  return plans.filter(plan => !plan.completed).length
}

function unbookedCount(items: DentallyTreatmentAppointment[]): number {
  return items.filter(item => (item.bookable ?? false) && !(item.completed ?? false)).length
}

export function deriveRecallSegments(input: {
  appointments: DentallyAppointment[]
  treatmentAppointments: DentallyTreatmentAppointment[]
  unbookedTreatmentAppointments: DentallyTreatmentAppointment[]
  treatmentPlans: DentallyTreatmentPlan[]
  financial: FinancialAccountFlag
}): RecallRecoverySegment[] {
  const segments: RecallRecoverySegment[] = []
  const upcoming = countUpcoming(input.appointments)

  if (upcoming === 0) segments.push('no_upcoming_appointment')
  if (unbookedCount(input.unbookedTreatmentAppointments) > 0) segments.push('unbooked_treatment')
  if (openPlans(input.treatmentPlans) > 0) segments.push('open_treatment_plan')
  if (input.financial.restricted || input.financial.hasOutstandingBalance) {
    segments.push('financial_review_gate')
  }
  if (upcoming === 0 && input.appointments.length > 0) {
    segments.push('overdue_exam_gap')
  }

  return segments
}

export function mapSafePatientContextToRecallRecovery(context: SafePatientContext): RecallRecoveryContract {
  const segments = deriveRecallSegments(context)
  const reviewReasons: string[] = []
  if (context.financial.reviewReason) reviewReasons.push(context.financial.reviewReason)
  if (context.warnings.length > 0) reviewReasons.push(...context.warnings)

  return {
    dentallyPatientId: context.patient.id,
    dentallySiteId: context.patient.siteId,
    segments,
    unbookedTreatmentCount: unbookedCount(context.unbookedTreatmentAppointments),
    openTreatmentPlanCount: openPlans(context.treatmentPlans),
    upcomingAppointmentCount: countUpcoming(context.appointments),
    humanReviewRequired: segments.includes('financial_review_gate') || context.readiness === 'partial',
    reviewReasons,
  }
}

export const RECALL_RECOVERY_DENTALLY_FIELD_MAP = {
  'appointments[]': 'upcomingAppointmentCount, overdue_exam_gap, no_upcoming_appointment',
  'unbookedTreatmentAppointments[]': 'unbooked_treatment segment',
  'treatmentPlans[]': 'open_treatment_plan segment',
  'financial.*': 'financial_review_gate segment',
} as const

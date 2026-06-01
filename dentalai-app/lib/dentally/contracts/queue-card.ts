/**
 * S034 — Dentally → queue-card contract.
 *
 * Maps safe patient context reads into the Dentally link panel a queue card
 * may render. Counts and flags only — no patient names, DOBs, or balances.
 */

import type {
  DentallyAppointment,
  DentallyTreatmentAppointment,
  FinancialAccountFlag,
  SafePatientContext,
} from '@/lib/dentally/types'

export type QueueCardDentallyLinkState = 'linked' | 'partial' | 'unavailable'

export type QueueCardDentallyContract = {
  dentallyPatientId: string
  dentallySiteId?: string
  linkState: QueueCardDentallyLinkState
  upcomingAppointmentCount: number
  unbookedTreatmentCount: number
  openTreatmentPlanCount: number
  hasOutstandingBalance: boolean
  restrictedAccount: boolean
  financialReviewRequired: boolean
  warnings: string[]
}

function countUpcomingAppointments(appointments: DentallyAppointment[]): number {
  const now = Date.now()
  return appointments.filter(appointment => {
    if (!appointment.startTime) return false
    const start = Date.parse(appointment.startTime)
    return Number.isFinite(start) && start >= now
  }).length
}

export function mapFinancialFlagsToQueueCard(financial: FinancialAccountFlag): Pick<
  QueueCardDentallyContract,
  'hasOutstandingBalance' | 'restrictedAccount' | 'financialReviewRequired'
> {
  return {
    hasOutstandingBalance: financial.hasOutstandingBalance,
    restrictedAccount: financial.restricted,
    financialReviewRequired: financial.restricted || financial.hasOutstandingBalance,
  }
}

export function mapTreatmentAppointmentsToQueueCard(
  treatmentAppointments: DentallyTreatmentAppointment[],
  unbooked: DentallyTreatmentAppointment[],
): Pick<QueueCardDentallyContract, 'unbookedTreatmentCount'> {
  return {
    unbookedTreatmentCount: unbooked.length > 0 ? unbooked.length : treatmentAppointments.filter(t => t.bookable && !t.completed).length,
  }
}

export function mapSafePatientContextToQueueCard(context: SafePatientContext): QueueCardDentallyContract {
  const financial = mapFinancialFlagsToQueueCard(context.financial)
  const treatment = mapTreatmentAppointmentsToQueueCard(
    context.treatmentAppointments,
    context.unbookedTreatmentAppointments,
  )

  return {
    dentallyPatientId: context.patient.id,
    dentallySiteId: context.patient.siteId,
    linkState: context.readiness === 'complete' ? 'linked' : 'partial',
    upcomingAppointmentCount: countUpcomingAppointments(context.appointments),
    unbookedTreatmentCount: treatment.unbookedTreatmentCount,
    openTreatmentPlanCount: context.treatmentPlans.filter(plan => !plan.completed).length,
    ...financial,
    warnings: context.warnings,
  }
}

export const QUEUE_CARD_DENTALLY_FIELD_MAP = {
  'patient.id': 'dentallyPatientId',
  'patient.siteId': 'dentallySiteId',
  'appointments[]': 'upcomingAppointmentCount',
  'unbookedTreatmentAppointments[]': 'unbookedTreatmentCount',
  'treatmentPlans[] (open)': 'openTreatmentPlanCount',
  'financial.hasOutstandingBalance': 'hasOutstandingBalance',
  'financial.restricted': 'restrictedAccount',
  'financial.reviewReason': 'financialReviewRequired (derived)',
} as const

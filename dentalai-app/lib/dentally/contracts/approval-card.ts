/**
 * S035 — Dentally → approval-card contract.
 *
 * Maps safe patient context into the Dentally sections an approval card may
 * show before a human approves a diary change. Still read-only — no writes.
 */

import type { DentallyAppointment, SafePatientContext } from '@/lib/dentally/types'
import type { QueueCardDentallyContract } from './queue-card'
import { mapSafePatientContextToQueueCard } from './queue-card'

export type ApprovalCardDentallyContextState = 'ready' | 'partial' | 'blocked'

export type ApprovalCardAppointmentSummary = {
  appointmentId: string
  startTime?: string
  state?: string
  reason?: string
}

export type ApprovalCardTreatmentSummary = {
  treatmentAppointmentId: string
  bookable: boolean
  completed: boolean
  treatmentPlanId?: string
}

export type ApprovalCardDentallyContract = QueueCardDentallyContract & {
  contextState: ApprovalCardDentallyContextState
  nextAppointment?: ApprovalCardAppointmentSummary
  unbookedTreatments: ApprovalCardTreatmentSummary[]
  ruleReviewRequired: boolean
}

function nextAppointment(appointments: DentallyAppointment[]): ApprovalCardAppointmentSummary | undefined {
  const upcoming = appointments
    .filter(a => a.startTime && Number.isFinite(Date.parse(a.startTime)))
    .sort((a, b) => Date.parse(a.startTime!) - Date.parse(b.startTime!))
  const next = upcoming.find(a => Date.parse(a.startTime!) >= Date.now()) ?? upcoming[0]
  if (!next) return undefined
  return {
    appointmentId: next.id,
    startTime: next.startTime,
    state: next.state,
    reason: next.reason,
  }
}

export function mapSafePatientContextToApprovalCard(context: SafePatientContext): ApprovalCardDentallyContract {
  const queueLink = mapSafePatientContextToQueueCard(context)
  const blocked = context.financial.restricted
  const partial = context.readiness === 'partial' || context.warnings.length > 0

  return {
    ...queueLink,
    contextState: blocked ? 'blocked' : partial ? 'partial' : 'ready',
    nextAppointment: nextAppointment(context.appointments),
    unbookedTreatments: context.unbookedTreatmentAppointments.map(item => ({
      treatmentAppointmentId: item.id,
      bookable: item.bookable ?? false,
      completed: item.completed ?? false,
      treatmentPlanId: item.treatmentPlanId,
    })),
    ruleReviewRequired: blocked || queueLink.financialReviewRequired,
  }
}

export const APPROVAL_CARD_DENTALLY_FIELD_MAP = {
  ...{
    'patient.id': 'dentallyPatientId',
    'appointments[] (next)': 'nextAppointment',
    'unbookedTreatmentAppointments[]': 'unbookedTreatments',
    'financial.restricted': 'contextState blocked',
    'financial.reviewReason': 'ruleReviewRequired',
  },
} as const

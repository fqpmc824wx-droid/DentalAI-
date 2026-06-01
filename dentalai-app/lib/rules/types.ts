/**
 * Booking Rules Engine — types
 * Pure decision function. No AI, no Dentally.
 */

import type { MockPatient } from '@/lib/mock/patients'
import type { CallerMatchState } from '@/lib/mock/patients'

export type AppointmentTypeId =
  | 'new_patient_consult'
  | 'routine_checkup'
  | 'hygiene'
  | 'emergency'
  | 'implant_consult'
  | 'invisalign_consult'
  | 'whitening_consult'

export type AppointmentType = {
  id: AppointmentTypeId
  name: string
  durationMins: number
  isNHSCompatible: boolean
  isPrivateOnly: boolean
  requiresProvider: 'dentist' | 'hygienist' | 'tco'  // tco = treatment coordinator
  emergencySafe: boolean
  notes?: string
}

export type ClinicBookingRules = {
  clinicId: string
  // Hard gates — system MUST block if violated
  blockOnUnpaidBalance: boolean
  blockOnRepeatedFTA: boolean       // ≥2 FTAs in 12 months
  blockOnLapsedNeedsFullAssessment: boolean
  // Soft gates — system flags for human review
  reviewOnFirstNHSBooking: boolean
  reviewOnComplexTreatment: boolean
  reviewOnUncertainIdentity: boolean
  // Limits
  emergencyDailyCapPerProvider: number
  outOfHoursAcceptsEmergency: boolean
}

export type RuleDecision = 'allow' | 'review' | 'block'

export type RuleEvaluation = {
  decision: RuleDecision
  reasons: string[]              // ordered: severity high → low
  triggered: string[]            // rule IDs that fired
  appointmentType: AppointmentType | null
  recommendedAction: string
}

export type BookingRequestInput = {
  callerState: CallerMatchState
  patient: MockPatient | null
  appointmentTypeId: AppointmentTypeId
  notes?: string
}

/**
 * Booking Rules Engine — pure decision function.
 *
 * Input:  caller identity state + appointment type + patient flags + clinic config
 * Output: allow / review / block + reasons
 *
 * No AI. No Dentally. No side effects.
 * Phase 5: this engine receives input from the AI's intent detection.
 */

import type {
  BookingRequestInput,
  RuleEvaluation,
} from './types'
import { getAppointmentType, getClinicRules } from './config'
import type { CallerMatchState } from '@/lib/mock/patients'

const MS_PER_DAY = 1000 * 60 * 60 * 24

function monthsSince(dateStr: string | null): number {
  if (!dateStr) return Infinity
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  return (now - then) / MS_PER_DAY / 30
}

const IDENTITY_BLOCKS_BOOKING: CallerMatchState[] = ['withheld', 'no_match']
const IDENTITY_REVIEWS_BOOKING: CallerMatchState[] = ['multiple', 'family_number', 'uncertain']

export function evaluateBookingRequest(
  input: BookingRequestInput,
  clinicId: string,
): RuleEvaluation {
  const reasons: string[] = []
  const triggered: string[] = []
  let decision: 'allow' | 'review' | 'block' = 'allow'

  const apptType = getAppointmentType(input.appointmentTypeId)
  const rules = getClinicRules(clinicId)

  // ── Sanity gates ──
  if (!apptType) {
    return {
      decision: 'block',
      reasons: ['Unknown appointment type'],
      triggered: ['SANITY_UNKNOWN_APPT_TYPE'],
      appointmentType: null,
      recommendedAction: 'Configuration error — log and escalate to admin',
    }
  }

  if (!rules) {
    return {
      decision: 'block',
      reasons: ['Clinic has no booking rules configured'],
      triggered: ['SANITY_NO_CLINIC_RULES'],
      appointmentType: apptType,
      recommendedAction: 'Configuration error — clinic not set up for booking',
    }
  }

  // ── Identity gates (BR-2 Identity before detail) ──
  if (IDENTITY_BLOCKS_BOOKING.includes(input.callerState)) {
    decision = 'review'
    reasons.push(
      input.callerState === 'withheld'
        ? 'Caller withheld their number — identity must be verified manually'
        : 'Caller not in Dentally — new patient details must be captured first',
    )
    triggered.push('IDENTITY_NO_MATCH')
  }

  if (IDENTITY_REVIEWS_BOOKING.includes(input.callerState) && rules.reviewOnUncertainIdentity) {
    decision = decision === 'allow' ? 'review' : decision
    reasons.push(
      input.callerState === 'family_number'
        ? 'Shared family number — confirm which family member is calling'
        : input.callerState === 'multiple'
        ? 'Multiple patients share this number — verify before revealing detail'
        : 'Caller identity uncertain — verify before booking',
    )
    triggered.push('IDENTITY_UNCERTAIN')
  }

  // ── Patient-specific gates (only if we have a confirmed patient) ──
  if (input.patient) {
    const p = input.patient

    // Unpaid balance
    if (rules.blockOnUnpaidBalance && p.outstandingBalance > 0) {
      decision = 'review'
      reasons.push(`Outstanding balance of £${p.outstandingBalance} — flag for payment before booking`)
      triggered.push('BALANCE_OUTSTANDING')
    }

    // FTA history
    if (rules.blockOnRepeatedFTA && p.isFTA) {
      decision = 'review'
      reasons.push('Patient has a recent FTA flag — practice manager should approve')
      triggered.push('FTA_FLAGGED')
    }

    // Lapsed patient — may need full assessment instead of routine
    if (
      rules.blockOnLapsedNeedsFullAssessment &&
      p.isLapsed &&
      input.appointmentTypeId === 'routine_checkup'
    ) {
      decision = 'review'
      reasons.push(
        `Patient is lapsed (${Math.round(monthsSince(p.lastAppointment))} months since last visit) — needs full assessment rather than routine checkup`,
      )
      triggered.push('LAPSED_NEEDS_ASSESSMENT')
    }

    // NHS vs Private compatibility
    if (apptType.isPrivateOnly && !p.isPrivate) {
      decision = 'review'
      reasons.push(`${apptType.name} is private-only — patient is currently NHS, confirm willingness to pay`)
      triggered.push('NHS_PRIVATE_MISMATCH')
    }
  }

  // ── Complex treatment gate ──
  if (
    rules.reviewOnComplexTreatment &&
    ['implant_consult', 'invisalign_consult'].includes(input.appointmentTypeId)
  ) {
    decision = decision === 'allow' ? 'review' : decision
    reasons.push('Complex treatment enquiry — TCO should review before booking')
    triggered.push('COMPLEX_TREATMENT_REVIEW')
  }

  // ── First NHS booking gate (per-clinic optional) ──
  if (
    rules.reviewOnFirstNHSBooking &&
    apptType.isNHSCompatible &&
    input.patient &&
    !input.patient.isPrivate &&
    !input.patient.lastAppointment
  ) {
    decision = decision === 'allow' ? 'review' : decision
    reasons.push('First NHS booking — confirm eligibility and entitlements')
    triggered.push('FIRST_NHS_BOOKING')
  }

  // ── Final disposition ──
  let recommendedAction: string
  if (decision === 'review') {
    recommendedAction =
      'Prepare booking request — staff must approve before confirming to patient.'
  } else {
    recommendedAction = 'Booking can be prepared. Staff still confirms before Dentally write.'
    if (reasons.length === 0) reasons.push('All checks passed.')
  }

  return {
    decision,
    reasons,
    triggered,
    appointmentType: apptType,
    recommendedAction,
  }
}

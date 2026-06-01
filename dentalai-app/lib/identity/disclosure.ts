import type { CallerRole, IdentityScenarioState } from './types'

/** S050 — third-party callers cannot receive patient-specific disclosure. */
export function thirdPartyDisclosureBlocked(callerRole: CallerRole): boolean {
  return callerRole === 'third_party'
}

/** Topics that must never be disclosed to third parties or before verification. */
export type DisclosureTopic =
  | 'appointment_exists'
  | 'appointment_datetime'
  | 'appointment_clinician'
  | 'clinical_purpose'
  | 'balance'
  | 'treatment_plan'

const BLOCKED_BEFORE_VERIFY: DisclosureTopic[] = [
  'appointment_exists',
  'appointment_datetime',
  'appointment_clinician',
  'clinical_purpose',
  'balance',
  'treatment_plan',
]

/**
 * S050 / planning S1-E — whether staff/AI may disclose a topic.
 */
export function canDiscloseTopic(input: {
  topic: DisclosureTopic
  verified: boolean
  callerRole: CallerRole
  scenario: IdentityScenarioState
}): boolean {
  if (thirdPartyDisclosureBlocked(input.callerRole)) return false
  if (input.scenario === 'failed_verification' || input.scenario === 'withheld') return false
  if (!input.verified && BLOCKED_BEFORE_VERIFY.includes(input.topic)) return false
  if (input.scenario === 'child_guardian' && input.callerRole === 'parent_or_guardian') {
    return input.verified && input.topic !== 'clinical_purpose'
  }
  return input.verified || input.topic === 'appointment_exists'
}

/** S049 — child calls may require parent/guardian context for booking changes. */
export function resolveChildGuardianScenario(isMinor: boolean, callerRole: CallerRole): IdentityScenarioState | null {
  if (!isMinor) return null
  if (callerRole === 'parent_or_guardian') return 'child_guardian'
  if (callerRole === 'patient') return 'child_guardian'
  return 'child_guardian'
}

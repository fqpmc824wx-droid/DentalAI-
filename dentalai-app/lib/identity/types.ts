/**
 * P09–P10 caller identity scenario types (S041–S057).
 *
 * Caller ID is a lookup hint only — never identity proof.
 */

/** How the inbound phone number itself is classified before lookup. */
export type CallerNumberKind =
  | 'uk_present'
  | 'withheld'
  | 'blocked'
  | 'unknown'
  | 'international'

/** Canonical identity scenario after lookup + verification policy. */
export type IdentityScenarioState =
  | 'confirmed'
  | 'probable'
  | 'multiple_match'
  | 'no_match'
  | 'new_patient'
  | 'withheld'
  | 'borrowed_phone'
  | 'shared_household'
  | 'failed_verification'
  | 'third_party'
  | 'child_guardian'

export type CallerRole = 'patient' | 'parent_or_guardian' | 'third_party' | 'staff' | 'unknown'

export type VerificationMethod = 'name_and_dob' | 'postcode_fallback' | 'repeat_back'

export type VerificationOutcome = 'verified' | 'failed' | 'needs_repeat_back' | 'exhausted'

export type IdentitySession = {
  scenario: IdentityScenarioState
  callerNumberKind: CallerNumberKind
  callerRole: CallerRole
  verificationAttempts: number
  verified: boolean
  requiresHumanReview: boolean
  /** Caller ID used for lookup — never treated as proof. */
  lookupHintOnly: true
  callbackNumber?: string
  candidatePatientIds: string[]
  sensitiveTopicRequiresReverification: boolean
}

export type FailedVerificationAuditEntry = {
  action: 'identity.verification_failed'
  attemptNumber: number
  method: VerificationMethod
  /** Deliberately omits raw name/DOB/postcode answers. */
  candidateCount: number
  clinicId: string
}

import type { IdentitySession } from './types'

/**
 * S052 — identity-safe audit payloads (no patient names, DOB, phone, or answers).
 */
export function identitySessionAuditPayload(session: IdentitySession, clinicId: string) {
  return {
    action: 'identity.session_snapshot',
    clinicId,
    scenario: session.scenario,
    callerNumberKind: session.callerNumberKind,
    callerRole: session.callerRole,
    verified: session.verified,
    verificationAttempts: session.verificationAttempts,
    requiresHumanReview: session.requiresHumanReview,
    candidateCount: session.candidatePatientIds.length,
    lookupHintOnly: true,
    hasCallbackNumber: Boolean(session.callbackNumber),
  }
}

/** Guard: audit JSON must not contain PII field names with values. */
export function assertIdentityAuditPayloadSafe(payload: Record<string, unknown>): void {
  const forbiddenKeys = ['firstName', 'lastName', 'dob', 'dateOfBirth', 'phone', 'mobile', 'postcode', 'email', 'patientName']
  for (const key of forbiddenKeys) {
    if (key in payload) {
      throw new Error(`Identity audit payload must not include ${key}`)
    }
  }
}

import type {
  FailedVerificationAuditEntry,
  VerificationMethod,
  VerificationOutcome,
} from './types'

export const MAX_VERIFICATION_ATTEMPTS = 2

export type VerificationCandidate = {
  id: string
  firstName: string
  lastName: string
  dob: string
  postcode?: string
}

export type VerificationInput = {
  firstName: string
  lastName: string
  dateOfBirth: string
  postcode?: string
}

function normaliseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normaliseDob(value: string): string {
  return value.trim()
}

function normalisePostcode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ')
}

function matchesCandidate(input: VerificationInput, candidate: VerificationCandidate): boolean {
  const nameOk =
    normaliseName(input.firstName) === normaliseName(candidate.firstName) &&
    normaliseName(input.lastName) === normaliseName(candidate.lastName)
  const dobOk = normaliseDob(input.dateOfBirth) === normaliseDob(candidate.dob)
  return nameOk && dobOk
}

/**
 * S048 / S051 / S054 — verify by name + DOB; postcode fallback only when required.
 */
export function verifyAgainstCandidates(
  input: VerificationInput,
  candidates: VerificationCandidate[],
  options?: { requirePostcode?: boolean; lowConfidence?: boolean },
): { outcome: VerificationOutcome; matchedId?: string; method: VerificationMethod } {
  if (candidates.length === 0) {
    return { outcome: 'failed', method: 'name_and_dob' }
  }

  const direct = candidates.find(c => matchesCandidate(input, c))
  if (direct) {
    if (options?.lowConfidence) {
      return { outcome: 'needs_repeat_back', matchedId: direct.id, method: 'repeat_back' }
    }
    return { outcome: 'verified', matchedId: direct.id, method: 'name_and_dob' }
  }

  if (options?.requirePostcode && input.postcode) {
    const postcodeMatch = candidates.find(c => {
      if (!c.postcode) return false
      return (
        normalisePostcode(input.postcode!) === normalisePostcode(c.postcode) &&
        normaliseDob(input.dateOfBirth) === normaliseDob(c.dob)
      )
    })
    if (postcodeMatch) {
      return { outcome: 'verified', matchedId: postcodeMatch.id, method: 'postcode_fallback' }
    }
  }

  return { outcome: 'failed', method: options?.requirePostcode ? 'postcode_fallback' : 'name_and_dob' }
}

/**
 * S056 — log failed verification without storing raw answers.
 */
export function buildFailedVerificationAudit(
  attemptNumber: number,
  method: VerificationMethod,
  candidateCount: number,
  clinicId: string,
): FailedVerificationAuditEntry {
  return {
    action: 'identity.verification_failed',
    attemptNumber,
    method,
    candidateCount,
    clinicId,
  }
}

/**
 * S048 — track attempts; exhausted after MAX_VERIFICATION_ATTEMPTS failures.
 */
export function nextVerificationAttempt(
  currentAttempts: number,
  lastOutcome: VerificationOutcome,
): { attempts: number; exhausted: boolean } {
  if (lastOutcome === 'verified' || lastOutcome === 'needs_repeat_back') {
    return { attempts: currentAttempts, exhausted: false }
  }
  const attempts = currentAttempts + 1
  return { attempts, exhausted: attempts >= MAX_VERIFICATION_ATTEMPTS }
}

/** S055 — sensitive topics require reverification even after prior success. */
export function requiresMidCallReverification(
  verified: boolean,
  topicSensitivity: 'routine' | 'clinical' | 'financial' | 'safeguarding',
): boolean {
  if (!verified) return true
  return topicSensitivity !== 'routine'
}

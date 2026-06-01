import type { CallerLookupResult, CallerMatchState } from '@/lib/mock/patients'
import { classifyCallerNumber } from './caller-number'
import type { CallerNumberKind, CallerRole, IdentityScenarioState, IdentitySession } from './types'

/** S057 — exported constant for tests and UI copy. */
export const CALLER_ID_IS_LOOKUP_HINT_ONLY = true as const

function mapLookupState(state: CallerMatchState): IdentityScenarioState {
  switch (state) {
    case 'confirmed':
      return 'confirmed'
    case 'uncertain':
      return 'probable'
    case 'multiple':
      return 'multiple_match'
    case 'family_number':
      return 'shared_household'
    case 'no_match':
      return 'no_match'
    case 'withheld':
      return 'withheld'
    default:
      return 'no_match'
  }
}

/** S046 — borrowed/work phone when callback differs from presenting number. */
export function detectBorrowedPhone(
  presentingNumber: string,
  callbackNumber?: string,
): boolean {
  if (!callbackNumber?.trim()) return false
  const a = classifyCallerNumber(presentingNumber)
  const b = classifyCallerNumber(callbackNumber)
  if (!a.normalisedUk || !b.normalisedUk) return Boolean(callbackNumber.trim())
  return a.normalisedUk !== b.normalisedUk
}

export function buildIdentitySession(input: {
  rawCallerNumber: string
  lookup: CallerLookupResult
  callerRole?: CallerRole
  callbackNumber?: string
  verified?: boolean
  verificationAttempts?: number
}): IdentitySession {
  const caller = classifyCallerNumber(input.rawCallerNumber)
  let scenario: IdentityScenarioState

  if (caller.kind === 'withheld' || caller.kind === 'blocked') {
    scenario = 'withheld'
  } else if (caller.kind === 'international' || caller.kind === 'unknown') {
    scenario = input.lookup.state === 'no_match' ? 'new_patient' : mapLookupState(input.lookup.state)
  } else if (detectBorrowedPhone(input.rawCallerNumber, input.callbackNumber)) {
    scenario = 'borrowed_phone'
  } else if (input.callerRole === 'third_party') {
    scenario = 'third_party'
  } else {
    scenario =
      input.lookup.state === 'no_match' && caller.kind === 'uk_present'
        ? 'new_patient'
        : mapLookupState(input.lookup.state)
  }

  const requiresHumanReview =
    input.lookup.requiresHumanReview ||
    scenario === 'borrowed_phone' ||
    scenario === 'third_party' ||
    scenario === 'probable' ||
    scenario === 'multiple_match' ||
    scenario === 'shared_household' ||
    scenario === 'new_patient' ||
    scenario === 'withheld' ||
    (input.verificationAttempts ?? 0) >= 2

  if ((input.verificationAttempts ?? 0) >= 2 && !input.verified) {
    scenario = 'failed_verification'
  }

  return {
    scenario,
    callerNumberKind: caller.kind,
    callerRole: input.callerRole ?? 'unknown',
    verificationAttempts: input.verificationAttempts ?? 0,
    verified: input.verified ?? false,
    requiresHumanReview,
    lookupHintOnly: CALLER_ID_IS_LOOKUP_HINT_ONLY,
    callbackNumber: input.callbackNumber,
    candidatePatientIds: input.lookup.matches.map(m => m.id),
    sensitiveTopicRequiresReverification: !(input.verified ?? false),
  }
}

export function callerNumberKindLabel(kind: CallerNumberKind): string {
  switch (kind) {
    case 'uk_present':
      return 'UK number present'
    case 'withheld':
      return 'Withheld'
    case 'blocked':
      return 'Blocked'
    case 'unknown':
      return 'Unknown format'
    case 'international':
      return 'International'
  }
}

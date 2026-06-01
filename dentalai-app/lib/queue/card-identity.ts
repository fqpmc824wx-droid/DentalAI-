/**
 * S091 — Queue card identity badge and patient detail (S3-B · B-2).
 *
 * Maps identity scenario state to the locked badge set and builds the
 * patient detail panel staff see on every queue card.
 */

import type { IdentityScenarioState } from '@/lib/identity/types'

export type QueueIdentityBadge =
  | 'confirmed'
  | 'probable'
  | 'multiple_match'
  | 'no_match'
  | 'withheld'
  | 'failed'
  | 'unverified'

export type PatientFundingStatus = 'nhs' | 'private' | 'unknown'

export type QueueCardPatientDetail = {
  badge: QueueIdentityBadge
  badgeLabel: string
  fullName?: string
  dob?: string
  phone?: string
  preferredCallbackNumber?: string
  fundingStatus: PatientFundingStatus
  showPatientIdentifiers: boolean
}

const BADGE_LABELS: Record<QueueIdentityBadge, string> = {
  confirmed: 'Confirmed',
  probable: 'Probable match',
  multiple_match: 'Multiple match',
  no_match: 'No match',
  withheld: 'Withheld number',
  failed: 'Identity failed',
  unverified: 'Unverified',
}

/** Locked badge mapping from canonical identity scenario. */
export function mapScenarioToIdentityBadge(input: {
  scenario: IdentityScenarioState
  verified: boolean
}): QueueIdentityBadge {
  if (input.scenario === 'failed_verification') return 'failed'
  if (input.scenario === 'withheld') return 'withheld'
  if (input.scenario === 'multiple_match' || input.scenario === 'shared_household') {
    return 'multiple_match'
  }
  if (input.scenario === 'no_match' || input.scenario === 'new_patient') return 'no_match'
  if (input.scenario === 'confirmed' && input.verified) return 'confirmed'
  if (input.scenario === 'probable') return 'probable'
  if (input.scenario === 'child_guardian' && input.verified) return 'confirmed'
  return 'unverified'
}

function mayShowPatientName(input: {
  badge: QueueIdentityBadge
  verified: boolean
}): boolean {
  if (input.badge === 'confirmed') return true
  if (input.badge === 'probable' && input.verified) return true
  return false
}

export function buildQueueCardPatientDetail(input: {
  scenario: IdentityScenarioState
  verified: boolean
  callerPhone: string
  callbackNumber?: string
  patient?: {
    firstName: string
    lastName: string
    dob: string
    isPrivate: boolean
    nhsNumber?: string
  } | null
}): QueueCardPatientDetail {
  const badge = mapScenarioToIdentityBadge({
    scenario: input.scenario,
    verified: input.verified,
  })
  const showPatientIdentifiers = mayShowPatientName({ badge, verified: input.verified })

  let fundingStatus: PatientFundingStatus = 'unknown'
  if (input.patient) {
    fundingStatus = input.patient.isPrivate ? 'private' : 'nhs'
  }

  return {
    badge,
    badgeLabel: BADGE_LABELS[badge],
    fullName:
      showPatientIdentifiers && input.patient
        ? `${input.patient.firstName} ${input.patient.lastName}`.trim()
        : undefined,
    dob: showPatientIdentifiers ? input.patient?.dob : undefined,
    phone: input.callerPhone || undefined,
    preferredCallbackNumber: input.callbackNumber?.trim() || input.callerPhone || undefined,
    fundingStatus,
    showPatientIdentifiers,
  }
}

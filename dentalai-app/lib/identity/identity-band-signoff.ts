/**
 * S041–S057 — Formal identity + caller authorisation band sign-off artifact.
 *
 * Code-side builder only — no tokens, raw verification answers, or patient PII.
 */

import { CALLER_ID_IS_LOOKUP_HINT_ONLY } from './scenarios'
import { IDENTITY_SCRIPTS } from './scripts'
import { MAX_VERIFICATION_ATTEMPTS } from './verification'

export const IDENTITY_BAND_SLICES = [
  'S041',
  'S042',
  'S043',
  'S044',
  'S045',
  'S046',
  'S047',
  'S048',
  'S049',
  'S050',
  'S051',
  'S052',
  'S053',
  'S054',
  'S055',
  'S056',
  'S057',
] as const

export type IdentityBandSignoffArtifact = {
  kind: 'identity_band_signoff'
  signedOffAt: string
  slices: typeof IDENTITY_BAND_SLICES
  scenarioStates: string[]
  callerNumberKinds: string[]
  verificationPolicy: {
    primaryMethod: 'name_and_dob'
    maxAttempts: number
    callerIdIsProof: false
    lookupHintOnly: true
  }
  disclosureTopicsBlockedBeforeVerify: string[]
  lockedScripts: string[]
  auditSafeFields: string[]
}

export function buildIdentityBandSignoffArtifact(
  signedOffAt: string = new Date().toISOString(),
): IdentityBandSignoffArtifact {
  return {
    kind: 'identity_band_signoff',
    signedOffAt,
    slices: IDENTITY_BAND_SLICES,
    scenarioStates: [
      'confirmed',
      'probable',
      'multiple_match',
      'no_match',
      'new_patient',
      'withheld',
      'borrowed_phone',
      'shared_household',
      'failed_verification',
      'third_party',
      'child_guardian',
    ],
    callerNumberKinds: ['uk_present', 'withheld', 'blocked', 'unknown', 'international'],
    verificationPolicy: {
      primaryMethod: 'name_and_dob',
      maxAttempts: MAX_VERIFICATION_ATTEMPTS,
      callerIdIsProof: false,
      lookupHintOnly: CALLER_ID_IS_LOOKUP_HINT_ONLY,
    },
    disclosureTopicsBlockedBeforeVerify: [
      'appointment_exists',
      'appointment_datetime',
      'appointment_clinician',
      'clinical_purpose',
      'balance',
      'treatment_plan',
    ],
    lockedScripts: Object.keys(IDENTITY_SCRIPTS),
    auditSafeFields: [
      'scenario',
      'callerNumberKind',
      'callerRole',
      'verified',
      'verificationAttempts',
      'requiresHumanReview',
      'candidateCount',
      'lookupHintOnly',
    ],
  }
}

export function isIdentityBandSignoffComplete(artifact: IdentityBandSignoffArtifact): boolean {
  return (
    artifact.kind === 'identity_band_signoff' &&
    artifact.slices.length === IDENTITY_BAND_SLICES.length &&
    artifact.verificationPolicy.callerIdIsProof === false &&
    artifact.verificationPolicy.lookupHintOnly === true
  )
}

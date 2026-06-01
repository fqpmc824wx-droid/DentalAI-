/**
 * S033 — Dentally → identity verification contract.
 *
 * Maps parsed Dentally patient reads into the fields identity workflows may
 * use for lookup hints and post-verification display. Caller ID is never
 * included here — it is not a Dentally field and never counts as proof.
 */

import type { DentallyPatient, PatientMatchState } from '@/lib/dentally/types'

export type IdentityVerificationHints = {
  hasDateOfBirth: boolean
  hasPostcode: boolean
  hasPhone: boolean
  hasMobile: boolean
  hasEmail: boolean
}

/** Safe identity contract before a human confirms the patient match. */
export type IdentityLookupContract = {
  dentallyPatientId?: string
  dentallySiteId?: string
  matchState: PatientMatchState['state']
  candidateCount: number
  verificationHints: IdentityVerificationHints
  /** Initials only — never full name before verification completes. */
  displayInitials?: string
}

/** Fields allowed after staff confirm identity (still no audit-log names). */
export type IdentityConfirmedContract = {
  dentallyPatientId: string
  dentallySiteId?: string
  verificationHints: IdentityVerificationHints
  displayInitials: string
}

function initialsFromPatient(patient: DentallyPatient): string | undefined {
  const first = patient.firstName?.trim()?.[0]
  const last = patient.lastName?.trim()?.[0]
  if (first && last) return `${first}${last}`.toUpperCase()
  const fromFull = patient.fullName?.trim().split(/\s+/).filter(Boolean)
  if (fromFull && fromFull.length >= 2) {
    return `${fromFull[0][0]}${fromFull[fromFull.length - 1][0]}`.toUpperCase()
  }
  return first?.toUpperCase() ?? last?.toUpperCase()
}

export function verificationHintsFromPatient(patient: DentallyPatient): IdentityVerificationHints {
  return {
    hasDateOfBirth: Boolean(patient.dateOfBirth?.trim()),
    hasPostcode: Boolean(patient.postcode?.trim()),
    hasPhone: Boolean(patient.phone?.trim()),
    hasMobile: Boolean(patient.mobile?.trim()),
    hasEmail: Boolean(patient.email?.trim()),
  }
}

export function mapPatientMatchToIdentityLookup(match: PatientMatchState): IdentityLookupContract {
  const primary =
    match.state === 'confirmed'
      ? match.patient
      : match.candidates[0]

  return {
    dentallyPatientId: match.state === 'confirmed' ? match.patient.id : primary?.id,
    dentallySiteId: primary?.siteId,
    matchState: match.state,
    candidateCount: match.candidates.length,
    verificationHints: primary ? verificationHintsFromPatient(primary) : {
      hasDateOfBirth: false,
      hasPostcode: false,
      hasPhone: false,
      hasMobile: false,
      hasEmail: false,
    },
    displayInitials: primary ? initialsFromPatient(primary) : undefined,
  }
}

export function mapConfirmedPatientToIdentityContract(patient: DentallyPatient): IdentityConfirmedContract {
  return {
    dentallyPatientId: patient.id,
    dentallySiteId: patient.siteId,
    verificationHints: verificationHintsFromPatient(patient),
    displayInitials: initialsFromPatient(patient) ?? '?',
  }
}

/** Registry of Dentally patient fields consumed by the identity contract. */
export const IDENTITY_DENTALLY_FIELD_MAP = {
  id: 'dentallyPatientId',
  siteId: 'dentallySiteId',
  dateOfBirth: 'verificationHints.hasDateOfBirth',
  postcode: 'verificationHints.hasPostcode',
  phone: 'verificationHints.hasPhone',
  mobile: 'verificationHints.hasMobile',
  email: 'verificationHints.hasEmail',
  firstName: 'displayInitials (derived, not stored in queue)',
  lastName: 'displayInitials (derived, not stored in queue)',
  fullName: 'displayInitials (derived, not stored in queue)',
} as const

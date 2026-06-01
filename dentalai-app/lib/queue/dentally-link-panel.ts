/**
 * S094 — Dentally link and data quality panel (S3-B · B-5).
 */

import { buildDentallyPatientRecordUrl } from '@/lib/dentally/record-url'
import type { QueueCardDentallyContract } from '@/lib/dentally/contracts/queue-card'
import type { CallerMatchState, MockPatient } from '@/lib/mock/patients'
import type { QueueIdentityBadge } from './card-identity'

export type RecordQualityIssueCode =
  | 'missing_phone'
  | 'duplicate_dob'
  | 'mismatched_name'
  | 'missing_mobile'
  | 'shared_number'

export type RecordQualityIssue = {
  code: RecordQualityIssueCode
  message: string
}

export type DentallyLinkPanelAction =
  | { kind: 'open_record'; label: string; href: string; external: true }
  | { kind: 'create_record'; label: string; reason: string }

export type DentallyLinkPanel = {
  visible: boolean
  linkState: 'linked' | 'partial' | 'create_required' | 'hidden'
  primaryAction?: DentallyLinkPanelAction
  contract?: Pick<
    QueueCardDentallyContract,
    | 'upcomingAppointmentCount'
    | 'unbookedTreatmentCount'
    | 'openTreatmentPlanCount'
    | 'hasOutstandingBalance'
    | 'restrictedAccount'
    | 'financialReviewRequired'
    | 'warnings'
  >
  recordQualityIssues: RecordQualityIssue[]
  integrationNote?: string
}

/** Mock bridge until live SafePatientContext is wired on queue detail. */
export function mockDentallyContractFromPatient(patient: MockPatient): QueueCardDentallyContract {
  return {
    dentallyPatientId: `dentally-${patient.id}`,
    dentallySiteId: patient.clinicId === 'clinic-1' ? 'site-hawick' : undefined,
    linkState: 'linked',
    upcomingAppointmentCount: patient.nextAppointment ? 1 : 0,
    unbookedTreatmentCount: patient.isLapsed ? 1 : 0,
    openTreatmentPlanCount: patient.isLapsed ? 1 : 0,
    hasOutstandingBalance: patient.outstandingBalance > 0,
    restrictedAccount: false,
    financialReviewRequired: patient.outstandingBalance > 120,
    warnings: [
      ...(patient.isFTA ? ['FTA history on record'] : []),
      ...(patient.isLapsed ? ['Lapsed patient — review outreach context'] : []),
    ],
  }
}

export function detectRecordQualityIssues(input: {
  patient: MockPatient | null
  callerState: CallerMatchState
  identityBadge: QueueIdentityBadge
}): RecordQualityIssue[] {
  const issues: RecordQualityIssue[] = []

  if (input.callerState === 'family_number' || input.identityBadge === 'multiple_match') {
    issues.push({
      code: 'shared_number',
      message: 'Shared or ambiguous number — confirm patient identity before opening the record.',
    })
  }
  if (input.callerState === 'multiple' || input.identityBadge === 'multiple_match') {
    issues.push({
      code: 'mismatched_name',
      message: 'Multiple patients match this number — resolve identity before using Dentally data.',
    })
  }

  if (!input.patient) {
    if (input.identityBadge === 'no_match' || input.callerState === 'no_match') {
      issues.push({
        code: 'missing_mobile',
        message: 'No Dentally match — capture phone and DOB when creating the record.',
      })
    }
    return issues
  }

  if (!input.patient.phone?.trim()) {
    issues.push({ code: 'missing_phone', message: 'Primary phone missing on the patient record.' })
  }
  if (!input.patient.altPhone?.trim() && input.callerState === 'uncertain') {
    issues.push({
      code: 'missing_mobile',
      message: 'No alternate contact on file — verify callback number with the patient.',
    })
  }
  if (input.callerState === 'family_number') {
    issues.push({
      code: 'duplicate_dob',
      message: 'Family line — confirm date of birth matches the patient you are opening.',
    })
  }

  return issues
}

export function buildDentallyLinkPanel(input: {
  showPanel: boolean
  identityBadge: QueueIdentityBadge
  callerState: CallerMatchState
  patient: MockPatient | null
  contract?: QueueCardDentallyContract | null
  appBaseUrl?: string
  integrationNote?: string
}): DentallyLinkPanel {
  if (!input.showPanel) {
    return { visible: false, linkState: 'hidden', recordQualityIssues: [] }
  }

  const recordQualityIssues = detectRecordQualityIssues({
    patient: input.patient,
    callerState: input.callerState,
    identityBadge: input.identityBadge,
  })

  const needsCreate =
    !input.patient &&
    (input.identityBadge === 'no_match' ||
      input.callerState === 'no_match' ||
      input.identityBadge === 'unverified')

  if (needsCreate) {
    return {
      visible: true,
      linkState: 'create_required',
      primaryAction: {
        kind: 'create_record',
        label: 'Create Dentally record',
        reason: 'No matched patient — create the record in Dentally before booking or clinical notes.',
      },
      recordQualityIssues,
      integrationNote: input.integrationNote,
    }
  }

  if (!input.patient) {
    return {
      visible: true,
      linkState: 'partial',
      recordQualityIssues,
      integrationNote: input.integrationNote ?? 'Patient match pending — Dentally link unlocks after identity is confirmed.',
    }
  }

  const contract = input.contract ?? mockDentallyContractFromPatient(input.patient)
  const href = buildDentallyPatientRecordUrl(contract.dentallyPatientId, input.appBaseUrl)

  return {
    visible: true,
    linkState: contract.linkState === 'unavailable' ? 'partial' : contract.linkState,
    primaryAction: {
      kind: 'open_record',
      label: 'Open Dentally record',
      href,
      external: true,
    },
    contract: {
      upcomingAppointmentCount: contract.upcomingAppointmentCount,
      unbookedTreatmentCount: contract.unbookedTreatmentCount,
      openTreatmentPlanCount: contract.openTreatmentPlanCount,
      hasOutstandingBalance: contract.hasOutstandingBalance,
      restrictedAccount: contract.restrictedAccount,
      financialReviewRequired: contract.financialReviewRequired,
      warnings: contract.warnings,
    },
    recordQualityIssues,
    integrationNote: input.integrationNote,
  }
}

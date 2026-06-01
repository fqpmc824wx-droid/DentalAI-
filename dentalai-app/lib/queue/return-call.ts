/**
 * S098 — One-tap return call (S3-D · D-7).
 *
 * Patient called back closes the loop immediately without the full outcome form.
 */

import type { QueueItem } from './types'
import { isTerminalQueueStatus } from './types'
import { isCallbackTrackableType } from './callback-tracker'

export type PatientCalledBackEligibility = {
  allowed: boolean
  errors: string[]
  closureLabel: string
  auditSummary: string
}

export const PATIENT_CALLED_BACK_LABEL = 'Patient called back — handled'

export function evaluatePatientCalledBackEligibility(item: QueueItem): PatientCalledBackEligibility {
  if (!isCallbackTrackableType(item.type)) {
    return {
      allowed: false,
      errors: ['This item type does not support one-tap return call closure'],
      closureLabel: PATIENT_CALLED_BACK_LABEL,
      auditSummary: '',
    }
  }

  if (isTerminalQueueStatus(item.status)) {
    return {
      allowed: false,
      errors: ['This item is already closed'],
      closureLabel: PATIENT_CALLED_BACK_LABEL,
      auditSummary: '',
    }
  }

  return {
    allowed: true,
    errors: [],
    closureLabel: PATIENT_CALLED_BACK_LABEL,
    auditSummary: `${PATIENT_CALLED_BACK_LABEL}: ${item.title}`,
  }
}

/** D-7 — skip mandatory outcome form and notes gate for inbound return-call closure. */
export function bypassesFullOutcomeForm(): true {
  return true
}

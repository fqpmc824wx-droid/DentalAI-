/**
 * S087 — Locked queue item taxonomy (S3-A · A-1 through A-8).
 *
 * Replaces the narrow mock type list with the full product-book taxonomy.
 * Legacy QueueItemType values map into these categories for migration.
 */

import type { QueueItemType } from './types'

export type QueueTaxonomyCategoryId =
  | 'booking_appointment'
  | 'new_patient'
  | 'callback_followup'
  | 'revenue_recovery'
  | 'financial'
  | 'clinical_routing'
  | 'sensitive_complex'
  | 'system_operational'

export type QueueTaxonomySubtype = {
  id: string
  label: string
  categoryId: QueueTaxonomyCategoryId
  productBookRef: string
}

export type QueueTaxonomyCategory = {
  id: QueueTaxonomyCategoryId
  label: string
  productBookRef: string
  subtypes: QueueTaxonomySubtype[]
}

/** Full taxonomy registry — verbatim coverage of A-1..A-8 subtypes from product book. */
export const QUEUE_TAXONOMY: QueueTaxonomyCategory[] = [
  {
    id: 'booking_appointment',
    label: 'Booking and appointment',
    productBookRef: 'A-1',
    subtypes: [
      { id: 'new_booking', label: 'New booking request', categoryId: 'booking_appointment', productBookRef: 'A-1' },
      { id: 'reschedule', label: 'Reschedule request', categoryId: 'booking_appointment', productBookRef: 'A-1' },
      { id: 'cancellation', label: 'Cancellation', categoryId: 'booking_appointment', productBookRef: 'A-1' },
      { id: 'cancellation_rebook', label: 'Cancellation with rebook intent', categoryId: 'booking_appointment', productBookRef: 'A-1' },
      { id: 'running_late', label: 'Running late', categoryId: 'booking_appointment', productBookRef: 'A-1' },
      { id: 'appointment_query', label: 'Appointment query', categoryId: 'booking_appointment', productBookRef: 'A-1' },
    ],
  },
  {
    id: 'new_patient',
    label: 'New patient',
    productBookRef: 'A-2',
    subtypes: [
      { id: 'new_patient_enquiry', label: 'New patient enquiry', categoryId: 'new_patient', productBookRef: 'A-2' },
      { id: 'new_patient_nhs', label: 'New patient NHS query', categoryId: 'new_patient', productBookRef: 'A-2' },
    ],
  },
  {
    id: 'callback_followup',
    label: 'Callback and follow-up',
    productBookRef: 'A-3',
    subtypes: [
      { id: 'callback_request', label: 'Callback request', categoryId: 'callback_followup', productBookRef: 'A-3' },
      { id: 'failed_identity_callback', label: 'Failed identity callback', categoryId: 'callback_followup', productBookRef: 'A-3' },
      { id: 'out_of_hours_callback', label: 'Out-of-hours callback', categoryId: 'callback_followup', productBookRef: 'A-3' },
      { id: 'missed_call_callback', label: 'Missed call callback', categoryId: 'callback_followup', productBookRef: 'A-3' },
    ],
  },
  {
    id: 'revenue_recovery',
    label: 'Revenue recovery',
    productBookRef: 'A-4',
    subtypes: [
      { id: 'lapsed_recall', label: 'Lapsed patient recall', categoryId: 'revenue_recovery', productBookRef: 'A-4' },
      { id: 'fta_followup', label: 'FTA follow-up', categoryId: 'revenue_recovery', productBookRef: 'A-4' },
      { id: 'treatment_plan_followup', label: 'Treatment plan follow-up', categoryId: 'revenue_recovery', productBookRef: 'A-4' },
      { id: 'unbooked_treatment', label: 'Unbooked treatment appointment', categoryId: 'revenue_recovery', productBookRef: 'A-4' },
      { id: 'cancellation_recovery', label: 'Cancellation recovery', categoryId: 'revenue_recovery', productBookRef: 'A-4' },
      { id: 'private_lead_cold', label: 'Private lead gone cold', categoryId: 'revenue_recovery', productBookRef: 'A-4' },
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    productBookRef: 'A-5',
    subtypes: [
      { id: 'balance_followup', label: 'Balance follow-up', categoryId: 'financial', productBookRef: 'A-5' },
      { id: 'payment_query', label: 'Payment query', categoryId: 'financial', productBookRef: 'A-5' },
    ],
  },
  {
    id: 'clinical_routing',
    label: 'Clinical routing',
    productBookRef: 'A-6',
    subtypes: [
      { id: 'emergency_urgent_pain', label: 'Emergency or urgent pain', categoryId: 'clinical_routing', productBookRef: 'A-6' },
      { id: 'medical_query', label: 'Medical query', categoryId: 'clinical_routing', productBookRef: 'A-6' },
      { id: 'prescription_referral', label: 'Prescription or referral query', categoryId: 'clinical_routing', productBookRef: 'A-6' },
    ],
  },
  {
    id: 'sensitive_complex',
    label: 'Sensitive and complex',
    productBookRef: 'A-7',
    subtypes: [
      { id: 'complaint', label: 'Complaint', categoryId: 'sensitive_complex', productBookRef: 'A-7' },
      { id: 'deceased_notification', label: 'Deceased patient notification', categoryId: 'sensitive_complex', productBookRef: 'A-7' },
      { id: 'safeguarding', label: 'Safeguarding concern', categoryId: 'sensitive_complex', productBookRef: 'A-7' },
      { id: 'billing_dispute', label: 'Billing dispute', categoryId: 'sensitive_complex', productBookRef: 'A-7' },
      { id: 'subject_access_request', label: 'Subject Access Request', categoryId: 'sensitive_complex', productBookRef: 'A-7' },
      { id: 'right_to_erasure', label: 'Right to erasure', categoryId: 'sensitive_complex', productBookRef: 'A-7' },
      { id: 'communication_opt_out', label: 'Communication opt-out', categoryId: 'sensitive_complex', productBookRef: 'A-7' },
    ],
  },
  {
    id: 'system_operational',
    label: 'System and operational',
    productBookRef: 'A-8',
    subtypes: [
      { id: 'system_error', label: 'System error', categoryId: 'system_operational', productBookRef: 'A-8' },
      { id: 'low_confidence_review', label: 'Low confidence review', categoryId: 'system_operational', productBookRef: 'A-8' },
      { id: 'duplicate_caller_escalation', label: 'Duplicate caller escalation', categoryId: 'system_operational', productBookRef: 'A-8' },
      { id: 'language_barrier', label: 'Language barrier', categoryId: 'system_operational', productBookRef: 'A-8' },
      { id: 'dentally_write_failure', label: 'Dentally write failure', categoryId: 'system_operational', productBookRef: 'A-8' },
    ],
  },
]

const subtypeById = new Map<string, QueueTaxonomySubtype>()
for (const category of QUEUE_TAXONOMY) {
  for (const subtype of category.subtypes) {
    subtypeById.set(subtype.id, subtype)
  }
}

export function getTaxonomyCategory(id: QueueTaxonomyCategoryId): QueueTaxonomyCategory | undefined {
  return QUEUE_TAXONOMY.find(c => c.id === id)
}

export function getTaxonomySubtype(id: string): QueueTaxonomySubtype | undefined {
  return subtypeById.get(id)
}

/** Bridge mock queue types to locked taxonomy subtypes (migration helper). */
export const LEGACY_QUEUE_TYPE_TO_SUBTYPE: Record<QueueItemType, string> = {
  booking_request: 'new_booking',
  emergency: 'emergency_urgent_pain',
  callback: 'callback_request',
  identity_review: 'failed_identity_callback',
  payment_recovery: 'balance_followup',
  fta_followup: 'fta_followup',
  recall: 'lapsed_recall',
  cancellation: 'cancellation',
  running_late: 'running_late',
  complaint: 'complaint',
}

export function mapLegacyQueueType(type: QueueItemType): QueueTaxonomySubtype {
  const subtypeId = LEGACY_QUEUE_TYPE_TO_SUBTYPE[type]
  return subtypeById.get(subtypeId) ?? QUEUE_TAXONOMY[0].subtypes[0]
}

export function assertFullTaxonomyCoverage(): { ok: boolean; categoryCount: number; subtypeCount: number } {
  const subtypeCount = QUEUE_TAXONOMY.reduce((n, c) => n + c.subtypes.length, 0)
  return {
    ok: QUEUE_TAXONOMY.length === 8 && subtypeCount >= 30,
    categoryCount: QUEUE_TAXONOMY.length,
    subtypeCount,
  }
}

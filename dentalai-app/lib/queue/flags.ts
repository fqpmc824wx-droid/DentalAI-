/**
 * S090 — Queue flags (S3-C · C-3 through C-7).
 */

export type QueueFlagColour = 'red' | 'amber' | 'teal' | 'blue' | 'grey'

export type QueueFlagId =
  | 'emergency_urgent_pain'
  | 'complaint'
  | 'safeguarding'
  | 'deceased_notification'
  | 'identity_failed'
  | 'system_error'
  | 'dentally_write_failed'
  | 'anxiety'
  | 'duplicate_caller'
  | 'outstanding_balance'
  | 'fta_history'
  | 'multiple_dentally_match'
  | 'low_confidence'
  | 'treatment_plan_outstanding'
  | 'unbooked_treatment'
  | 'private_lead'
  | 'nhs_patient'
  | 'private_patient'
  | 'child_patient'
  | 'parent_guardian_calling'
  | 'language_barrier'
  | 'withheld_number'
  | 'borrowed_phone'
  | 'no_dentally_match'
  | 'opt_out'
  | 'dentally_record_quality'

export type QueueFlagDefinition = {
  id: QueueFlagId
  label: string
  colour: QueueFlagColour
  productBookRef: string
}

export const QUEUE_FLAGS: QueueFlagDefinition[] = [
  { id: 'emergency_urgent_pain', label: 'Emergency or urgent pain', colour: 'red', productBookRef: 'C-3' },
  { id: 'complaint', label: 'Complaint', colour: 'red', productBookRef: 'C-3' },
  { id: 'safeguarding', label: 'Safeguarding concern', colour: 'red', productBookRef: 'C-3' },
  { id: 'deceased_notification', label: 'Deceased notification', colour: 'red', productBookRef: 'C-3' },
  { id: 'identity_failed', label: 'Identity failed', colour: 'red', productBookRef: 'C-3' },
  { id: 'system_error', label: 'System error', colour: 'red', productBookRef: 'C-3' },
  { id: 'dentally_write_failed', label: 'Dentally write failed', colour: 'red', productBookRef: 'C-3' },
  { id: 'anxiety', label: 'Anxiety', colour: 'amber', productBookRef: 'C-4' },
  { id: 'duplicate_caller', label: 'Duplicate caller', colour: 'amber', productBookRef: 'C-4' },
  { id: 'outstanding_balance', label: 'Outstanding balance', colour: 'amber', productBookRef: 'C-4' },
  { id: 'fta_history', label: 'FTA history', colour: 'amber', productBookRef: 'C-4' },
  { id: 'multiple_dentally_match', label: 'Multiple Dentally match', colour: 'amber', productBookRef: 'C-4' },
  { id: 'low_confidence', label: 'Low confidence', colour: 'amber', productBookRef: 'C-4' },
  { id: 'treatment_plan_outstanding', label: 'Treatment plan outstanding', colour: 'teal', productBookRef: 'C-5' },
  { id: 'unbooked_treatment', label: 'Unbooked treatment', colour: 'teal', productBookRef: 'C-5' },
  { id: 'private_lead', label: 'Private lead', colour: 'teal', productBookRef: 'C-5' },
  { id: 'nhs_patient', label: 'NHS patient', colour: 'blue', productBookRef: 'C-6' },
  { id: 'private_patient', label: 'Private patient', colour: 'blue', productBookRef: 'C-6' },
  { id: 'child_patient', label: 'Child patient', colour: 'blue', productBookRef: 'C-6' },
  { id: 'parent_guardian_calling', label: 'Parent or guardian calling', colour: 'blue', productBookRef: 'C-6' },
  { id: 'language_barrier', label: 'Language barrier', colour: 'blue', productBookRef: 'C-6' },
  { id: 'withheld_number', label: 'Withheld number', colour: 'grey', productBookRef: 'C-7' },
  { id: 'borrowed_phone', label: 'Borrowed phone', colour: 'grey', productBookRef: 'C-7' },
  { id: 'no_dentally_match', label: 'No Dentally match', colour: 'grey', productBookRef: 'C-7' },
  { id: 'opt_out', label: 'Opt-out', colour: 'grey', productBookRef: 'C-7' },
  { id: 'dentally_record_quality', label: 'Dentally record quality warning', colour: 'grey', productBookRef: 'C-7' },
]

export function flagsByColour(colour: QueueFlagColour): QueueFlagDefinition[] {
  return QUEUE_FLAGS.filter(f => f.colour === colour)
}

export function getQueueFlag(id: QueueFlagId): QueueFlagDefinition | undefined {
  return QUEUE_FLAGS.find(f => f.id === id)
}

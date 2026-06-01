import type { CallerMatchState } from '@/lib/mock/patients'
import type { AppointmentTypeId, RuleDecision } from '@/lib/rules/types'
import type { CallbackAttempt } from './callback-tracker'

export type QueueItemType =
  | 'booking_request'
  | 'emergency'
  | 'callback'
  | 'identity_review'
  | 'payment_recovery'
  | 'fta_followup'
  | 'recall'
  | 'cancellation'
  | 'running_late'
  | 'complaint'

export type QueuePriority = 'urgent' | 'high' | 'normal' | 'low'

export type QueueStatus =
  | 'pending'
  | 'acknowledged'
  | 'approved'
  | 'rejected'
  | 'resolved'
  | 'escalated'

export const TERMINAL_QUEUE_STATUSES = ['approved', 'rejected', 'resolved'] as const

export function isTerminalQueueStatus(status: QueueStatus): boolean {
  return TERMINAL_QUEUE_STATUSES.includes(status as (typeof TERMINAL_QUEUE_STATUSES)[number])
}

export type QueueItem = {
  id: string
  type: QueueItemType
  priority: QueuePriority
  status: QueueStatus
  clinicId: string
  createdAt: string                  // ISO
  resolvedAt?: string                // ISO
  updatedAt?: string                 // ISO

  // Caller info
  callerPhone: string
  callerState: CallerMatchState
  patientId?: string                 // undefined if no match
  // NOTE: no patientName stored here — derive from patientId lookup only

  // Request specifics
  title: string                      // headline — no PII
  summary: string                    // detail — no patient names
  appointmentTypeId?: AppointmentTypeId
  confidence: number                 // 0-100

  // Decision from rules engine
  ruleDecision?: RuleDecision
  ruleReasons?: string[]

  // Staff handling
  assignedTo?: string                // user id
  resolvedBy?: string                // user id
  notes?: string                     // required for emergency outcomes
  /** S099–S102 — queue ownership (D-1–D-4) */
  lockMode?: 'soft_claim' | 'hard_lock'
  lockAssignedAt?: string            // ISO — hard lock start or soft-claim time
  lockLastActivityAt?: string        // ISO — last activity on open item
  lockSessionEndedAt?: string        // ISO — browser/nav away; release after 2 min
  draftNotes?: string                // preserved when lock auto-releases
  /** S097 — chronological callback attempts (D-5) */
  callbackAttempts?: CallbackAttempt[]

  // Source
  source: 'ai_call' | 'manual' | 'mock'
}

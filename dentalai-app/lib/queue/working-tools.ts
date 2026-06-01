/**
 * S095 — Queue working tools panel (S3-B · B-6).
 *
 * Scratchpad, holding SMS, callback suggestions, attempt tracker, outcome selector,
 * assignee, lock state, and audit trail hints for queue detail cards.
 */

import type { QueueItem, QueueItemType } from './types'
import type { SessionActor } from '@/lib/access-control'

export type HoldingSmsStatus = 'none' | 'queued' | 'sent' | 'failed' | 'suppressed'

export type CallbackAttemptRecord = {
  at: string
  outcome: 'no_answer' | 'voicemail' | 'wrong_number' | 'reached'
  by?: string
}

export type QueueLockState = 'unlocked' | 'locked_by_self' | 'locked_by_other'

export type WorkingToolsOutcomeOption = {
  value: string
  label: string
}

export type WorkingToolsPanel = {
  scratchpadStorageKey: string
  holdingSms: {
    status: HoldingSmsStatus
    content?: string
    recipient?: string
    sentAt?: string
    suppressionReason?: string
  }
  suggestedCallbackTime: string
  callbackAttempts: CallbackAttemptRecord[]
  callbackAttemptCount: number
  managerReviewRequired: boolean
  assigneeId?: string
  assigneeName?: string
  lockState: QueueLockState
  lockExpiresAt?: string
  lockHeldByName?: string
  requiredOutcome: boolean
  outcomeOptions: WorkingToolsOutcomeOption[]
  showPatientCalledBack: boolean
  auditTrailHint: string
}

const LOCK_DURATION_MS = 30 * 60 * 1000

const CALLBACK_OUTCOMES: WorkingToolsOutcomeOption[] = [
  { value: 'reached', label: 'Patient reached — resolved' },
  { value: 'no_answer', label: 'No answer — try again' },
  { value: 'voicemail', label: 'Left voicemail' },
  { value: 'wrong_number', label: 'Wrong number' },
]

const EMERGENCY_OUTCOMES: WorkingToolsOutcomeOption[] = [
  { value: 'contacted', label: 'Patient contacted & handled' },
  { value: 'unable_to_reach', label: 'Unable to reach patient' },
  { value: 'transferred', label: 'Transferred to clinical team' },
  { value: 'escalated_to_manager', label: 'Escalated to practice manager' },
  { value: 'false_positive', label: 'False positive — no action needed' },
]

function itemRequiresOutcome(type: QueueItemType): boolean {
  return type === 'callback' || type === 'emergency' || type === 'fta_followup' || type === 'recall'
}

function mockHoldingSms(item: QueueItem): WorkingToolsPanel['holdingSms'] {
  if (item.source !== 'ai_call') {
    return { status: 'none' }
  }

  if (item.type === 'emergency') {
    return {
      status: 'sent',
      content:
        'Thank you for calling. We have noted your request and a member of our team will contact you shortly.',
      recipient: item.callerPhone,
      sentAt: item.createdAt,
    }
  }

  if (item.callerState === 'withheld' || item.confidence < 40) {
    return {
      status: 'suppressed',
      suppressionReason: 'Identity not verified — holding SMS withheld until staff review.',
    }
  }

  return {
    status: 'queued',
    content:
      'Thanks for calling. We are preparing your request and a team member will be in touch shortly.',
    recipient: item.callerPhone,
  }
}

function mockCallbackAttempts(item: QueueItem): CallbackAttemptRecord[] {
  if (item.type !== 'callback' && item.type !== 'fta_followup' && item.type !== 'recall') {
    return []
  }

  if (item.status === 'acknowledged') {
    return [
      {
        at: item.updatedAt ?? item.createdAt,
        outcome: 'no_answer',
        by: 'Previous attempt',
      },
    ]
  }

  return []
}

/** Suggest the next sensible callback window in UK local phrasing. */
export function suggestCallbackTime(referenceIso: string): string {
  const ref = new Date(referenceIso)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/London',
    }).format(ref),
  )

  if (hour < 12) return 'Try again after 14:00 today when afternoon slots open.'
  if (hour < 17) return 'Try again at 17:30 — common pickup time after work.'
  return 'Try again tomorrow between 09:30 and 11:00.'
}

export function deriveQueueLockState(input: {
  assignedTo?: string
  assignedAt?: string
  actorUserId: string
  assigneeName?: string
}): Pick<WorkingToolsPanel, 'lockState' | 'lockExpiresAt' | 'lockHeldByName' | 'assigneeId' | 'assigneeName'> {
  if (!input.assignedTo) {
    return { lockState: 'unlocked' }
  }

  const assignedAt = input.assignedAt ? Date.parse(input.assignedAt) : Date.now()
  const lockExpiresAt = new Date(assignedAt + LOCK_DURATION_MS).toISOString()

  if (input.assignedTo === input.actorUserId) {
    return {
      lockState: 'locked_by_self',
      lockExpiresAt,
      assigneeId: input.assignedTo,
      assigneeName: input.assigneeName,
    }
  }

  return {
    lockState: 'locked_by_other',
    lockExpiresAt,
    lockHeldByName: input.assigneeName ?? 'Another staff member',
    assigneeId: input.assignedTo,
    assigneeName: input.assigneeName,
  }
}

export function buildWorkingToolsPanel(input: {
  item: QueueItem
  actor: SessionActor
  assigneeName?: string
}): WorkingToolsPanel {
  const callbackAttempts = mockCallbackAttempts(input.item)
  const lock = deriveQueueLockState({
    assignedTo: input.item.assignedTo,
    assignedAt: input.item.updatedAt ?? input.item.createdAt,
    actorUserId: input.actor.userId,
    assigneeName: input.assigneeName,
  })

  const requiredOutcome = itemRequiresOutcome(input.item.type)
  const outcomeOptions =
    input.item.type === 'emergency' ? EMERGENCY_OUTCOMES : CALLBACK_OUTCOMES

  return {
    scratchpadStorageKey: `dentalai-scratchpad-${input.item.id}`,
    holdingSms: mockHoldingSms(input.item),
    suggestedCallbackTime: suggestCallbackTime(input.item.createdAt),
    callbackAttempts,
    callbackAttemptCount: callbackAttempts.length,
    managerReviewRequired: callbackAttempts.length >= 3,
    ...lock,
    requiredOutcome,
    outcomeOptions,
    showPatientCalledBack:
      input.item.type === 'callback' ||
      input.item.type === 'fta_followup' ||
      input.item.type === 'recall',
    auditTrailHint:
      'Every action on this item is logged in the audit trail — managers can review who acted and when.',
  }
}

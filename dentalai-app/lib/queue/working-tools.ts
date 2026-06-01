/**
 * S095 — Queue working tools panel (S3-B · B-6).
 *
 * Scratchpad, holding SMS, callback suggestions, attempt tracker, outcome selector,
 * assignee, lock state, and audit trail hints for queue detail cards.
 */

import type { QueueItem, QueueItemType } from './types'
import type { SessionActor } from '@/lib/access-control'
import { LOCK_INACTIVITY_RELEASE_MS, buildQueueLockView } from './ownership'
import {
  buildCallbackTrackerView,
  isCallbackTrackableType,
  suggestCallbackWindow,
  type CallbackAttempt,
} from './callback-tracker'

export type HoldingSmsStatus = 'none' | 'queued' | 'sent' | 'failed' | 'suppressed'

export type { CallbackAttempt }

export type QueueLockState = 'unlocked' | 'locked_by_self' | 'locked_by_other'

export type WorkingToolsOutcomeOption = {
  value: string
  label: string
}

export type WorkingToolsPanel = {
  ownership: ReturnType<typeof buildQueueLockView>
  scratchpadStorageKey: string
  holdingSms: {
    status: HoldingSmsStatus
    content?: string
    recipient?: string
    sentAt?: string
    suppressionReason?: string
  }
  suggestedCallbackTime: string
  callbackAttempts: CallbackAttempt[]
  callbackAttemptCount: number
  managerReviewRequired: boolean
  allowsUnableAfterThree: boolean
  withinCallbackWindow: boolean
  attemptOutcomes: { value: string; label: string }[]
  fourthAttemptAllowed: boolean
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

const LOCK_DURATION_MS = LOCK_INACTIVITY_RELEASE_MS

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
  return isCallbackTrackableType(type)
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

/** UK-local phrasing for the next sensible callback window (D-8). */
export function suggestCallbackTime(referenceIso: string): string {
  return suggestCallbackWindow({
    itemCreatedAt: referenceIso,
    nowMs: Date.parse(referenceIso),
  }).suggestion
}

export function deriveQueueLockState(input: {
  item: QueueItem
  actorUserId: string
  assigneeName?: string
}): Pick<WorkingToolsPanel, 'lockState' | 'lockExpiresAt' | 'lockHeldByName' | 'assigneeId' | 'assigneeName'> {
  const view = buildQueueLockView({
    item: input.item,
    actorUserId: input.actorUserId,
    assigneeName: input.assigneeName,
  })

  const activityAt = input.item.lockLastActivityAt ?? input.item.lockAssignedAt
  const lockExpiresAt = activityAt
    ? new Date(Date.parse(activityAt) + LOCK_DURATION_MS).toISOString()
    : undefined

  if (view.uiState === 'unlocked') {
    return { lockState: 'unlocked' }
  }
  if (view.uiState === 'soft_claim_by_self' || view.uiState === 'soft_claim_by_other') {
    const softSelf = view.uiState === 'soft_claim_by_self'
    return {
      lockState: softSelf ? 'locked_by_self' : 'locked_by_other',
      lockHeldByName: softSelf ? undefined : view.assigneeName ?? 'Another staff member',
      assigneeId: view.assigneeId,
      assigneeName: view.assigneeName,
    }
  }
  if (view.uiState === 'locked_by_self') {
    return {
      lockState: 'locked_by_self',
      lockExpiresAt,
      assigneeId: view.assigneeId,
      assigneeName: view.assigneeName,
    }
  }
  return {
    lockState: 'locked_by_other',
    lockExpiresAt,
    lockHeldByName: view.assigneeName ?? 'Another staff member',
    assigneeId: view.assigneeId,
    assigneeName: view.assigneeName,
  }
}

export function buildWorkingToolsPanel(input: {
  item: QueueItem
  actor: SessionActor
  assigneeName?: string
}): WorkingToolsPanel {
  const tracker = buildCallbackTrackerView({ item: input.item })
  const ownership = buildQueueLockView({
    item: input.item,
    actorUserId: input.actor.userId,
    assigneeName: input.assigneeName,
  })
  const lock = deriveQueueLockState({
    item: input.item,
    actorUserId: input.actor.userId,
    assigneeName: input.assigneeName,
  })

  const requiredOutcome = itemRequiresOutcome(input.item.type)
  const outcomeOptions =
    input.item.type === 'emergency' ? EMERGENCY_OUTCOMES : CALLBACK_OUTCOMES

  return {
    ownership,
    scratchpadStorageKey: `dentalai-scratchpad-${input.item.id}`,
    holdingSms: mockHoldingSms(input.item),
    suggestedCallbackTime: tracker.suggestedCallbackTime,
    callbackAttempts: tracker.attempts,
    callbackAttemptCount: tracker.attempts.length,
    managerReviewRequired: tracker.managerReviewRequired,
    allowsUnableAfterThree: tracker.allowsUnableAfterThree,
    withinCallbackWindow: tracker.withinCallbackWindow,
    attemptOutcomes: tracker.attemptOutcomes,
    fourthAttemptAllowed: tracker.fourthAttemptAllowed,
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

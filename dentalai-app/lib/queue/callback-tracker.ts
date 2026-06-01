/**
 * S097 — Callback tracker (S3-D · D-5, D-6, D-8).
 *
 * Chronological attempt log with required outcomes, three-attempt manager review,
 * and smart retry-window suggestions within clinic callback hours.
 */

import type { QueueItem, QueueItemType } from './types'
import { isTerminalQueueStatus } from './types'

export type CallbackAttemptOutcome =
  | 'answered_resolved'
  | 'answered_refer_manager'
  | 'no_answer'
  | 'left_voicemail'
  | 'wrong_number'
  | 'patient_called_back'

export type CallbackAttempt = {
  id: string
  at: string
  outcome: CallbackAttemptOutcome
  byUserId: string
  byName: string
  notes?: string
}

export const CALLBACK_ATTEMPT_OUTCOMES: { value: CallbackAttemptOutcome; label: string }[] = [
  { value: 'answered_resolved', label: 'Answered — resolved' },
  { value: 'answered_refer_manager', label: 'Answered — refer to manager' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'left_voicemail', label: 'Left voicemail' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'patient_called_back', label: 'Patient called back — handled' },
]

export const FAILED_CALLBACK_OUTCOMES = new Set<CallbackAttemptOutcome>([
  'no_answer',
  'left_voicemail',
  'wrong_number',
])

export const RESOLVING_CALLBACK_OUTCOMES = new Set<CallbackAttemptOutcome>([
  'answered_resolved',
  'patient_called_back',
])

export type CallbackWindowConfig = {
  startHour: number
  endHour: number
  lunchStartHour?: number
  lunchEndHour?: number
}

const DEFAULT_WINDOW: CallbackWindowConfig = {
  startHour: 9,
  endHour: 17,
  lunchStartHour: 13,
  lunchEndHour: 14,
}

const UK_TZ = 'Europe/London'

export function isCallbackTrackableType(type: QueueItemType): boolean {
  return type === 'callback' || type === 'emergency' || type === 'fta_followup' || type === 'recall'
}

export function getCallbackAttempts(item: QueueItem): CallbackAttempt[] {
  return item.callbackAttempts ?? []
}

export function countFailedAttempts(attempts: CallbackAttempt[]): number {
  return attempts.filter(a => FAILED_CALLBACK_OUTCOMES.has(a.outcome)).length
}

export function requiresManagerReview(attempts: CallbackAttempt[]): boolean {
  return countFailedAttempts(attempts) >= 3
}

export function allowsUnableAfterThreeClosure(attempts: CallbackAttempt[]): boolean {
  return countFailedAttempts(attempts) >= 3
}

export type AttemptEligibility = {
  allowed: boolean
  errors: string[]
  pendingOutcomeRequired: boolean
}

/** D-5 — each attempt must record an outcome; block while item is terminal. */
export function evaluateAttemptEligibility(
  item: QueueItem,
  input: { outcome?: string; notes?: string } = {},
): AttemptEligibility {
  const errors: string[] = []

  if (!isCallbackTrackableType(item.type)) {
    return { allowed: false, errors: ['This item type does not use the callback tracker'], pendingOutcomeRequired: false }
  }

  if (isTerminalQueueStatus(item.status)) {
    return { allowed: false, errors: ['This item is already closed'], pendingOutcomeRequired: false }
  }

  const outcome = input.outcome?.trim() ?? ''
  if (!outcome) {
    errors.push('Select an attempt outcome before logging')
  } else if (!CALLBACK_ATTEMPT_OUTCOMES.some(o => o.value === outcome)) {
    errors.push('Select a valid attempt outcome')
  }

  return {
    allowed: errors.length === 0,
    errors,
    pendingOutcomeRequired: !outcome,
  }
}

function ukHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: UK_TZ }).format(
      new Date(iso),
    ),
  )
}

function ukWeekday(iso: string): number {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: UK_TZ }).format(
    new Date(iso),
  )
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }
  return map[day] ?? 1
}

function isWithinCallbackWindow(iso: string, config: CallbackWindowConfig): boolean {
  const hour = ukHour(iso)
  if (hour < config.startHour || hour >= config.endHour) return false
  if (
    config.lunchStartHour != null &&
    config.lunchEndHour != null &&
    hour >= config.lunchStartHour &&
    hour < config.lunchEndHour
  ) {
    return false
  }
  return true
}

/** D-8 — suggest next retry window from call time, prior attempts, and clinic hours. */
export function suggestCallbackWindow(input: {
  itemCreatedAt: string
  attempts?: CallbackAttempt[]
  nowMs?: number
  config?: CallbackWindowConfig
  criticalOverride?: boolean
}): {
  suggestion: string
  withinWindow: boolean
  prefersTueThu: boolean
} {
  const config = input.config ?? DEFAULT_WINDOW
  const nowMs = input.nowMs ?? Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const withinWindow = isWithinCallbackWindow(nowIso, config)
  const attempts = input.attempts ?? []
  const refIso = attempts.length > 0 ? attempts[attempts.length - 1].at : input.itemCreatedAt
  const refHour = ukHour(refIso)
  const weekday = ukWeekday(nowIso)
  const prefersTueThu = weekday >= 2 && weekday <= 4

  if (!withinWindow && !input.criticalOverride) {
    return {
      suggestion: `Outside callback hours (${config.startHour}:00–${config.endHour}:00). Retry tomorrow from ${config.startHour}:30.`,
      withinWindow: false,
      prefersTueThu,
    }
  }

  if (attempts.length >= 2) {
    const failedHours = attempts
      .filter(a => FAILED_CALLBACK_OUTCOMES.has(a.outcome))
      .map(a => ukHour(a.at))
    if (failedHours.length >= 2 && failedHours.every(h => h < 12)) {
      return {
        suggestion: 'Morning attempts missed — try 14:00–16:00 today when pickup rates improve.',
        withinWindow,
        prefersTueThu,
      }
    }
  }

  if (refHour < 12) {
    return {
      suggestion: prefersTueThu
        ? 'Try again after 14:00 today — Tuesday–Thursday afternoons perform best.'
        : 'Try again after 14:00 today when afternoon slots open.',
      withinWindow,
      prefersTueThu,
    }
  }
  if (refHour < 17) {
    return {
      suggestion: 'Try again at 17:30 — common pickup time after work.',
      withinWindow,
      prefersTueThu,
    }
  }
  return {
    suggestion: 'Try again tomorrow between 09:30 and 11:00.',
    withinWindow,
    prefersTueThu,
  }
}

export type CallbackTrackerView = {
  attempts: CallbackAttempt[]
  failedCount: number
  managerReviewRequired: boolean
  allowsUnableAfterThree: boolean
  suggestedCallbackTime: string
  withinCallbackWindow: boolean
  attemptOutcomes: typeof CALLBACK_ATTEMPT_OUTCOMES
  fourthAttemptAllowed: boolean
}

export function buildCallbackTrackerView(input: {
  item: QueueItem
  nowMs?: number
  criticalOverride?: boolean
  config?: CallbackWindowConfig
}): CallbackTrackerView {
  const attempts = getCallbackAttempts(input.item)
  const failedCount = countFailedAttempts(attempts)
  const window = suggestCallbackWindow({
    itemCreatedAt: input.item.createdAt,
    attempts,
    nowMs: input.nowMs,
    config: input.config,
    criticalOverride: input.criticalOverride,
  })

  return {
    attempts,
    failedCount,
    managerReviewRequired: requiresManagerReview(attempts),
    allowsUnableAfterThree: allowsUnableAfterThreeClosure(attempts),
    suggestedCallbackTime: window.suggestion,
    withinCallbackWindow: window.withinWindow,
    attemptOutcomes: CALLBACK_ATTEMPT_OUTCOMES,
    fourthAttemptAllowed: true,
  }
}

export function appendCallbackAttempt(input: {
  item: QueueItem
  outcome: CallbackAttemptOutcome
  byUserId: string
  byName: string
  notes?: string
  attemptId?: string
  at?: string
}): CallbackAttempt[] {
  const attempt: CallbackAttempt = {
    id: input.attemptId ?? `cb-${Date.now()}`,
    at: input.at ?? new Date().toISOString(),
    outcome: input.outcome,
    byUserId: input.byUserId,
    byName: input.byName,
    notes: input.notes?.trim() || undefined,
  }
  return [...getCallbackAttempts(input.item), attempt]
}

export function resolveStatusAfterAttempt(outcome: CallbackAttemptOutcome): QueueItem['status'] {
  if (RESOLVING_CALLBACK_OUTCOMES.has(outcome)) return 'resolved'
  if (outcome === 'answered_refer_manager') return 'escalated'
  return 'acknowledged'
}

/**
 * S106 — Duplicate caller (S3-E · E-2).
 *
 * Second same-day call adds duplicate_caller flag and raises priority one level.
 * Three or more same-day calls alert practice manager regardless of action status.
 */

import type { QueueFlagId } from './flags'
import type { QueueItem, QueuePriority } from './types'
import { QUEUE_PRIORITY_TO_LOCKED, lockedPriorityToQueuePriority } from './priority-policy'
import type { LockedPriorityLevel } from './priority-policy'

const UK_TZ = 'Europe/London'

const PRIORITY_ORDER: LockedPriorityLevel[] = ['low', 'standard', 'high', 'critical']

function ukDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: UK_TZ,
  }).format(new Date(iso))
}

function matchesCaller(a: QueueItem, b: QueueItem): boolean {
  if (a.patientId && b.patientId) return a.patientId === b.patientId
  return a.callerPhone === b.callerPhone
}

export function countSameDayCalls(input: {
  item: QueueItem
  allItems: QueueItem[]
}): number {
  const dayKey = ukDateKey(input.item.createdAt)
  return input.allItems.filter(
    i =>
      i.clinicId === input.item.clinicId &&
      ukDateKey(i.createdAt) === dayKey &&
      matchesCaller(input.item, i),
  ).length
}

export function elevateLockedPriorityOneLevel(level: LockedPriorityLevel): LockedPriorityLevel {
  const idx = PRIORITY_ORDER.indexOf(level)
  return PRIORITY_ORDER[Math.min(idx + 1, PRIORITY_ORDER.length - 1)]
}

export type DuplicateCallerEvaluation = {
  sameDayCount: number
  addDuplicateCallerFlag: boolean
  suggestedFlags: QueueFlagId[]
  suggestedPriority: QueuePriority
  managerAlertRequired: boolean
  message: string
}

export function evaluateDuplicateCaller(input: {
  item: QueueItem
  allItems: QueueItem[]
}): DuplicateCallerEvaluation {
  const sameDayCount = countSameDayCalls(input)
  const baseLocked = QUEUE_PRIORITY_TO_LOCKED[input.item.priority]

  if (sameDayCount < 2) {
    return {
      sameDayCount,
      addDuplicateCallerFlag: false,
      suggestedFlags: [],
      suggestedPriority: input.item.priority,
      managerAlertRequired: false,
      message: '',
    }
  }

  const elevated = elevateLockedPriorityOneLevel(baseLocked)
  const managerAlertRequired = sameDayCount >= 3

  let message = `Duplicate caller — ${sameDayCount} calls today. Priority raised one level.`
  if (managerAlertRequired) {
    message += ' Practice manager alert required.'
  }

  return {
    sameDayCount,
    addDuplicateCallerFlag: true,
    suggestedFlags: ['duplicate_caller'],
    suggestedPriority: lockedPriorityToQueuePriority(elevated),
    managerAlertRequired,
    message,
  }
}

export type DuplicateCallerAlert = {
  show: boolean
  sameDayCount: number
  managerAlertRequired: boolean
  message: string
  suggestedPriority: QueuePriority
}

export function buildDuplicateCallerAlert(input: {
  item: QueueItem
  allItems: QueueItem[]
}): DuplicateCallerAlert {
  const evaluation = evaluateDuplicateCaller(input)
  return {
    show: evaluation.sameDayCount >= 2,
    sameDayCount: evaluation.sameDayCount,
    managerAlertRequired: evaluation.managerAlertRequired,
    message: evaluation.message,
    suggestedPriority: evaluation.suggestedPriority,
  }
}

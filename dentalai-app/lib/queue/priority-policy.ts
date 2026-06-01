/**
 * S089 — Priority levels and routing hints (S3-C · C-8 through C-10).
 */

import type { QueueFlagId } from './flags'
import type { QueuePriority } from './types'

/** Locked priority names — map to existing QueuePriority where stored. */
export type LockedPriorityLevel = 'critical' | 'high' | 'standard' | 'low'

export const LOCKED_TO_QUEUE_PRIORITY: Record<LockedPriorityLevel, QueuePriority> = {
  critical: 'urgent',
  high: 'high',
  standard: 'normal',
  low: 'low',
}

export const QUEUE_PRIORITY_TO_LOCKED: Record<QueuePriority, LockedPriorityLevel> = {
  urgent: 'critical',
  high: 'high',
  normal: 'standard',
  low: 'low',
}

const CRITICAL_FLAGS: QueueFlagId[] = [
  'emergency_urgent_pain',
  'safeguarding',
  'deceased_notification',
  'dentally_write_failed',
  'system_error',
]

const HIGH_FLAGS: QueueFlagId[] = [
  'complaint',
  'identity_failed',
  'low_confidence',
  'duplicate_caller',
]

/**
 * S089 — derive locked priority from flags and optional base priority.
 */
export function deriveLockedPriority(input: {
  flags: QueueFlagId[]
  basePriority?: LockedPriorityLevel
}): LockedPriorityLevel {
  if (input.flags.some(f => CRITICAL_FLAGS.includes(f))) return 'critical'
  if (input.flags.some(f => HIGH_FLAGS.includes(f))) return 'high'
  return input.basePriority ?? 'standard'
}

export function lockedPriorityToQueuePriority(level: LockedPriorityLevel): QueuePriority {
  return LOCKED_TO_QUEUE_PRIORITY[level]
}

/** C-10 — standard vs low routing hint for batchable work. */
export function isBatchablePriority(level: LockedPriorityLevel): boolean {
  return level === 'low'
}

/**
 * S099–S102 — Queue ownership band (S3-D · D-1–D-4).
 *
 * D-1 Auto-lock on open · 8 min timer · 10 min inactivity release with draft notes
 * D-2 Soft claim without inactivity timeout until open
 * D-3 Pass to colleague (see colleague-presence.ts + actions)
 * D-4 Session release within two minutes after logout or nav away
 */

import type { QueueItem } from './types'
import { isTerminalQueueStatus } from './types'

export function resolveLockMode(item: QueueItem): QueueLockMode {
  if (!item.assignedTo) return 'none'
  return item.lockMode === 'soft_claim' ? 'soft_claim' : 'hard_lock'
}

export const LOCK_TIMER_VISIBLE_MS = 8 * 60 * 1000
export const LOCK_INACTIVITY_RELEASE_MS = 10 * 60 * 1000
export const SESSION_LOCK_RELEASE_MS = 2 * 60 * 1000

export type QueueLockMode = 'none' | 'soft_claim' | 'hard_lock'

export type QueueLockUiState =
  | 'unlocked'
  | 'locked_by_self'
  | 'locked_by_other'
  | 'soft_claim_by_self'
  | 'soft_claim_by_other'

export type QueueLockView = {
  mode: QueueLockMode
  uiState: QueueLockUiState
  assigneeId?: string
  assigneeName?: string
  lockAssignedAt?: string
  lockLastActivityAt?: string
  showInactiveTimer: boolean
  inactiveMinutesElapsed?: number
  inProgressLabel?: string
  readOnlyForActor: boolean
  draftNotes?: string
}

export function formatInProgressLabel(assigneeName: string): string {
  return `In progress — ${assigneeName}`
}

export function msSince(iso: string | undefined, nowMs: number): number {
  if (!iso) return 0
  return Math.max(0, nowMs - Date.parse(iso))
}

/** D-1 — show elapsed timer after eight minutes of hard lock. */
export function shouldShowInactiveTimer(item: QueueItem, nowMs = Date.now()): boolean {
  if (resolveLockMode(item) !== 'hard_lock') return false
  const start = item.lockAssignedAt ?? item.lockLastActivityAt
  return msSince(start, nowMs) >= LOCK_TIMER_VISIBLE_MS
}

/** D-1 — release hard lock after ten minutes without activity. */
export function shouldReleaseInactiveLock(item: QueueItem, nowMs = Date.now()): boolean {
  if (resolveLockMode(item) !== 'hard_lock') return false
  const last = item.lockLastActivityAt ?? item.lockAssignedAt
  if (!last) return false
  return msSince(last, nowMs) >= LOCK_INACTIVITY_RELEASE_MS
}

/** D-4 — release after session ended and two minutes elapsed. */
export function shouldReleaseSessionLock(item: QueueItem, nowMs = Date.now()): boolean {
  if (!item.lockSessionEndedAt || !item.assignedTo) return false
  return msSince(item.lockSessionEndedAt, nowMs) >= SESSION_LOCK_RELEASE_MS
}

export function buildQueueLockView(input: {
  item: QueueItem
  actorUserId: string
  assigneeName?: string
  nowMs?: number
}): QueueLockView {
  const nowMs = input.nowMs ?? Date.now()
  const mode = resolveLockMode(input.item)
  const assigneeId = input.item.assignedTo
  const assigneeName = input.assigneeName

  if (mode === 'none') {
    return {
      mode: 'none',
      uiState: 'unlocked',
      readOnlyForActor: false,
      showInactiveTimer: false,
      draftNotes: input.item.draftNotes,
    }
  }

  const isSelf = assigneeId === input.actorUserId
  const uiState: QueueLockUiState =
    mode === 'soft_claim'
      ? isSelf
        ? 'soft_claim_by_self'
        : 'soft_claim_by_other'
      : isSelf
        ? 'locked_by_self'
        : 'locked_by_other'

  const inProgressLabel =
    assigneeName && mode === 'hard_lock' ? formatInProgressLabel(assigneeName) : undefined

  const inactiveMinutesElapsed =
    mode === 'hard_lock' && shouldShowInactiveTimer(input.item, nowMs)
      ? Math.floor(
          msSince(input.item.lockLastActivityAt ?? input.item.lockAssignedAt, nowMs) /
            60_000,
        )
      : undefined

  return {
    mode,
    uiState,
    assigneeId,
    assigneeName,
    lockAssignedAt: input.item.lockAssignedAt,
    lockLastActivityAt: input.item.lockLastActivityAt,
    showInactiveTimer: shouldShowInactiveTimer(input.item, nowMs),
    inactiveMinutesElapsed,
    inProgressLabel,
    readOnlyForActor: mode === 'hard_lock' && !isSelf,
    draftNotes: input.item.draftNotes,
  }
}

export function buildQueueRowInProgressLabel(
  item: QueueItem,
  assigneeName: string | undefined,
): string | undefined {
  if (isTerminalQueueStatus(item.status)) return undefined
  const mode = resolveLockMode(item)
  if (mode === 'hard_lock' && assigneeName) return formatInProgressLabel(assigneeName)
  if (mode === 'soft_claim' && assigneeName) return `Claimed — ${assigneeName}`
  return undefined
}

/** Patch applied when acquiring or upgrading a hard lock on open (D-1). */
export function hardLockPatch(actorUserId: string, nowIso: string): Partial<QueueItem> {
  return {
    assignedTo: actorUserId,
    lockMode: 'hard_lock',
    lockAssignedAt: nowIso,
    lockLastActivityAt: nowIso,
    lockSessionEndedAt: undefined,
  }
}

/** Patch for soft claim (D-2) — no inactivity clock until open. */
export function softClaimPatch(actorUserId: string, nowIso: string): Partial<QueueItem> {
  return {
    assignedTo: actorUserId,
    lockMode: 'soft_claim',
    lockAssignedAt: nowIso,
    lockLastActivityAt: undefined,
    lockSessionEndedAt: undefined,
  }
}

/** Release lock and preserve working notes as draft (D-1 / D-4). */
export function releaseLockPatch(item: QueueItem, preserveNotes?: string): Partial<QueueItem> {
  const draft =
    preserveNotes?.trim() ||
    item.notes?.trim() ||
    item.draftNotes?.trim() ||
    undefined
  return {
    assignedTo: undefined,
    lockMode: undefined,
    lockAssignedAt: undefined,
    lockLastActivityAt: undefined,
    lockSessionEndedAt: undefined,
    draftNotes: draft,
  }
}

export function canAcquireHardLock(item: QueueItem, actorUserId: string): boolean {
  if (isTerminalQueueStatus(item.status)) return false
  const mode = resolveLockMode(item)
  if (mode === 'none') return true
  if (item.assignedTo === actorUserId) return true
  if (mode === 'soft_claim') return true
  return false
}

export function sweepExpiredLocks(
  items: QueueItem[],
  nowMs = Date.now(),
): { item: QueueItem; patch: Partial<QueueItem> }[] {
  const updates: { item: QueueItem; patch: Partial<QueueItem> }[] = []
  for (const item of items) {
    if (shouldReleaseInactiveLock(item, nowMs) || shouldReleaseSessionLock(item, nowMs)) {
      updates.push({
        item,
        patch: releaseLockPatch(item, item.notes),
      })
    }
  }
  return updates
}

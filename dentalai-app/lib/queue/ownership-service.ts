/**
 * Server-side queue ownership mutations (S099–S102).
 */

import { getUserById } from '@/lib/users/store'
import type { SessionActor } from '@/lib/access-control'
import { canAcquireHardLock, hardLockPatch, softClaimPatch, sweepExpiredLocks } from './ownership'
import { getQueueItem, getQueueItemsForClinics, updateQueueItem } from './store'
import type { QueueItem } from './types'

export function runQueueOwnershipSweep(clinicIds: string[]): number {
  const items = getQueueItemsForClinics(clinicIds)
  let count = 0
  for (const { item, patch } of sweepExpiredLocks(items)) {
    updateQueueItem(item.id, patch)
    count += 1
  }
  return count
}

export function resolveAssigneeName(userId: string | undefined): string | undefined {
  if (!userId) return undefined
  return getUserById(userId)?.name
}

/** D-1 — acquire hard lock when staff open queue detail. */
export function openQueueItemForView(
  itemId: string,
  actor: SessionActor,
): { item: QueueItem; acquired: boolean; readOnly: boolean } | undefined {
  runQueueOwnershipSweep(actor.clinicIds)

  const item = getQueueItem(itemId)
  if (!item) return undefined

  const now = new Date().toISOString()

  if (!canAcquireHardLock(item, actor.userId)) {
    return { item, acquired: false, readOnly: true }
  }

  if (item.assignedTo === actor.userId && item.lockMode === 'hard_lock') {
    updateQueueItem(itemId, { lockLastActivityAt: now, lockSessionEndedAt: undefined })
    return {
      item: getQueueItem(itemId)!,
      acquired: false,
      readOnly: false,
    }
  }

  updateQueueItem(itemId, hardLockPatch(actor.userId, now))
  return {
    item: getQueueItem(itemId)!,
    acquired: true,
    readOnly: false,
  }
}

/** D-4 — mark session ended; release within two minutes on next sweep. */
export function markSessionEndedForUserLocks(userId: string, clinicIds: string[]): void {
  const now = new Date().toISOString()
  const items = getQueueItemsForClinics(clinicIds).filter(
    i => i.assignedTo === userId && i.lockMode === 'hard_lock',
  )
  for (const item of items) {
    updateQueueItem(item.id, { lockSessionEndedAt: now })
  }
}

/** D-4 — immediate release on logout. */
export { releaseLocksForUserInMemory as releaseSessionLocksForUser } from './store'

export function applySoftClaim(itemId: string, actorUserId: string): QueueItem | undefined {
  const item = getQueueItem(itemId)
  if (!item) return undefined
  const now = new Date().toISOString()
  if (item.assignedTo && item.assignedTo !== actorUserId && item.lockMode === 'hard_lock') {
    return undefined
  }
  return updateQueueItem(itemId, softClaimPatch(actorUserId, now))
}

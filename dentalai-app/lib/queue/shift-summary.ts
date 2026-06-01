/**
 * S107 — Shift summaries (S3-D · D-12).
 *
 * Personal contribution on logout; handover briefing for incoming staff.
 * Framed as operational handover, not individual surveillance.
 */

import type { QueueItem } from './types'
import { isTerminalQueueStatus } from './types'
import { resolveLockMode } from './ownership'

export type PersonalShiftSummary = {
  itemsTouched: number
  itemsResolved: number
  callbacksLogged: number
  softClaimsActive: number
  message: string
}

export type HandoverBriefing = {
  openItems: number
  highOrCritical: number
  overnightCount: number
  callbackCount: number
  carriedOverTitles: string[]
  banner: string
}

function isHighOrCritical(item: QueueItem): boolean {
  return item.priority === 'urgent' || item.priority === 'high'
}

function isOvernightItem(item: QueueItem, nowMs: number): boolean {
  const created = Date.parse(item.createdAt)
  const hours = (nowMs - created) / 3_600_000
  return hours >= 12 && !isTerminalQueueStatus(item.status)
}

export function buildPersonalShiftSummary(input: {
  actorUserId: string
  items: QueueItem[]
  sinceIso?: string
}): PersonalShiftSummary {
  const since = input.sinceIso ? Date.parse(input.sinceIso) : 0
  const touched = input.items.filter(i => {
    if (i.resolvedBy === input.actorUserId) return true
    if (i.assignedTo === input.actorUserId && resolveLockMode(i) !== 'none') return true
    const updated = i.updatedAt ? Date.parse(i.updatedAt) : 0
    return i.assignedTo === input.actorUserId && updated >= since
  })

  const resolved = input.items.filter(
    i => i.resolvedBy === input.actorUserId && isTerminalQueueStatus(i.status),
  )
  const callbacks = resolved.filter(i => i.type === 'callback' || i.type === 'fta_followup')
  const softClaims = input.items.filter(
    i => i.assignedTo === input.actorUserId && i.lockMode === 'soft_claim',
  )

  const message =
    resolved.length > 0
      ? `You helped close ${resolved.length} item${resolved.length === 1 ? '' : 's'} this session — thank you.`
      : 'No closed items this session — your open work stays in the queue for the team.'

  return {
    itemsTouched: touched.length,
    itemsResolved: resolved.length,
    callbacksLogged: callbacks.length,
    softClaimsActive: softClaims.length,
    message,
  }
}

export function buildHandoverBriefing(input: {
  items: QueueItem[]
  nowMs?: number
}): HandoverBriefing {
  const nowMs = input.nowMs ?? Date.now()
  const open = input.items.filter(i => !isTerminalQueueStatus(i.status))
  const highOrCritical = open.filter(isHighOrCritical)
  const overnight = open.filter(i => isOvernightItem(i, nowMs))
  const callbacks = open.filter(
    i => i.type === 'callback' || i.type === 'fta_followup' || i.type === 'recall',
  )

  const carriedOverTitles = highOrCritical.slice(0, 5).map(i => i.title)

  let banner = `${open.length} open item${open.length === 1 ? '' : 's'} waiting for the team.`
  if (highOrCritical.length > 0) {
    banner += ` ${highOrCritical.length} need priority attention.`
  }
  if (overnight.length > 0) {
    banner += ` ${overnight.length} carried over from earlier.`
  }
  if (callbacks.length > 0) {
    banner += ` ${callbacks.length} callback${callbacks.length === 1 ? '' : 's'} in the queue.`
  }

  return {
    openItems: open.length,
    highOrCritical: highOrCritical.length,
    overnightCount: overnight.length,
    callbackCount: callbacks.length,
    carriedOverTitles,
    banner,
  }
}

/**
 * Append-only audit store — typed SQLite when persistence is on.
 *
 * PII policy (enforced by convention — reviewers must check at PR time):
 * - summary strings must NEVER contain patient names, DOBs, phone numbers, or addresses
 * - patientRef stores patient ID only — never a name
 * - queueItemRef stores queue item ID only
 * - actor email is stored (staff — not patient data)
 */

import type { AuditEvent, AuditAction, AuditStatus, AuditActor } from './types'
import { assertKnownAuditAction } from './taxonomy'
import { persistenceEnabled } from '@/lib/db/client'
import {
  repoCountAuditEvents,
  repoInsertAuditEvent,
  repoLoadAuditEvents,
} from '@/lib/db/repositories/audit'

const globalStore = globalThis as typeof globalThis & {
  __auditEvents?: AuditEvent[]
}

function loadMemory(): AuditEvent[] {
  if (!globalStore.__auditEvents) {
    globalStore.__auditEvents = []
  }
  return globalStore.__auditEvents
}

function load(): AuditEvent[] {
  if (globalStore.__auditEvents) return globalStore.__auditEvents

  if (persistenceEnabled()) {
    globalStore.__auditEvents = repoLoadAuditEvents({ limit: 10_000 })
  } else {
    globalStore.__auditEvents = loadMemory()
  }

  return globalStore.__auditEvents
}

/** Test-only: drop the process cache so the next access reloads from storage. */
export function __resetAuditForTests(): void {
  delete globalStore.__auditEvents
}

let _counter = 0
function generateId(): string {
  _counter += 1
  return `evt_${Date.now().toString(36)}_${_counter}_${Math.random().toString(36).slice(2, 8)}`
}

export function logAuditEvent(params: {
  action: AuditAction
  status: AuditStatus
  actor: AuditActor
  clinicId: string
  patientRef?: string
  queueItemRef?: string
  metadata?: Record<string, string | number | boolean>
  summary: string
}): AuditEvent {
  assertKnownAuditAction(params.action)

  const event: AuditEvent = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...params,
  }

  if (persistenceEnabled()) {
    repoInsertAuditEvent(event)
    if (globalStore.__auditEvents) {
      globalStore.__auditEvents.unshift(event)
    }
  } else {
    const events = loadMemory()
    events.unshift(event)
  }

  return event
}

export function getAuditEvents(filters?: {
  clinicId?: string
  clinicIds?: string[]
  userId?: string
  action?: AuditAction
  limit?: number
}): AuditEvent[] {
  if (persistenceEnabled() && !globalStore.__auditEvents) {
    return repoLoadAuditEvents(filters)
  }

  let events = load()

  if (filters?.clinicIds && filters.clinicIds.length > 0) {
    const allowed = new Set(filters.clinicIds)
    events = events.filter(e => allowed.has(e.clinicId))
  } else if (filters?.clinicId) {
    events = events.filter(e => e.clinicId === filters.clinicId)
  }
  if (filters?.userId) {
    events = events.filter(e => e.actor.userId === filters.userId)
  }
  if (filters?.action) {
    events = events.filter(e => e.action === filters.action)
  }

  return events.slice(0, filters?.limit ?? 100)
}

export function getAuditEventCount(opts?: { clinicId?: string; clinicIds?: string[] }): number {
  if (persistenceEnabled() && !globalStore.__auditEvents) {
    return repoCountAuditEvents(opts)
  }

  const events = load()
  if (opts?.clinicIds && opts.clinicIds.length > 0) {
    const allowed = new Set(opts.clinicIds)
    return events.filter(e => allowed.has(e.clinicId)).length
  }
  if (opts?.clinicId) {
    return events.filter(e => e.clinicId === opts.clinicId).length
  }
  return events.length
}

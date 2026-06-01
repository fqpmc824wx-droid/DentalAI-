/**
 * Queue store — clinic-scoped, backed by typed SQLite repositories.
 */

import { isTerminalQueueStatus, type QueueItem, type QueueStatus } from './types'
import { persistenceEnabled } from '@/lib/db/client'
import {
  repoGetQueueItem,
  repoLoadAllQueueItems,
  repoQueueIsEmpty,
  repoUpdateQueueItem,
  repoUpsertQueueItem,
  repoUpsertQueueItems,
} from '@/lib/db/repositories/queue'

// Seed mock data — no patient names stored directly (use patientId to look up)
const MOCK_QUEUE_SEED: QueueItem[] = [
  {
    id: 'q-001',
    type: 'emergency',
    priority: 'urgent',
    status: 'pending',
    clinicId: 'clinic-1',
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    callerPhone: '07700900099',
    callerState: 'no_match',
    title: 'Severe toothache — possible abscess',
    summary: 'Caller reports unbearable pain since last night, swelling on right side. Cannot eat. Requesting same-day emergency slot.',
    confidence: 88,
    appointmentTypeId: 'emergency',
    ruleDecision: 'review',
    ruleReasons: ['Caller not in system — new patient details required', 'Emergency keyword detected — clinical assessment needed'],
    source: 'mock',
  },
  {
    id: 'q-002',
    type: 'booking_request',
    priority: 'high',
    status: 'pending',
    clinicId: 'clinic-1',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    callerPhone: '07700900077',
    callerState: 'no_match',
    title: 'Implant consultation enquiry',
    summary: 'New private patient requesting implant consult for missing molar. Asked about pricing range.',
    confidence: 72,
    appointmentTypeId: 'implant_consult',
    ruleDecision: 'review',
    ruleReasons: ['Caller not in system — new patient details required', 'Complex treatment enquiry — TCO should review before booking'],
    source: 'mock',
  },
  {
    id: 'q-003',
    type: 'booking_request',
    priority: 'normal',
    status: 'pending',
    clinicId: 'clinic-1',
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    callerPhone: '07700900002',
    callerState: 'confirmed',
    patientId: 'pat-002',
    title: 'Hygiene appointment request',
    summary: '6-month hygiene appointment request. Preferred Thursday afternoons.',
    confidence: 94,
    appointmentTypeId: 'hygiene',
    ruleDecision: 'review',
    ruleReasons: ['Outstanding balance — flag for payment discussion before booking', 'Recent FTA flag — practice manager approval recommended'],
    source: 'mock',
  },
  {
    id: 'q-004',
    type: 'identity_review',
    priority: 'normal',
    status: 'pending',
    clinicId: 'clinic-1',
    createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    callerPhone: '02071234567',
    callerState: 'family_number',
    title: 'Shared number — verify which family member is calling',
    summary: 'This number matches two patients on the same family record. Caller identity must be confirmed before any patient detail is revealed.',
    confidence: 40,
    ruleDecision: 'review',
    ruleReasons: ['Shared family number — confirm which family member is calling'],
    source: 'mock',
  },
  {
    id: 'q-005',
    type: 'recall',
    priority: 'low',
    status: 'pending',
    clinicId: 'clinic-1',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    callerPhone: '07700900005',
    callerState: 'confirmed',
    patientId: 'pat-005',
    title: 'Lapsed patient — recall callback needed',
    summary: '18+ months since last visit. Suggested full assessment booking rather than routine checkup. Manager approval required before outreach.',
    confidence: 92,
    ruleDecision: 'review',
    ruleReasons: ['Lapsed patient — full assessment rather than routine checkup'],
    source: 'mock',
  },
  {
    id: 'q-006',
    type: 'booking_request',
    priority: 'normal',
    status: 'pending',
    clinicId: 'clinic-1',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    callerPhone: '07700900001',
    callerState: 'confirmed',
    patientId: 'pat-001',
    title: 'Routine checkup request',
    summary: 'Standard 6-month checkup. No outstanding balance, no FTA history. All rules passed.',
    confidence: 96,
    appointmentTypeId: 'routine_checkup',
    ruleDecision: 'allow',
    ruleReasons: ['All checks passed'],
    source: 'mock',
  },
  {
    id: 'q-007',
    type: 'booking_request',
    priority: 'normal',
    status: 'pending',
    clinicId: 'clinic-2',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    callerPhone: '07700900010',
    callerState: 'confirmed',
    patientId: 'pat-010',
    title: 'Checkup request — Stratford',
    summary: 'Routine checkup request at Stratford branch.',
    confidence: 90,
    appointmentTypeId: 'routine_checkup',
    ruleDecision: 'allow',
    ruleReasons: ['All checks passed'],
    source: 'mock',
  },
]

const globalStore = globalThis as typeof globalThis & {
  __queueItems?: QueueItem[]
}

function loadMemory(): QueueItem[] {
  if (!globalStore.__queueItems) {
    globalStore.__queueItems = [...MOCK_QUEUE_SEED]
  }
  return globalStore.__queueItems
}

function load(): QueueItem[] {
  if (globalStore.__queueItems) return globalStore.__queueItems

  if (persistenceEnabled()) {
    if (repoQueueIsEmpty()) {
      globalStore.__queueItems = [...MOCK_QUEUE_SEED]
      repoUpsertQueueItems(globalStore.__queueItems)
    } else {
      globalStore.__queueItems = repoLoadAllQueueItems()
    }
  } else {
    globalStore.__queueItems = loadMemory()
  }

  return globalStore.__queueItems
}

function persistItem(item: QueueItem): void {
  if (persistenceEnabled()) {
    repoUpsertQueueItem(item)
  }
}

/** Drop process cache so the next read reloads from storage. */
export function invalidateQueueCache(): void {
  delete globalStore.__queueItems
}

/** Test-only alias. */
export function __resetQueueForTests(): void {
  invalidateQueueCache()
}

/** J-8: release queue locks held by a deactivated user. */
export function releaseLocksForUserInMemory(userId: string): number {
  let count = 0
  const items = load()
  for (const item of items) {
    if (item.assignedTo === userId) {
      item.assignedTo = undefined
      item.updatedAt = new Date().toISOString()
      persistItem(item)
      count += 1
    }
  }
  return count
}

export function getQueueItems(clinicId: string, filter?: { status?: QueueStatus; priority?: string }): QueueItem[] {
  let items = load().filter(i => i.clinicId === clinicId)
  if (filter?.status) items = items.filter(i => i.status === filter.status)
  if (filter?.priority) items = items.filter(i => i.priority === filter.priority)

  const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  return items.sort((a, b) => {
    const p = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
    if (p !== 0) return p
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function getQueueItemsForClinics(clinicIds: string[]): QueueItem[] {
  const items = load().filter(i => clinicIds.includes(i.clinicId))
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  return items.sort((a, b) => {
    const p = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
    if (p !== 0) return p
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function getQueueItem(id: string): QueueItem | undefined {
  if (persistenceEnabled() && !globalStore.__queueItems) {
    const fromDb = repoGetQueueItem(id)
    if (fromDb) return fromDb
  }
  return load().find(i => i.id === id)
}

export function updateQueueItem(
  id: string,
  patch: Partial<QueueItem>,
): QueueItem | undefined {
  if (persistenceEnabled() && !globalStore.__queueItems) {
    return repoUpdateQueueItem(id, patch)
  }

  const items = load()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return undefined

  const before = items[idx]
  const updated: QueueItem = { ...before, ...patch, updatedAt: new Date().toISOString() }
  items[idx] = updated
  persistItem(updated)

  return updated
}

export function addQueueItem(input: Omit<QueueItem, 'id'> & { id?: string }): QueueItem {
  const item: QueueItem = {
    ...input,
    id: input.id ?? `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  }
  const items = load()
  items.unshift(item)
  persistItem(item)
  return item
}

export function getQueueCounts(clinicId: string): { total: number; urgent: number; pending: number; resolved: number } {
  const items = load().filter(i => i.clinicId === clinicId)
  return {
    total: items.length,
    urgent: items.filter(i => i.priority === 'urgent' && i.status === 'pending').length,
    pending: items.filter(i => i.status === 'pending').length,
    resolved: items.filter(i => isTerminalQueueStatus(i.status)).length,
  }
}

export function getQueueCountsForClinics(clinicIds: string[]): { total: number; urgent: number; pending: number; resolved: number } {
  const items = load().filter(i => clinicIds.includes(i.clinicId))
  return {
    total: items.length,
    urgent: items.filter(i => i.priority === 'urgent' && i.status === 'pending').length,
    pending: items.filter(i => i.status === 'pending').length,
    resolved: items.filter(i => isTerminalQueueStatus(i.status)).length,
  }
}

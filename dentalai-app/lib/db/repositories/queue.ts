import type { QueueItem } from '@/lib/queue/types'
import { getDb, persistenceEnabled, runInTransaction } from '@/lib/db/client'

type QueueRow = {
  id: string
  type: string
  priority: string
  status: string
  clinic_id: string
  created_at: string
  resolved_at: string | null
  updated_at: string | null
  caller_phone: string
  caller_state: string
  patient_id: string | null
  title: string
  summary: string
  appointment_type_id: string | null
  confidence: number
  rule_decision: string | null
  rule_reasons: string | null
  assigned_to: string | null
  resolved_by: string | null
  notes: string | null
  source: string
  lock_mode: string | null
  lock_assigned_at: string | null
  lock_last_activity_at: string | null
  lock_session_ended_at: string | null
  draft_notes: string | null
  callback_attempts: string | null
}

function rowToItem(row: QueueRow): QueueItem {
  return {
    id: row.id,
    type: row.type as QueueItem['type'],
    priority: row.priority as QueueItem['priority'],
    status: row.status as QueueItem['status'],
    clinicId: row.clinic_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    callerPhone: row.caller_phone,
    callerState: row.caller_state as QueueItem['callerState'],
    patientId: row.patient_id ?? undefined,
    title: row.title,
    summary: row.summary,
    appointmentTypeId: (row.appointment_type_id ?? undefined) as QueueItem['appointmentTypeId'],
    confidence: row.confidence,
    ruleDecision: (row.rule_decision ?? undefined) as QueueItem['ruleDecision'],
    ruleReasons: row.rule_reasons ? (JSON.parse(row.rule_reasons) as string[]) : undefined,
    assignedTo: row.assigned_to ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    notes: row.notes ?? undefined,
    source: row.source as QueueItem['source'],
    lockMode: (row.lock_mode ?? undefined) as QueueItem['lockMode'],
    lockAssignedAt: row.lock_assigned_at ?? undefined,
    lockLastActivityAt: row.lock_last_activity_at ?? undefined,
    lockSessionEndedAt: row.lock_session_ended_at ?? undefined,
    draftNotes: row.draft_notes ?? undefined,
    callbackAttempts: row.callback_attempts
      ? (JSON.parse(row.callback_attempts) as QueueItem['callbackAttempts'])
      : undefined,
  }
}

function itemToParams(item: QueueItem) {
  return {
    id: item.id,
    type: item.type,
    priority: item.priority,
    status: item.status,
    clinicId: item.clinicId,
    createdAt: item.createdAt,
    resolvedAt: item.resolvedAt ?? null,
    updatedAt: item.updatedAt ?? null,
    callerPhone: item.callerPhone,
    callerState: item.callerState,
    patientId: item.patientId ?? null,
    title: item.title,
    summary: item.summary,
    appointmentTypeId: item.appointmentTypeId ?? null,
    confidence: item.confidence,
    ruleDecision: item.ruleDecision ?? null,
    ruleReasons: item.ruleReasons ? JSON.stringify(item.ruleReasons) : null,
    assignedTo: item.assignedTo ?? null,
    resolvedBy: item.resolvedBy ?? null,
    notes: item.notes ?? null,
    source: item.source,
    lockMode: item.lockMode ?? null,
    lockAssignedAt: item.lockAssignedAt ?? null,
    lockLastActivityAt: item.lockLastActivityAt ?? null,
    lockSessionEndedAt: item.lockSessionEndedAt ?? null,
    draftNotes: item.draftNotes ?? null,
    callbackAttempts: item.callbackAttempts ? JSON.stringify(item.callbackAttempts) : null,
  }
}

const SELECT_ALL = `
  SELECT * FROM queue_items
  ORDER BY
    CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 9 END,
    created_at DESC
`

const UPSERT = `
  INSERT INTO queue_items (
    id, type, priority, status, clinic_id, created_at, resolved_at, updated_at,
    caller_phone, caller_state, patient_id, title, summary, appointment_type_id,
    confidence, rule_decision, rule_reasons, assigned_to, resolved_by, notes, source,
    lock_mode, lock_assigned_at, lock_last_activity_at, lock_session_ended_at, draft_notes,
    callback_attempts
  ) VALUES (
    @id, @type, @priority, @status, @clinicId, @createdAt, @resolvedAt, @updatedAt,
    @callerPhone, @callerState, @patientId, @title, @summary, @appointmentTypeId,
    @confidence, @ruleDecision, @ruleReasons, @assignedTo, @resolvedBy, @notes, @source,
    @lockMode, @lockAssignedAt, @lockLastActivityAt, @lockSessionEndedAt, @draftNotes,
    @callbackAttempts
  )
  ON CONFLICT(id) DO UPDATE SET
    type = excluded.type,
    priority = excluded.priority,
    status = excluded.status,
    clinic_id = excluded.clinic_id,
    created_at = excluded.created_at,
    resolved_at = excluded.resolved_at,
    updated_at = excluded.updated_at,
    caller_phone = excluded.caller_phone,
    caller_state = excluded.caller_state,
    patient_id = excluded.patient_id,
    title = excluded.title,
    summary = excluded.summary,
    appointment_type_id = excluded.appointment_type_id,
    confidence = excluded.confidence,
    rule_decision = excluded.rule_decision,
    rule_reasons = excluded.rule_reasons,
    assigned_to = excluded.assigned_to,
    resolved_by = excluded.resolved_by,
    notes = excluded.notes,
    source = excluded.source,
    lock_mode = excluded.lock_mode,
    lock_assigned_at = excluded.lock_assigned_at,
    lock_last_activity_at = excluded.lock_last_activity_at,
    lock_session_ended_at = excluded.lock_session_ended_at,
    draft_notes = excluded.draft_notes,
    callback_attempts = excluded.callback_attempts
`

export function repoLoadAllQueueItems(): QueueItem[] {
  if (!persistenceEnabled()) return []
  const rows = getDb().prepare(SELECT_ALL).all() as QueueRow[]
  return rows.map(rowToItem)
}

export function repoGetQueueItem(id: string): QueueItem | undefined {
  if (!persistenceEnabled()) return undefined
  const row = getDb().prepare('SELECT * FROM queue_items WHERE id = ?').get(id) as QueueRow | undefined
  return row ? rowToItem(row) : undefined
}

export function repoUpsertQueueItem(item: QueueItem): void {
  if (!persistenceEnabled()) return
  getDb().prepare(UPSERT).run(itemToParams(item))
}

export function repoUpsertQueueItems(items: QueueItem[]): void {
  if (!persistenceEnabled() || items.length === 0) return
  runInTransaction(() => {
    const stmt = getDb().prepare(UPSERT)
    for (const item of items) stmt.run(itemToParams(item))
  })
}

export function repoUpdateQueueItem(id: string, patch: Partial<QueueItem>): QueueItem | undefined {
  if (!persistenceEnabled()) return undefined
  const existing = repoGetQueueItem(id)
  if (!existing) return undefined
  const updated: QueueItem = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  repoUpsertQueueItem(updated)
  return updated
}

/** J-8: release queue locks held by a deactivated user. */
export function repoReleaseLocksForUser(userId: string): number {
  if (!persistenceEnabled()) return 0
  const now = new Date().toISOString()
  const result = getDb().prepare(`
    UPDATE queue_items
    SET assigned_to = NULL,
        lock_mode = NULL,
        lock_assigned_at = NULL,
        lock_last_activity_at = NULL,
        lock_session_ended_at = NULL,
        updated_at = ?
    WHERE assigned_to = ?
  `).run(now, userId)
  return result.changes
}

export function repoQueueIsEmpty(): boolean {
  if (!persistenceEnabled()) return true
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM queue_items').get() as { c: number }
  return row.c === 0
}

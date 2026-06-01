import type { AuditEvent, AuditAction, AuditStatus } from '@/lib/audit/types'
import { getDb, persistenceEnabled } from '@/lib/db/client'

type AuditRow = {
  id: string
  timestamp: string
  action: string
  status: string
  actor_user_id: string
  actor_name: string
  actor_role: string
  actor_email: string
  clinic_id: string
  patient_ref: string | null
  queue_item_ref: string | null
  metadata: string | null
  summary: string
}

function rowToEvent(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    action: row.action as AuditAction,
    status: row.status as AuditStatus,
    actor: {
      userId: row.actor_user_id,
      name: row.actor_name,
      role: row.actor_role,
      email: row.actor_email,
    },
    clinicId: row.clinic_id,
    patientRef: row.patient_ref ?? undefined,
    queueItemRef: row.queue_item_ref ?? undefined,
    metadata: row.metadata ? (JSON.parse(row.metadata) as AuditEvent['metadata']) : undefined,
    summary: row.summary,
  }
}

const INSERT = `
  INSERT INTO audit_events (
    id, timestamp, action, status,
    actor_user_id, actor_name, actor_role, actor_email,
    clinic_id, patient_ref, queue_item_ref, metadata, summary
  ) VALUES (
    @id, @timestamp, @action, @status,
    @actorUserId, @actorName, @actorRole, @actorEmail,
    @clinicId, @patientRef, @queueItemRef, @metadata, @summary
  )
`

export function repoInsertAuditEvent(event: AuditEvent): void {
  if (!persistenceEnabled()) return
  getDb().prepare(INSERT).run({
    id: event.id,
    timestamp: event.timestamp,
    action: event.action,
    status: event.status,
    actorUserId: event.actor.userId,
    actorName: event.actor.name,
    actorRole: event.actor.role,
    actorEmail: event.actor.email,
    clinicId: event.clinicId,
    patientRef: event.patientRef ?? null,
    queueItemRef: event.queueItemRef ?? null,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    summary: event.summary,
  })
}

export function repoLoadAuditEvents(filters?: {
  clinicId?: string
  clinicIds?: string[]
  userId?: string
  action?: AuditAction
  limit?: number
}): AuditEvent[] {
  if (!persistenceEnabled()) return []

  const clauses: string[] = []
  const params: Record<string, string | number> = {}

  if (filters?.clinicIds && filters.clinicIds.length > 0) {
    clauses.push(`clinic_id IN (${filters.clinicIds.map((_, i) => `@cid${i}`).join(', ')})`)
    filters.clinicIds.forEach((id, i) => { params[`cid${i}`] = id })
  } else if (filters?.clinicId) {
    clauses.push('clinic_id = @clinicId')
    params.clinicId = filters.clinicId
  }
  if (filters?.userId) {
    clauses.push('actor_user_id = @userId')
    params.userId = filters.userId
  }
  if (filters?.action) {
    clauses.push('action = @action')
    params.action = filters.action
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = filters?.limit ?? 100
  params.limit = limit

  const rows = getDb().prepare(`
    SELECT * FROM audit_events
    ${where}
    ORDER BY timestamp DESC
    LIMIT @limit
  `).all(params) as AuditRow[]

  return rows.map(rowToEvent)
}

export function repoCountAuditEvents(opts?: { clinicId?: string; clinicIds?: string[] }): number {
  if (!persistenceEnabled()) return 0

  if (opts?.clinicIds && opts.clinicIds.length > 0) {
    const placeholders = opts.clinicIds.map((_, i) => `@cid${i}`).join(', ')
    const params: Record<string, string> = {}
    opts.clinicIds.forEach((id, i) => { params[`cid${i}`] = id })
    const row = getDb().prepare(
      `SELECT COUNT(*) AS c FROM audit_events WHERE clinic_id IN (${placeholders})`,
    ).get(params) as { c: number }
    return row.c
  }

  if (opts?.clinicId) {
    const row = getDb().prepare(
      'SELECT COUNT(*) AS c FROM audit_events WHERE clinic_id = ?',
    ).get(opts.clinicId) as { c: number }
    return row.c
  }

  const row = getDb().prepare('SELECT COUNT(*) AS c FROM audit_events').get() as { c: number }
  return row.c
}

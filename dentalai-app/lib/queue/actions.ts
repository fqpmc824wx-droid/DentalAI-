'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import {
  requireSession,
  assertClinicAccessWithReason,
  AccessDeniedError,
  AccessReasonRequiredError,
} from '@/lib/access'
import { getQueueItem, updateQueueItem } from './store'
import {
  hardLockPatch,
  releaseLockPatch,
  softClaimPatch,
} from './ownership'
import { validatePassReason } from './colleague-presence'
import { getUserById } from '@/lib/users/store'
import { logAuditEvent } from '@/lib/audit/store'
import { assertActionPermitted, assertBookingMutationPermitted, PermissionDeniedError } from './permissions'
import type { AppointmentTypeId } from '@/lib/rules/types'
import { isTerminalQueueStatus } from './types'
import {
  appendCallbackAttempt,
  evaluateAttemptEligibility,
  resolveStatusAfterAttempt,
  RESOLVING_CALLBACK_OUTCOMES,
  type CallbackAttemptOutcome,
} from './callback-tracker'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

// ── Input schemas ─────────────────────────────────────────────────────────────

const ItemIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'Invalid item ID format')

const NotesSchema = z.string().max(2000).optional()

const EmergencyOutcomeSchema = z.object({
  outcome: z.enum(['contacted', 'unable_to_reach', 'transferred', 'escalated_to_manager', 'false_positive']),
  notes: z.string().min(5, 'Emergency outcome requires notes (minimum 5 characters)').max(2000),
})

const ModifySchema = z.object({
  notes: z.string().max(2000).optional(),
  appointmentTypeId: z.enum([
    'new_patient_consult', 'routine_checkup', 'hygiene', 'emergency',
    'implant_consult', 'invisalign_consult', 'whitening_consult',
  ]).optional(),
})

const RejectSchema = z.object({
  reason: z.string().max(2000).optional(),
})

// ── Shared helper ─────────────────────────────────────────────────────────────

type SessionActor = Awaited<ReturnType<typeof requireSession>>
type QueueItemRecord = NonNullable<ReturnType<typeof getQueueItem>>

async function getActorAndItem(
  itemId: string,
  accessReason?: string,
): Promise<
  | { ok: true; actor: SessionActor; item: QueueItemRecord }
  | { ok: false; error: string }
> {
  // Validate itemId format
  const parsed = ItemIdSchema.safeParse(itemId)
  if (!parsed.success) return { ok: false, error: 'Invalid item ID' }

  const actor = await requireSession()
  const item = getQueueItem(itemId)

  if (!item) return { ok: false, error: 'Queue item not found' }

  try {
    assertClinicAccessWithReason(actor, item.clinicId, accessReason, {
      queueItemRef: itemId,
      patientRef: item.patientId,
    })
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      logAuditEvent({
        action: 'access.denied',
        status: 'failure',
        actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
        clinicId: item.clinicId,
        queueItemRef: itemId,
        summary: `Access denied — ${actor.name} attempted to act on a queue item outside their clinic`,
        metadata: { attemptedClinicId: item.clinicId, actorClinicId: actor.clinicId },
      })
      return { ok: false, error: 'You do not have permission to action this item' }
    }
    if (err instanceof AccessReasonRequiredError) {
      logAuditEvent({
        action: 'access.denied',
        status: 'failure',
        actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
        clinicId: item.clinicId,
        queueItemRef: itemId,
        summary: `Access blocked — ${actor.name} must document cross-estate access`,
        metadata: { reason: 'access_reason_required', attemptedClinicId: item.clinicId },
      })
      return {
        ok: false,
        error: 'Document why you are accessing this clinic (minimum 5 characters)',
      }
    }
    throw err
  }

  if (isTerminalQueueStatus(item.status)) {
    logAuditEvent({
      action: 'access.denied',
      status: 'failure',
      actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
      clinicId: item.clinicId,
      queueItemRef: itemId,
      patientRef: item.patientId,
      summary: `Action blocked — ${item.title} is already closed`,
      metadata: { itemStatus: item.status, reason: 'terminal_state' },
    })
    return { ok: false, error: 'This item is already closed and cannot be changed' }
  }

  return { ok: true, actor, item }
}

function checkActionPermission(
  actor: SessionActor,
  item: QueueItemRecord,
  action: Parameters<typeof assertActionPermitted>[2],
): ActionResult | null {
  try {
    assertActionPermitted(actor.role, item.type, action)
    return null
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      logAuditEvent({
        action: 'access.denied',
        status: 'failure',
        actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
        clinicId: item.clinicId,
        queueItemRef: item.id,
        summary: `Permission denied — ${actor.name} cannot perform "${action}" on ${item.type}`,
        metadata: { action, itemType: item.type, reason: err.reason },
      })
      return { ok: false, error: err.message }
    }
    throw err
  }
}

function checkBookingMutationPermission(
  actor: SessionActor,
  item: QueueItemRecord,
  action: 'approve_request' | 'reject_request' | 'modify_request',
): ActionResult | null {
  try {
    assertBookingMutationPermitted(actor.role, item.type, item.ruleDecision, action)
    return null
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      logAuditEvent({
        action: 'access.denied',
        status: 'failure',
        actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
        clinicId: item.clinicId,
        queueItemRef: item.id,
        summary: `Permission denied — ${actor.name} cannot perform "${action}" on ${item.type}`,
        metadata: {
          action,
          itemType: item.type,
          reason: err.reason,
          ...(item.ruleDecision ? { ruleDecision: item.ruleDecision } : {}),
        },
      })
      return { ok: false, error: err.message }
    }
    throw err
  }
}

function revalidateAll() {
  revalidatePath('/queue')
  revalidatePath('/audit')
  revalidatePath('/dashboard')
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function acknowledgeQueueItem(
  itemId: string,
  accessReason?: string,
): Promise<ActionResult> {
  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkActionPermission(actor, item, 'acknowledge')
  if (denied) return denied

  updateQueueItem(itemId, { status: 'acknowledged' })
  logAuditEvent({
    action: 'queue.task_acknowledged',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} acknowledged: ${item.title}`,
    metadata: { type: item.type, priority: item.priority },
  })
  revalidateAll()
  return { ok: true }
}

export async function approveQueueItem(
  itemId: string,
  accessReason?: string,
): Promise<ActionResult> {
  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkBookingMutationPermission(actor, item, 'approve_request')
  if (denied) return denied

  updateQueueItem(itemId, {
    status: 'approved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor.userId,
  })
  logAuditEvent({
    action: 'booking.request_approved',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} approved request: ${item.title}`,
    metadata: { type: item.type, priority: item.priority, confidence: item.confidence },
  })
  revalidateAll()
  return { ok: true }
}

export async function rejectQueueItem(
  itemId: string,
  rawReason?: string,
  accessReason?: string,
): Promise<ActionResult> {
  const reasonParsed = RejectSchema.safeParse({ reason: rawReason })
  if (!reasonParsed.success) return { ok: false, error: 'Invalid rejection reason' }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkBookingMutationPermission(actor, item, 'reject_request')
  if (denied) return denied

  updateQueueItem(itemId, {
    status: 'rejected',
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor.userId,
    notes: reasonParsed.data.reason,
  })
  logAuditEvent({
    action: 'booking.request_rejected',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} rejected request: ${item.title}`,
    metadata: { type: item.type, priority: item.priority, hasReason: !!reasonParsed.data.reason },
  })
  revalidateAll()
  return { ok: true }
}

export async function resolveQueueItem(
  itemId: string,
  rawNotes?: string,
  accessReason?: string,
): Promise<ActionResult> {
  const notesParsed = NotesSchema.safeParse(rawNotes)
  if (!notesParsed.success) return { ok: false, error: 'Notes too long (max 2000 characters)' }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r

  // Defense-in-depth: emergency items must use recordEmergencyOutcome, never generic resolve.
  // The permissions matrix already blocks this — this is a second guard.
  if (item.type === 'emergency') {
    return { ok: false, error: 'Emergency items require a typed outcome — use recordEmergencyOutcome instead' }
  }
  // Booking requests must use approve/reject/modify, never generic resolve.
  if (item.type === 'booking_request') {
    return { ok: false, error: 'Booking requests require approve/reject/modify — generic resolve is not allowed' }
  }

  const denied = checkActionPermission(actor, item, 'resolve')
  if (denied) return denied

  updateQueueItem(itemId, {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor.userId,
    notes: notesParsed.data,
  })
  logAuditEvent({
    action: 'queue.task_resolved',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} resolved: ${item.title}`,
    metadata: { type: item.type, priority: item.priority },
  })
  revalidateAll()
  return { ok: true }
}

export async function escalateQueueItem(
  itemId: string,
  rawReason: string,
  accessReason?: string,
): Promise<ActionResult> {
  const reasonParsed = z.string().min(1).max(2000).safeParse(rawReason)
  if (!reasonParsed.success) return { ok: false, error: 'Escalation reason is required' }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkActionPermission(actor, item, 'escalate')
  if (denied) return denied

  updateQueueItem(itemId, { status: 'escalated', notes: reasonParsed.data })
  logAuditEvent({
    action: 'queue.task_escalated',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} escalated: ${item.title}`,
    metadata: { type: item.type, priority: item.priority },
  })
  revalidateAll()
  return { ok: true }
}

const CallbackOutcomeSchema = z.enum([
  'answered_resolved',
  'answered_refer_manager',
  'no_answer',
  'left_voicemail',
  'wrong_number',
  'patient_called_back',
])

export async function logCallbackAttempt(
  itemId: string,
  rawOutcome: string,
  rawNotes?: string,
  accessReason?: string,
): Promise<ActionResult> {
  const outcomeParsed = CallbackOutcomeSchema.safeParse(rawOutcome)
  if (!outcomeParsed.success) return { ok: false, error: 'Select a valid callback attempt outcome' }

  const notesParsed = NotesSchema.safeParse(rawNotes)
  if (!notesParsed.success) return { ok: false, error: 'Notes too long (max 2000 characters)' }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const eligibility = evaluateAttemptEligibility(item, { outcome: outcomeParsed.data })
  if (!eligibility.allowed) {
    return { ok: false, error: eligibility.errors[0] ?? 'Cannot log callback attempt' }
  }

  const outcome = outcomeParsed.data
  const permissionAction =
    outcome === 'answered_resolved' || outcome === 'patient_called_back'
      ? 'callback'
      : 'callback_unable'
  const denied = checkActionPermission(actor, item, permissionAction)
  if (denied) return denied

  const attempts = appendCallbackAttempt({
    item,
    outcome,
    byUserId: actor.userId,
    byName: actor.name,
    notes: notesParsed.data,
  })
  const newStatus = resolveStatusAfterAttempt(outcome)
  updateQueueItem(itemId, {
    status: newStatus,
    callbackAttempts: attempts,
    notes: notesParsed.data ?? item.notes,
    resolvedBy:
      newStatus === 'resolved' || newStatus === 'escalated' ? actor.userId : item.resolvedBy,
    ...(newStatus === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
  })
  logAuditEvent({
    action: RESOLVING_CALLBACK_OUTCOMES.has(outcome)
      ? 'queue.task_callback_attempted'
      : 'queue.task_unable_to_reach',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} callback attempt — ${outcome.replace(/_/g, ' ')}: ${item.title}`,
    metadata: { type: item.type, outcome, attemptNumber: attempts.length },
  })
  revalidateAll()
  return { ok: true }
}

export async function recordCallbackAttempt(
  itemId: string,
  outcome: 'reached' | 'unable_to_reach',
  rawNotes?: string,
  accessReason?: string,
): Promise<ActionResult> {
  const mapped: CallbackAttemptOutcome =
    outcome === 'reached' ? 'answered_resolved' : 'no_answer'
  return logCallbackAttempt(itemId, mapped, rawNotes, accessReason)
}

export async function recordEmergencyOutcome(
  itemId: string,
  rawOutcome: string,
  rawNotes: string,
  accessReason?: string,
): Promise<ActionResult> {
  const parsed = EmergencyOutcomeSchema.safeParse({ outcome: rawOutcome, notes: rawNotes })
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid emergency outcome'
    return { ok: false, error: msg }
  }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkActionPermission(actor, item, 'emergency_outcome')
  if (denied) return denied

  const { outcome, notes } = parsed.data
  updateQueueItem(itemId, {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor.userId,
    notes: `[${outcome.toUpperCase()}] ${notes}`,
  })
  logAuditEvent({
    action: 'queue.emergency_outcome_recorded',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} recorded emergency outcome: ${outcome}`,
    metadata: { type: item.type, outcome, hasNotes: true },
  })
  revalidateAll()
  return { ok: true }
}

export async function modifyAndApproveQueueItem(
  itemId: string,
  rawMods: { notes?: string; appointmentTypeId?: string },
  accessReason?: string,
): Promise<ActionResult> {
  const parsed = ModifySchema.safeParse(rawMods)
  if (!parsed.success) return { ok: false, error: 'Invalid modification data' }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkBookingMutationPermission(actor, item, 'modify_request')
  if (denied) return denied

  updateQueueItem(itemId, {
    status: 'approved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor.userId,
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    ...(parsed.data.appointmentTypeId
      ? { appointmentTypeId: parsed.data.appointmentTypeId as AppointmentTypeId }
      : {}),
  })
  logAuditEvent({
    action: 'booking.request_modified',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} modified and approved request: ${item.title}`,
    metadata: { type: item.type, priority: item.priority },
  })
  revalidateAll()
  return { ok: true }
}

/** S100 — soft claim without inactivity timeout until open (D-2). */
export async function softClaimQueueItem(
  itemId: string,
  accessReason?: string,
): Promise<ActionResult> {
  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkActionPermission(actor, item, 'acknowledge')
  if (denied) return denied

  if (item.assignedTo && item.assignedTo !== actor.userId && item.lockMode === 'hard_lock') {
    return { ok: false, error: 'Another staff member is working this item' }
  }

  const now = new Date().toISOString()
  updateQueueItem(itemId, {
    ...softClaimPatch(actor.userId, now),
    status: item.status === 'pending' ? 'acknowledged' : item.status,
  })
  logAuditEvent({
    action: 'queue.task_acknowledged',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} soft-claimed: ${item.title}`,
    metadata: { type: item.type, lockMode: 'soft_claim' },
  })
  revalidateAll()
  return { ok: true }
}

/** @deprecated Use softClaimQueueItem — kept as alias for existing UI. */
export async function claimQueueItem(
  itemId: string,
  accessReason?: string,
): Promise<ActionResult> {
  return softClaimQueueItem(itemId, accessReason)
}

export async function releaseQueueItem(
  itemId: string,
  accessReason?: string,
): Promise<ActionResult> {
  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r

  if (!item.assignedTo) return { ok: true }
  if (item.assignedTo !== actor.userId) {
    return { ok: false, error: 'You do not hold the lock on this item' }
  }

  updateQueueItem(itemId, releaseLockPatch(item, item.notes))
  logAuditEvent({
    action: 'queue.task_acknowledged',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} released lock on: ${item.title}`,
    metadata: { type: item.type, lockRelease: true },
  })
  revalidateAll()
  return { ok: true }
}

/** S099 — refresh hard-lock activity while detail is open (D-1). */
export async function touchQueueLockActivity(
  itemId: string,
  accessReason?: string,
): Promise<ActionResult> {
  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  if (item.assignedTo !== actor.userId || item.lockMode !== 'hard_lock') {
    return { ok: true }
  }

  updateQueueItem(itemId, {
    lockLastActivityAt: new Date().toISOString(),
    lockSessionEndedAt: undefined,
  })
  return { ok: true }
}

/** S101 — pass lock to same-clinic colleague (D-3). */
export async function passQueueItemToColleague(
  itemId: string,
  targetUserId: string,
  rawReason: string,
  accessReason?: string,
): Promise<ActionResult> {
  const reasonCheck = validatePassReason(rawReason)
  if (!reasonCheck.ok) return { ok: false, error: reasonCheck.error! }

  const targetParsed = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).safeParse(targetUserId)
  if (!targetParsed.success) return { ok: false, error: 'Invalid colleague' }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  if (item.assignedTo !== actor.userId) {
    return { ok: false, error: 'You must hold the lock to pass this item' }
  }

  const target = getUserById(targetParsed.data)
  if (!target || !target.clinicIds.includes(item.clinicId)) {
    return { ok: false, error: 'Colleague must belong to this clinic' }
  }
  if (target.id === actor.userId) {
    return { ok: false, error: 'Choose a different colleague' }
  }

  const now = new Date().toISOString()
  updateQueueItem(itemId, {
    ...hardLockPatch(target.id, now),
    notes: item.notes,
  })

  logAuditEvent({
    action: 'queue.task_escalated',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} passed ${item.title} to ${target.name}`,
    metadata: {
      type: item.type,
      passTo: target.id,
      passToName: target.name,
      reason: rawReason.trim(),
    },
  })
  revalidateAll()
  return { ok: true }
}

/** S102 — mark session ended for delayed lock release (D-4). */
export async function markQueueSessionEnded(
  itemId: string,
  accessReason?: string,
): Promise<ActionResult> {
  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  if (item.assignedTo !== actor.userId || item.lockMode !== 'hard_lock') {
    return { ok: true }
  }

  updateQueueItem(itemId, { lockSessionEndedAt: new Date().toISOString() })
  return { ok: true }
}

export async function saveQueueWorkingNotes(
  itemId: string,
  rawNotes: string,
  accessReason?: string,
): Promise<ActionResult> {
  const notesParsed = NotesSchema.safeParse(rawNotes)
  if (!notesParsed.success) return { ok: false, error: 'Notes too long (max 2000 characters)' }

  const r = await getActorAndItem(itemId, accessReason)
  if (!r.ok) return r

  const { actor, item } = r
  const denied = checkActionPermission(actor, item, 'acknowledge')
  if (denied) return denied

  updateQueueItem(itemId, { notes: notesParsed.data })
  logAuditEvent({
    action: 'queue.task_acknowledged',
    status: 'success',
    actor: { userId: actor.userId, name: actor.name, role: actor.role, email: actor.email },
    clinicId: item.clinicId,
    queueItemRef: itemId,
    patientRef: item.patientId,
    summary: `${actor.name} updated working notes on: ${item.title}`,
    metadata: { type: item.type, notesUpdated: true },
  })
  revalidateAll()
  return { ok: true }
}

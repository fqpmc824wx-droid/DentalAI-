import type { AuditAction } from './types'

/** Canonical audit action taxonomy — new actions must be added here and to AuditAction. */
export const AUDIT_ACTION_TAXONOMY: readonly AuditAction[] = [
  'auth.login',
  'auth.logout',
  'auth.login_failed',
  'auth.invite_created',
  'auth.invite_accepted',
  'auth.password_reset_requested',
  'auth.password_reset_completed',
  'auth.account_deactivated',
  'auth.mfa_verified',
  'auth.mfa_failed',
  'auth.mfa_required',
  'access.denied',
  'access.reason_logged',
  'booking.request_created',
  'booking.request_approved',
  'booking.request_rejected',
  'booking.request_modified',
  'booking.cancelled',
  'queue.task_acknowledged',
  'queue.task_resolved',
  'queue.task_escalated',
  'queue.task_callback_attempted',
  'queue.task_unable_to_reach',
  'queue.patient_called_back_handled',
  'queue.emergency_outcome_recorded',
  'patient.identity_confirmed',
  'patient.identity_uncertain',
  'patient.identity_review_required',
  'admin.rules_updated',
  'dentally.read.health',
  'dentally.read.user',
  'dentally.read.practice',
  'dentally.read.sites',
  'dentally.read.patient',
  'dentally.read.patient_search',
  'dentally.read.appointments',
  'dentally.read.treatment_appointments',
  'dentally.read.treatment_plans',
  'dentally.read.treatment_plan_items',
  'dentally.read.financial',
  'dentally.read.patient_context',
  'system.error',
] as const

const TAXONOMY_SET = new Set<string>(AUDIT_ACTION_TAXONOMY)

export class UnknownAuditActionError extends Error {
  constructor(action: string) {
    super(`Unknown audit action: ${action}`)
    this.name = 'UnknownAuditActionError'
  }
}

export function assertKnownAuditAction(action: string): asserts action is AuditAction {
  if (!TAXONOMY_SET.has(action)) {
    throw new UnknownAuditActionError(action)
  }
}

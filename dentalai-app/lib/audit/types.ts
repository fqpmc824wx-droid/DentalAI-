export type AuditAction =
  // Auth
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.invite_created'
  | 'auth.invite_accepted'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'auth.account_deactivated'
  | 'auth.mfa_verified'
  | 'auth.mfa_failed'
  | 'auth.mfa_required'
  // Access control
  | 'access.denied'
  | 'access.reason_logged'
  // Booking
  | 'booking.request_created'
  | 'booking.request_approved'
  | 'booking.request_rejected'
  | 'booking.request_modified'
  | 'booking.cancelled'
  // Queue
  | 'queue.task_acknowledged'
  | 'queue.task_resolved'
  | 'queue.task_escalated'
  | 'queue.task_callback_attempted'
  | 'queue.task_unable_to_reach'
  | 'queue.patient_called_back_handled'
  | 'queue.emergency_outcome_recorded'
  // Patient identity
  | 'patient.identity_confirmed'
  | 'patient.identity_uncertain'
  | 'patient.identity_review_required'
  // Rules
  | 'admin.rules_updated'
  // Dentally read-only (Phase 2). Reads NEVER include the token, PHI, or
  // raw response bodies — only category, durationMs, resource, and actor.
  | 'dentally.read.health'
  | 'dentally.read.user'
  | 'dentally.read.practice'
  | 'dentally.read.sites'
  | 'dentally.read.patient'
  | 'dentally.read.patient_search'
  | 'dentally.read.appointments'
  | 'dentally.read.treatment_appointments'
  | 'dentally.read.treatment_plans'
  | 'dentally.read.treatment_plan_items'
  | 'dentally.read.financial'
  | 'dentally.read.patient_context'
  // System
  | 'system.error'

export type AuditStatus = 'success' | 'failure' | 'pending'

export type AuditActor = {
  userId: string
  name: string
  role: string
  email: string
}

export type AuditEvent = {
  id: string
  timestamp: string          // ISO string
  action: AuditAction
  status: AuditStatus
  actor: AuditActor
  clinicId: string
  patientRef?: string        // patient ID only — never a name
  queueItemRef?: string      // queue item ID only
  metadata?: Record<string, string | number | boolean>
  summary: string            // human-readable one-liner — no PII
}

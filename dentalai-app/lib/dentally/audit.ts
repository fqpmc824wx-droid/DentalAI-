import 'server-only'

/**
 * Dentally read audit emitter — Phase 2.23 close.
 *
 * Every Dentally read goes through this helper so the audit store reflects:
 *   - which Dentally resource was read
 *   - which actor (or "system" for background health probes)
 *   - which clinic (or 'group' / 'system' for non-clinic-scoped reads)
 *   - durationMs
 *   - whether it succeeded
 *   - error category if it failed
 *   - safe non-PII metadata (resource IDs only, never names/DOBs/balances)
 *
 * What this helper guarantees:
 *   - NEVER logs the Dentally token.
 *   - NEVER logs raw Dentally response bodies.
 *   - NEVER logs patient names, phone numbers, DOBs, or balances.
 *   - Logs only what the audit store contract already accepts.
 *
 * It is intentionally optional in tests: when the audit store isn't seeded
 * (which happens in unit tests for the read services themselves), emitting
 * still works — it just appends to the in-memory store.
 */

import { logAuditEvent } from '@/lib/audit/store'
import type { AuditAction, AuditActor } from '@/lib/audit/types'
import type { SessionActor } from '@/lib/access-control'
import type { DentallyErrorCategory } from './errors'

/** Resources mapped to their audit action. */
export type DentallyAuditResource =
  | 'health'
  | 'user'
  | 'practice'
  | 'sites'
  | 'patient'
  | 'patient_search'
  | 'appointments'
  | 'treatment_appointments'
  | 'treatment_plans'
  | 'treatment_plan_items'
  | 'financial'
  | 'patient_context'

const RESOURCE_ACTIONS: Record<DentallyAuditResource, AuditAction> = {
  health:                 'dentally.read.health',
  user:                   'dentally.read.user',
  practice:               'dentally.read.practice',
  sites:                  'dentally.read.sites',
  patient:                'dentally.read.patient',
  patient_search:         'dentally.read.patient_search',
  appointments:           'dentally.read.appointments',
  treatment_appointments: 'dentally.read.treatment_appointments',
  treatment_plans:        'dentally.read.treatment_plans',
  treatment_plan_items:   'dentally.read.treatment_plan_items',
  financial:              'dentally.read.financial',
  patient_context:        'dentally.read.patient_context',
}

/** Synthetic actor used for system reads (health probes, scheduled checks). */
const SYSTEM_ACTOR: AuditActor = {
  userId: 'system',
  name: 'system',
  role: 'system',
  email: 'system@dentalai.local',
}

export type DentallyReadAuditInput = {
  resource: DentallyAuditResource
  /** Pass a real SessionActor when the read was triggered by a logged-in user. */
  actor?: SessionActor | null
  /** Clinic the read is scoped to. Use 'system' for non-clinic reads. */
  clinicId?: string
  /** Whether the read succeeded. */
  ok: boolean
  /** Duration of the read in ms. */
  durationMs: number
  /** Error category if it failed. */
  category?: DentallyErrorCategory
  /** Optional resource ID (patient ID, site ID, plan ID — never PII). */
  resourceId?: string
  /** Optional additional safe metadata (counts only). */
  counts?: Record<string, number>
}

/**
 * Emit a single Dentally read event into the audit store.
 *
 * Safe to call from any server module. Failures while logging are swallowed
 * so the actual read response is not blocked by an audit-store hiccup.
 */
export function auditDentallyRead(input: DentallyReadAuditInput): void {
  try {
    const action = RESOURCE_ACTIONS[input.resource]
    const actor: AuditActor = input.actor
      ? {
          userId: input.actor.userId,
          name: input.actor.name,
          role: input.actor.role,
          email: input.actor.email,
        }
      : SYSTEM_ACTOR

    const metadata: Record<string, string | number | boolean> = {
      resource: input.resource,
      durationMs: input.durationMs,
      ok: input.ok,
    }
    if (input.category) metadata.category = input.category
    if (input.resourceId) metadata.resourceId = input.resourceId
    if (input.counts) {
      for (const [key, value] of Object.entries(input.counts)) {
        metadata[`count_${key}`] = value
      }
    }

    // Patient-scoped reads use the resourceId as the canonical patientRef
    // so the audit page can filter by patient. Non-patient resources keep
    // the ID in metadata only.
    const PATIENT_SCOPED: DentallyAuditResource[] = [
      'patient',
      'appointments',
      'treatment_appointments',
      'treatment_plans',
      'treatment_plan_items',
      'financial',
      'patient_context',
    ]
    const patientRef = PATIENT_SCOPED.includes(input.resource) ? input.resourceId : undefined

    logAuditEvent({
      action,
      status: input.ok ? 'success' : 'failure',
      actor,
      clinicId: input.clinicId ?? 'system',
      patientRef,
      summary: input.ok
        ? `Dentally read ${input.resource} succeeded in ${input.durationMs}ms`
        : `Dentally read ${input.resource} failed: ${input.category ?? 'unknown'} (${input.durationMs}ms)`,
      metadata,
    })
  } catch {
    // Audit must never break the actual read pipeline. Swallow.
  }
}

/**
 * Pure access-control functions — no Next.js, no next-auth imports.
 * Safe to import in tests and anywhere in the stack.
 *
 * lib/access.ts wraps these with requireSession() for server-component use.
 */

import { logAuditEvent } from '@/lib/audit/store'
import type { Role } from '@/types'

export const ACCESS_REASON_MIN_LENGTH = 5

export type SessionActor = {
  userId: string
  name: string
  email: string
  role: Role
  clinicId: string
  clinicIds: string[]
  mfaVerified?: boolean
}

/**
 * Returns true if the actor can access the given clinic.
 *
 * Rules:
 * - super_admin: all clinics
 * - group_owner: clinics listed in their clinicIds
 * - practice_manager / receptionist: only their own clinicId
 */
export function canAccessClinic(actor: SessionActor, clinicId: string): boolean {
  if (actor.role === 'super_admin') return true
  return actor.clinicIds.includes(clinicId)
}

/**
 * Throws AccessDeniedError if the actor cannot access the given clinic.
 */
export function assertClinicAccess(actor: SessionActor, clinicId: string): void {
  if (!canAccessClinic(actor, clinicId)) {
    throw new AccessDeniedError(actor.userId, clinicId)
  }
}

/**
 * Super-admin cross-estate access: clinic outside the actor's assigned clinicIds.
 * Requires a human access reason (min 5 chars) and append-only audit.
 */
export function requiresAccessReason(actor: SessionActor, clinicId: string): boolean {
  return actor.role === 'super_admin' && !actor.clinicIds.includes(clinicId)
}

export class AccessReasonRequiredError extends Error {
  public readonly userId: string
  public readonly clinicId: string

  constructor(userId: string, clinicId: string) {
    super(`Access reason required: user ${userId} must document why they accessed clinic ${clinicId}`)
    this.name = 'AccessReasonRequiredError'
    this.userId = userId
    this.clinicId = clinicId
  }
}

export function logAccessReason(
  actor: SessionActor,
  clinicId: string,
  reason: string,
  context?: { queueItemRef?: string; patientRef?: string },
): void {
  const trimmed = reason.trim()
  logAuditEvent({
    action: 'access.reason_logged',
    status: 'success',
    actor: {
      userId: actor.userId,
      name: actor.name,
      role: actor.role,
      email: actor.email,
    },
    clinicId,
    queueItemRef: context?.queueItemRef,
    patientRef: context?.patientRef,
    summary: `${actor.name} documented cross-estate access`,
    metadata: {
      reasonLength: trimmed.length,
      crossEstate: true,
    },
  })
}

/**
 * Clinic access plus mandatory access-reason audit for super-admin cross-estate use.
 */
export function assertClinicAccessWithReason(
  actor: SessionActor,
  clinicId: string,
  accessReason?: string,
  context?: { queueItemRef?: string; patientRef?: string },
): void {
  assertClinicAccess(actor, clinicId)

  if (!requiresAccessReason(actor, clinicId)) return

  const reason = accessReason?.trim() ?? ''
  if (reason.length < ACCESS_REASON_MIN_LENGTH) {
    throw new AccessReasonRequiredError(actor.userId, clinicId)
  }

  logAccessReason(actor, clinicId, reason, context)
}

export class AccessDeniedError extends Error {
  public readonly userId: string
  public readonly clinicId: string

  constructor(userId: string, clinicId: string) {
    super(`Access denied: user ${userId} cannot access clinic ${clinicId}`)
    this.name = 'AccessDeniedError'
    this.userId = userId
    this.clinicId = clinicId
  }
}

/**
 * Returns all clinic IDs the actor can see.
 */
export function accessibleClinics(actor: SessionActor): string[] {
  return actor.clinicIds
}

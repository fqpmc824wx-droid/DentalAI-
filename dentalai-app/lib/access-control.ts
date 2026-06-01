/**
 * Pure access-control functions — no Next.js, no next-auth imports.
 * Safe to import in tests and anywhere in the stack.
 *
 * lib/access.ts wraps these with requireSession() for server-component use.
 */

import type { Role } from '@/types'

export type SessionActor = {
  userId: string
  name: string
  email: string
  role: Role
  clinicId: string
  clinicIds: string[]
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

/**
 * Server-side access helpers.
 * Pure access-control logic lives in lib/access-control.ts (no Next.js deps — safe to test).
 * This file adds requireSession() which needs next-auth and next/navigation.
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { SessionActor } from '@/lib/access-control'

// Re-export everything from the pure module so callers only need one import
export {
  canAccessClinic,
  assertClinicAccess,
  assertClinicAccessWithReason,
  requiresAccessReason,
  logAccessReason,
  accessibleClinics,
  AccessDeniedError,
  AccessReasonRequiredError,
  ACCESS_REASON_MIN_LENGTH,
} from '@/lib/access-control'
export type { SessionActor } from '@/lib/access-control'

/**
 * Returns the current session actor or redirects to /login if unauthenticated.
 * Use this in server actions and server components.
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id || new Date(session.expires).getTime() <= Date.now()) {
    redirect('/login')
  }
  if (
    session.user.role === 'super_admin' &&
    session.user.mfaVerified === false
  ) {
    redirect('/login?mfa=required')
  }
  const actor: SessionActor = {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    clinicId: session.user.clinicId,
    clinicIds: session.user.clinicIds ?? [session.user.clinicId],
    mfaVerified: session.user.mfaVerified,
  }
  return actor
}

'use server'

import { signOut } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit/store'
import { releaseSessionLocksForUser } from '@/lib/queue/ownership-service'
import { getQueueItemsForClinics } from '@/lib/queue/store'
import { buildPersonalShiftSummary } from '@/lib/queue/shift-summary'

export async function logoutAction(): Promise<void> {
  const session = await auth()

  if (session?.user) {
    releaseSessionLocksForUser(session.user.id)
    const items = getQueueItemsForClinics(session.user.clinicIds ?? [session.user.clinicId])
    const shift = buildPersonalShiftSummary({
      actorUserId: session.user.id,
      items,
    })
    logAuditEvent({
      action: 'auth.logout',
      status: 'success',
      actor: {
        userId: session.user.id,
        name: session.user.name,
        role: session.user.role,
        email: session.user.email,
      },
      clinicId: session.user.clinicId,
      summary: `${session.user.name} signed out — ${shift.message}`,
      metadata: {
        role: session.user.role,
        itemsResolved: shift.itemsResolved,
        itemsTouched: shift.itemsTouched,
        callbacksLogged: shift.callbacksLogged,
      },
    })
  }

  await signOut({ redirectTo: '/login' })
}

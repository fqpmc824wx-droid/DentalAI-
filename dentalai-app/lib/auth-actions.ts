'use server'

import { signOut } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit/store'

export async function logoutAction(): Promise<void> {
  const session = await auth()

  if (session?.user) {
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
      summary: `${session.user.name} signed out`,
      metadata: { role: session.user.role },
    })
  }

  await signOut({ redirectTo: '/login' })
}

import { requireSession } from '@/lib/access'
import { getClinic } from '@/lib/mock/clinics'
import { getQueueCountsForClinics } from '@/lib/queue/store'
import AppShell from '@/components/AppShell'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await requireSession()
  const clinic = getClinic(actor.clinicId)
  const queueCounts = getQueueCountsForClinics(actor.clinicIds)

  return (
    <AppShell
      user={{
        id: actor.userId,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        clinicId: actor.clinicId,
        clinicIds: actor.clinicIds,
      }}
      clinic={clinic}
      queuePending={queueCounts.pending}
      queueUrgent={queueCounts.urgent}
    >
      {children}
    </AppShell>
  )
}

import { requireSession } from '@/lib/access'
import { canManageRole, canManageStaff } from '@/lib/users/permissions'
import { listStaffForActor } from '@/lib/users/actions'
import { StaffInviteForm, StaffList } from '@/components/StaffManagement'
import { PageShell, PageHeader, Banner, PageFoot } from '@/components/calm'
import { redirect } from 'next/navigation'
import type { Role } from '@/types'

export default async function StaffPage() {
  const actor = await requireSession()
  if (!canManageStaff(actor)) redirect('/dashboard')

  const users = await listStaffForActor()
  const allowedRoles: Role[] = (['receptionist', 'practice_manager', 'group_owner', 'super_admin'] as Role[])
    .filter(r => canManageRole(actor, r))

  return (
    <PageShell>
      <PageHeader
        title={<>Staff <em>accounts</em>.</>}
        sub="Invitations, deactivation, and session revocation — manager or group owner only"
      />

      <Banner tone="info">
        Invitations expire after 72 hours. Password reset links last 30 minutes. Deactivation revokes active sessions and releases queue locks.
      </Banner>

      <StaffInviteForm clinicId={actor.clinicId} allowedRoles={allowedRoles} />

      <div style={{ marginTop: 32 }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
        }}>
          {users.length} accounts in scope
        </p>
        <StaffList users={users} canDeactivate />
      </div>

      <PageFoot status="Hashed credentials · append-only audit · J-7 / J-8" />
    </PageShell>
  )
}

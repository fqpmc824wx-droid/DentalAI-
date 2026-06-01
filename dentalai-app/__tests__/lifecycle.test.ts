import { describe, it, expect, beforeEach } from 'vitest'
import {
  createStaffInvitation,
  acceptInvitation,
  requestPasswordReset,
  completePasswordReset,
  deactivateStaffAccount,
  isSessionRevoked,
  __resetLifecycleForTests,
} from '@/lib/users/lifecycle'
import { __resetUsersForTests, getUserByEmail, verifyUserPassword } from '@/lib/users/store'
import { __resetAuditForTests } from '@/lib/audit/store'
import { addQueueItem, getQueueItem, __resetQueueForTests } from '@/lib/queue/store'
import { hashPassword, verifyPassword } from '@/lib/users/password'
import { canManageStaff, canManageRole } from '@/lib/users/permissions'
import type { SessionActor } from '@/lib/access-control'

beforeEach(() => {
  __resetUsersForTests()
  __resetLifecycleForTests()
  __resetAuditForTests()
  __resetQueueForTests()
})

const manager: SessionActor = {
  userId: 'user-2',
  name: 'Hamza Khan',
  role: 'practice_manager',
  email: 'manager@smile-dental.co.uk',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1'],
}

describe('staff invitation lifecycle', () => {
  it('creates a pending user and accepts with password', () => {
    const invited = createStaffInvitation({
      email: 'new.staff@smile-dental.co.uk',
      name: 'New Staff',
      role: 'receptionist',
      clinicId: 'clinic-1',
      createdBy: manager,
    })
    expect(invited.ok).toBe(true)
    if (!invited.ok) return

    const pending = getUserByEmail('new.staff@smile-dental.co.uk')
    expect(pending?.status).toBe('pending_invite')

    const accepted = acceptInvitation(invited.inviteToken, 'secure-pass-1')
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return

    expect(accepted.user.status).toBe('active')
    expect(verifyUserPassword(accepted.user, 'secure-pass-1')).toBe(true)
  })

  it('rejects duplicate invitations', () => {
    createStaffInvitation({
      email: 'dup@smile-dental.co.uk',
      name: 'Dup',
      role: 'receptionist',
      clinicId: 'clinic-1',
      createdBy: manager,
    })
    const again = createStaffInvitation({
      email: 'dup@smile-dental.co.uk',
      name: 'Dup Two',
      role: 'receptionist',
      clinicId: 'clinic-1',
      createdBy: manager,
    })
    expect(again.ok).toBe(false)
  })
})

describe('password reset lifecycle', () => {
  it('resets password and revokes prior sessions', () => {
    const user = getUserByEmail('reception@smile-dental.co.uk')
    expect(user).toBeDefined()

    const requested = requestPasswordReset('reception@smile-dental.co.uk')
    expect(requested.ok).toBe(true)
    if (!requested.ok || !requested.resetToken) return

    expect(isSessionRevoked(user!.id, Date.now() - 1000)).toBe(false)

    const done = completePasswordReset(requested.resetToken, 'new-pass-abc')
    expect(done.ok).toBe(true)

    const refreshed = getUserByEmail('reception@smile-dental.co.uk')
    expect(refreshed).toBeDefined()
    expect(verifyUserPassword(refreshed!, 'new-pass-abc')).toBe(true)
    expect(isSessionRevoked(user!.id, Date.now() - 5000)).toBe(true)
  })
})

describe('deactivation lifecycle', () => {
  it('archives account, revokes sessions, and releases queue locks', () => {
    const user = getUserByEmail('reception@smile-dental.co.uk')
    expect(user).toBeDefined()

    const item = addQueueItem({
      type: 'booking_request',
      priority: 'normal',
      status: 'pending',
      clinicId: 'clinic-1',
      createdAt: new Date().toISOString(),
      callerPhone: '07700900999',
      callerState: 'confirmed',
      title: 'Lock test',
      summary: 'Assigned lock test item',
      confidence: 90,
      source: 'manual',
      assignedTo: user!.id,
    })

    const result = deactivateStaffAccount(user!.id, manager)
    expect(result.ok).toBe(true)

    const archived = getUserByEmail('reception@smile-dental.co.uk')
    expect(archived?.status).toBe('archived')

    const updated = getQueueItem(item.id)
    expect(updated?.assignedTo).toBeUndefined()

    expect(isSessionRevoked(user!.id, Date.now() - 1000)).toBe(true)
  })
})

describe('password hashing', () => {
  it('verifies scrypt hashes', () => {
    const hash = hashPassword('demo')
    expect(verifyPassword('demo', hash)).toBe(true)
    expect(verifyPassword('wrong', hash)).toBe(false)
  })
})

describe('staff permissions', () => {
  it('allows managers to invite receptionists only', () => {
    expect(canManageStaff(manager)).toBe(true)
    expect(canManageRole(manager, 'receptionist')).toBe(true)
    expect(canManageRole(manager, 'group_owner')).toBe(false)
  })

  it('blocks receptionists from staff management', () => {
    const receptionist: SessionActor = {
      userId: 'user-1',
      name: 'Sarah',
      role: 'receptionist',
      email: 'reception@smile-dental.co.uk',
      clinicId: 'clinic-1',
      clinicIds: ['clinic-1'],
    }
    expect(canManageStaff(receptionist)).toBe(false)
  })
})

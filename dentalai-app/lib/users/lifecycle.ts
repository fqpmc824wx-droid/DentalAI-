/**
 * Staff account lifecycle — invitations, password reset, deactivation (J-7 / J-8).
 */

import { logAuditEvent } from '@/lib/audit/store'
import { runInTransaction } from '@/lib/db/client'
import {
  repoGetInvitationByTokenHash,
  repoGetPasswordResetByTokenHash,
  repoGetSessionRevocation,
  repoInsertInvitation,
  repoInsertPasswordReset,
  repoMarkInvitationAccepted,
  repoMarkPasswordResetUsed,
  repoRevokeSessions,
} from '@/lib/db/repositories/users'
import { repoReleaseLocksForUser } from '@/lib/db/repositories/queue'
import { releaseLocksForUserInMemory, invalidateQueueCache } from '@/lib/queue/store'
import type { AuditActor } from '@/lib/audit/types'
import type { Role } from '@/types'
import {
  generateSecureToken,
  hashToken,
  INVITE_VALID_MS,
  RESET_VALID_MS,
} from '@/lib/users/password'
import {
  createUserRecord,
  deactivateUserRecord,
  getUserByEmail,
  getUserById,
  setUserPassword,
  type StoredUser,
} from '@/lib/users/store'
import { persistenceEnabled } from '@/lib/db/client'

// In-memory fallbacks for tests (when persistence is off)
const memInvites = new Map<string, { userId: string; expiresAt: string; id: string }>()
const memResets = new Map<string, { userId: string; expiresAt: string; id: string }>()
const memRevocations = new Map<string, number>()

export function __resetLifecycleForTests(): void {
  memInvites.clear()
  memResets.clear()
  memRevocations.clear()
}

export function getSessionRevokedAfter(userId: string): number | undefined {
  if (persistenceEnabled()) {
    return repoGetSessionRevocation(userId)?.revokedAfter
  }
  return memRevocations.get(userId)
}

export function isSessionRevoked(userId: string, tokenIssuedAtMs: number): boolean {
  const revokedAfter = getSessionRevokedAfter(userId)
  if (revokedAfter === undefined) return false
  return tokenIssuedAtMs < revokedAfter
}

function revokeUserSessions(userId: string): void {
  const now = Date.now()
  const revokedAt = new Date().toISOString()
  if (persistenceEnabled()) {
    repoRevokeSessions(userId, now, revokedAt)
  } else {
    memRevocations.set(userId, now)
  }
}

export type InviteResult = { ok: true; user: StoredUser; inviteToken: string } | { ok: false; error: string }

export function createStaffInvitation(input: {
  email: string
  name: string
  role: Role
  clinicId: string
  clinicIds?: string[]
  createdBy: AuditActor
}): InviteResult {
  const email = input.email.toLowerCase().trim()
  if (getUserByEmail(email)) {
    return { ok: false, error: 'An account with this email already exists' }
  }

  const user = createUserRecord({
    email,
    name: input.name,
    role: input.role,
    clinicId: input.clinicId,
    clinicIds: input.clinicIds,
    status: 'pending_invite',
    passwordHash: null,
  })

  const token = generateSecureToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + INVITE_VALID_MS).toISOString()
  const id = `inv_${Date.now().toString(36)}`

  if (persistenceEnabled()) {
    repoInsertInvitation({
      id,
      userId: user.id,
      tokenHash,
      expiresAt,
      createdBy: input.createdBy.userId,
      createdAt: new Date().toISOString(),
    })
  } else {
    memInvites.set(tokenHash, { userId: user.id, expiresAt, id })
  }

  logAuditEvent({
    action: 'auth.invite_created',
    status: 'success',
    actor: input.createdBy,
    clinicId: input.clinicId,
    metadata: { invitedUserId: user.id, role: input.role },
    summary: `Staff invitation created for ${input.name}`,
  })

  return { ok: true, user, inviteToken: token }
}

export type AcceptInviteResult = { ok: true; user: StoredUser } | { ok: false; error: string }

export function acceptInvitation(token: string, password: string): AcceptInviteResult {
  const tokenHash = hashToken(token)
  const now = new Date()

  if (persistenceEnabled()) {
    const inv = repoGetInvitationByTokenHash(tokenHash)
    if (!inv) return { ok: false, error: 'Invalid or expired invitation' }
    if (new Date(inv.expiresAt).getTime() < now.getTime()) {
      return { ok: false, error: 'Invitation has expired' }
    }

    const user = setUserPassword(inv.userId, password)
    if (!user) return { ok: false, error: 'User not found' }

    repoMarkInvitationAccepted(inv.id, now.toISOString())

    logAuditEvent({
      action: 'auth.invite_accepted',
      status: 'success',
      actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
      clinicId: user.clinicId,
      summary: `${user.name} accepted invitation and set password`,
    })

    return { ok: true, user }
  }

  const mem = [...memInvites.entries()].find(([hash]) => hash === tokenHash)?.[1]
  if (!mem) return { ok: false, error: 'Invalid or expired invitation' }
  if (new Date(mem.expiresAt).getTime() < now.getTime()) {
    return { ok: false, error: 'Invitation has expired' }
  }

  const user = setUserPassword(mem.userId, password)
  if (!user) return { ok: false, error: 'User not found' }
  memInvites.delete(tokenHash)

  logAuditEvent({
    action: 'auth.invite_accepted',
    status: 'success',
    actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
    clinicId: user.clinicId,
    summary: `${user.name} accepted invitation and set password`,
  })

  return { ok: true, user }
}

export type ResetRequestResult = { ok: true; resetToken: string } | { ok: false; error: string }

export function requestPasswordReset(email: string, actor?: AuditActor): ResetRequestResult {
  const user = getUserByEmail(email)
  if (!user || user.status !== 'active') {
    // Do not reveal whether the email exists
    return { ok: true, resetToken: '' }
  }

  const token = generateSecureToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + RESET_VALID_MS).toISOString()
  const id = `rst_${Date.now().toString(36)}`

  if (persistenceEnabled()) {
    repoInsertPasswordReset({
      id,
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    })
  } else {
    memResets.set(tokenHash, { userId: user.id, expiresAt, id })
  }

  logAuditEvent({
    action: 'auth.password_reset_requested',
    status: 'success',
    actor: actor ?? { userId: user.id, name: user.name, role: user.role, email: user.email },
    clinicId: user.clinicId,
    metadata: { targetUserId: user.id },
    summary: `Password reset requested for ${user.name}`,
  })

  return { ok: true, resetToken: token }
}

export type ResetCompleteResult = { ok: true } | { ok: false; error: string }

export function completePasswordReset(token: string, newPassword: string): ResetCompleteResult {
  const tokenHash = hashToken(token)
  const now = new Date()

  if (persistenceEnabled()) {
    const record = repoGetPasswordResetByTokenHash(tokenHash)
    if (!record) return { ok: false, error: 'Invalid or expired reset link' }
    if (new Date(record.expiresAt).getTime() < now.getTime()) {
      return { ok: false, error: 'Reset link has expired' }
    }

    const user = setUserPassword(record.userId, newPassword)
    if (!user) return { ok: false, error: 'User not found' }

    repoMarkPasswordResetUsed(record.id, now.toISOString())
    revokeUserSessions(user.id)

    logAuditEvent({
      action: 'auth.password_reset_completed',
      status: 'success',
      actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
      clinicId: user.clinicId,
      summary: `${user.name} completed password reset`,
    })

    return { ok: true }
  }

  const mem = [...memResets.entries()].find(([hash]) => hash === tokenHash)?.[1]
  if (!mem) return { ok: false, error: 'Invalid or expired reset link' }
  if (new Date(mem.expiresAt).getTime() < now.getTime()) {
    return { ok: false, error: 'Reset link has expired' }
  }

  const user = setUserPassword(mem.userId, newPassword)
  if (!user) return { ok: false, error: 'User not found' }
  memResets.delete(tokenHash)
  revokeUserSessions(user.id)

  logAuditEvent({
    action: 'auth.password_reset_completed',
    status: 'success',
    actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
    clinicId: user.clinicId,
    summary: `${user.name} completed password reset`,
  })

  return { ok: true }
}

export type DeactivateResult = { ok: true; locksReleased: number } | { ok: false; error: string }

export function deactivateStaffAccount(userId: string, actor: AuditActor): DeactivateResult {
  const user = getUserById(userId)
  if (!user) return { ok: false, error: 'User not found' }
  if (user.status === 'archived' || user.status === 'deactivated') {
    return { ok: false, error: 'Account is already deactivated' }
  }

  let locksReleased = 0

  if (persistenceEnabled()) {
    runInTransaction(() => {
      deactivateUserRecord(userId)
      revokeUserSessions(userId)
      locksReleased = repoReleaseLocksForUser(userId)
    })
    invalidateQueueCache()
  } else {
    deactivateUserRecord(userId)
    revokeUserSessions(userId)
    locksReleased = releaseLocksForUserInMemory(userId)
  }

  logAuditEvent({
    action: 'auth.account_deactivated',
    status: 'success',
    actor,
    clinicId: user.clinicId,
    metadata: { deactivatedUserId: userId, locksReleased },
    summary: `${user.name} account deactivated — sessions revoked, locks released`,
  })

  return { ok: true, locksReleased }
}

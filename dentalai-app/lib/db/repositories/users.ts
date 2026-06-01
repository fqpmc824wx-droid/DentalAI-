import type { Role } from '@/types'
import { getDb, persistenceEnabled, runInTransaction } from '@/lib/db/client'

export type UserStatus = 'active' | 'pending_invite' | 'deactivated' | 'archived'

export type StoredUser = {
  id: string
  email: string
  passwordHash: string | null
  name: string
  role: Role
  clinicId: string
  clinicIds: string[]
  status: UserStatus
  createdAt: string
  updatedAt: string
  deactivatedAt?: string
  passwordChangedAt?: string
}

type UserRow = {
  id: string
  email: string
  password_hash: string | null
  name: string
  role: string
  clinic_id: string
  clinic_ids: string
  status: string
  created_at: string
  updated_at: string
  deactivated_at: string | null
  password_changed_at: string | null
}

function rowToUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role as Role,
    clinicId: row.clinic_id,
    clinicIds: JSON.parse(row.clinic_ids) as string[],
    status: row.status as UserStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deactivatedAt: row.deactivated_at ?? undefined,
    passwordChangedAt: row.password_changed_at ?? undefined,
  }
}

function userToParams(user: StoredUser) {
  return {
    id: user.id,
    email: user.email.toLowerCase().trim(),
    passwordHash: user.passwordHash,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId,
    clinicIds: JSON.stringify(user.clinicIds),
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deactivatedAt: user.deactivatedAt ?? null,
    passwordChangedAt: user.passwordChangedAt ?? null,
  }
}

const UPSERT = `
  INSERT INTO users (
    id, email, password_hash, name, role, clinic_id, clinic_ids,
    status, created_at, updated_at, deactivated_at, password_changed_at
  ) VALUES (
    @id, @email, @passwordHash, @name, @role, @clinicId, @clinicIds,
    @status, @createdAt, @updatedAt, @deactivatedAt, @passwordChangedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    email = excluded.email,
    password_hash = excluded.password_hash,
    name = excluded.name,
    role = excluded.role,
    clinic_id = excluded.clinic_id,
    clinic_ids = excluded.clinic_ids,
    status = excluded.status,
    updated_at = excluded.updated_at,
    deactivated_at = excluded.deactivated_at,
    password_changed_at = excluded.password_changed_at
`

export function repoUpsertUser(user: StoredUser): void {
  if (!persistenceEnabled()) return
  getDb().prepare(UPSERT).run(userToParams(user))
}

export function repoUpsertUsers(users: StoredUser[]): void {
  if (!persistenceEnabled() || users.length === 0) return
  runInTransaction(() => {
    const stmt = getDb().prepare(UPSERT)
    for (const user of users) stmt.run(userToParams(user))
  })
}

export function repoGetUserByEmail(email: string): StoredUser | undefined {
  if (!persistenceEnabled()) return undefined
  const row = getDb().prepare(
    'SELECT * FROM users WHERE email = ?',
  ).get(email.toLowerCase().trim()) as UserRow | undefined
  return row ? rowToUser(row) : undefined
}

export function repoGetUserById(id: string): StoredUser | undefined {
  if (!persistenceEnabled()) return undefined
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? rowToUser(row) : undefined
}

export function repoListUsers(clinicIds?: string[]): StoredUser[] {
  if (!persistenceEnabled()) return []
  const rows = getDb().prepare('SELECT * FROM users ORDER BY name ASC').all() as UserRow[]
  const users = rows.map(rowToUser)
  if (!clinicIds || clinicIds.length === 0) return users
  const allowed = new Set(clinicIds)
  return users.filter(u => u.clinicIds.some(id => allowed.has(id)))
}

export function repoUsersIsEmpty(): boolean {
  if (!persistenceEnabled()) return true
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
  return row.c === 0
}

export type InvitationRecord = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  createdBy: string
  createdAt: string
  acceptedAt?: string
}

type InvitationRow = {
  id: string
  user_id: string
  token_hash: string
  expires_at: string
  created_by: string
  created_at: string
  accepted_at: string | null
}

function rowToInvitation(row: InvitationRow): InvitationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? undefined,
  }
}

export function repoInsertInvitation(inv: InvitationRecord): void {
  if (!persistenceEnabled()) return
  getDb().prepare(`
    INSERT INTO user_invitations (id, user_id, token_hash, expires_at, created_by, created_at, accepted_at)
    VALUES (@id, @userId, @tokenHash, @expiresAt, @createdBy, @createdAt, @acceptedAt)
  `).run({
    id: inv.id,
    userId: inv.userId,
    tokenHash: inv.tokenHash,
    expiresAt: inv.expiresAt,
    createdBy: inv.createdBy,
    createdAt: inv.createdAt,
    acceptedAt: inv.acceptedAt ?? null,
  })
}

export function repoGetInvitationByTokenHash(tokenHash: string): InvitationRecord | undefined {
  if (!persistenceEnabled()) return undefined
  const row = getDb().prepare(
    'SELECT * FROM user_invitations WHERE token_hash = ? AND accepted_at IS NULL',
  ).get(tokenHash) as InvitationRow | undefined
  return row ? rowToInvitation(row) : undefined
}

export function repoMarkInvitationAccepted(id: string, acceptedAt: string): void {
  if (!persistenceEnabled()) return
  getDb().prepare('UPDATE user_invitations SET accepted_at = ? WHERE id = ?').run(acceptedAt, id)
}

export type PasswordResetRecord = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  createdAt: string
  usedAt?: string
}

type ResetRow = {
  id: string
  user_id: string
  token_hash: string
  expires_at: string
  created_at: string
  used_at: string | null
}

function rowToReset(row: ResetRow): PasswordResetRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    usedAt: row.used_at ?? undefined,
  }
}

export function repoInsertPasswordReset(record: PasswordResetRecord): void {
  if (!persistenceEnabled()) return
  getDb().prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at, used_at)
    VALUES (@id, @userId, @tokenHash, @expiresAt, @createdAt, @usedAt)
  `).run({
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    usedAt: record.usedAt ?? null,
  })
}

export function repoGetPasswordResetByTokenHash(tokenHash: string): PasswordResetRecord | undefined {
  if (!persistenceEnabled()) return undefined
  const row = getDb().prepare(
    'SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL',
  ).get(tokenHash) as ResetRow | undefined
  return row ? rowToReset(row) : undefined
}

export function repoMarkPasswordResetUsed(id: string, usedAt: string): void {
  if (!persistenceEnabled()) return
  getDb().prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(usedAt, id)
}

export function repoRevokeSessions(userId: string, revokedAfter: number, revokedAt: string): void {
  if (!persistenceEnabled()) return
  getDb().prepare(`
    INSERT INTO session_revocations (user_id, revoked_after, revoked_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      revoked_after = excluded.revoked_after,
      revoked_at = excluded.revoked_at
  `).run(userId, revokedAfter, revokedAt)
}

export function repoGetSessionRevocation(userId: string): { revokedAfter: number; revokedAt: string } | undefined {
  if (!persistenceEnabled()) return undefined
  const row = getDb().prepare(
    'SELECT revoked_after, revoked_at FROM session_revocations WHERE user_id = ?',
  ).get(userId) as { revoked_after: number; revoked_at: string } | undefined
  if (!row) return undefined
  return { revokedAfter: row.revoked_after, revokedAt: row.revoked_at }
}

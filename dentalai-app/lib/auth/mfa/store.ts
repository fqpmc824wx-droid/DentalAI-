/**
 * MFA enrollment store — durable SQLite + in-memory fallback for tests.
 */

import { persistenceEnabled } from '@/lib/db/client'
import { getDb } from '@/lib/db/client'

export type MfaEnrollment = {
  userId: string
  secretBase32: string
  enrolledAt: string
}

const globalStore = globalThis as typeof globalThis & {
  __mfaEnrollments?: Map<string, MfaEnrollment>
}

/** Demo / test secret for super-admin seed (RFC 6238 test vector style). */
export const DEMO_SUPERADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXP'

function memoryMap(): Map<string, MfaEnrollment> {
  if (!globalStore.__mfaEnrollments) {
    globalStore.__mfaEnrollments = new Map()
  }
  return globalStore.__mfaEnrollments
}

export function __resetMfaForTests(): void {
  delete globalStore.__mfaEnrollments
}

export function getMfaEnrollment(userId: string): MfaEnrollment | undefined {
  if (persistenceEnabled()) {
    const row = getDb().prepare(
      'SELECT user_id, secret_base32, enrolled_at FROM user_mfa WHERE user_id = ?',
    ).get(userId) as { user_id: string; secret_base32: string; enrolled_at: string } | undefined
    if (!row) return undefined
    return {
      userId: row.user_id,
      secretBase32: row.secret_base32,
      enrolledAt: row.enrolled_at,
    }
  }
  return memoryMap().get(userId)
}

export function isMfaEnrolled(userId: string): boolean {
  return !!getMfaEnrollment(userId)
}

export function upsertMfaEnrollment(enrollment: MfaEnrollment): void {
  if (persistenceEnabled()) {
    getDb().prepare(`
      INSERT INTO user_mfa (user_id, secret_base32, enrolled_at)
      VALUES (@userId, @secretBase32, @enrolledAt)
      ON CONFLICT(user_id) DO UPDATE SET
        secret_base32 = excluded.secret_base32,
        enrolled_at = excluded.enrolled_at
    `).run({
      userId: enrollment.userId,
      secretBase32: enrollment.secretBase32,
      enrolledAt: enrollment.enrolledAt,
    })
    return
  }
  memoryMap().set(enrollment.userId, enrollment)
}

export function seedSuperAdminMfaIfNeeded(userId: string): void {
  if (isMfaEnrolled(userId)) return
  const secret =
    process.env.DENTALAI_SUPERADMIN_MFA_SECRET?.trim() || DEMO_SUPERADMIN_MFA_SECRET
  upsertMfaEnrollment({
    userId,
    secretBase32: secret,
    enrolledAt: new Date().toISOString(),
  })
}

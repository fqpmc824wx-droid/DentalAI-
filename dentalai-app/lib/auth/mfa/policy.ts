import type { Role } from '@/types'
import { getMfaEnrollment, isMfaEnrolled, seedSuperAdminMfaIfNeeded } from './store'
import { verifyTotpCode } from './totp'

export function isMfaRequiredForRole(role: Role): boolean {
  return role === 'super_admin'
}

export function ensureSuperAdminMfaSeeded(userId: string, role: Role): void {
  if (role === 'super_admin') seedSuperAdminMfaIfNeeded(userId)
}

export function mustVerifyMfa(userId: string, role: Role): boolean {
  if (!isMfaRequiredForRole(role)) return false
  ensureSuperAdminMfaSeeded(userId, role)
  return isMfaEnrolled(userId)
}

export function verifyUserMfaCode(userId: string, code: string): boolean {
  const enrollment = getMfaEnrollment(userId)
  if (!enrollment) return false
  return verifyTotpCode(enrollment.secretBase32, code)
}

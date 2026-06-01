import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateTotpCode,
  verifyTotpCode,
} from '@/lib/auth/mfa/totp'
import {
  DEMO_SUPERADMIN_MFA_SECRET,
  __resetMfaForTests,
  getMfaEnrollment,
  upsertMfaEnrollment,
} from '@/lib/auth/mfa/store'
import {
  isMfaRequiredForRole,
  mustVerifyMfa,
  verifyUserMfaCode,
} from '@/lib/auth/mfa/policy'
import { __resetUsersForTests } from '@/lib/users/store'

beforeEach(() => {
  __resetMfaForTests()
  __resetUsersForTests()
})

describe('TOTP', () => {
  it('generates and verifies a six-digit code for a known secret', () => {
    const code = generateTotpCode(DEMO_SUPERADMIN_MFA_SECRET)
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyTotpCode(DEMO_SUPERADMIN_MFA_SECRET, code)).toBe(true)
  })

  it('rejects invalid codes', () => {
    expect(verifyTotpCode(DEMO_SUPERADMIN_MFA_SECRET, '000000')).toBe(false)
    expect(verifyTotpCode(DEMO_SUPERADMIN_MFA_SECRET, 'abc')).toBe(false)
  })
})

describe('MFA policy', () => {
  it('requires MFA only for super_admin', () => {
    expect(isMfaRequiredForRole('super_admin')).toBe(true)
    expect(isMfaRequiredForRole('receptionist')).toBe(false)
    expect(isMfaRequiredForRole('practice_manager')).toBe(false)
  })

  it('seeds and verifies super-admin enrollment', () => {
    upsertMfaEnrollment({
      userId: 'user-4',
      secretBase32: DEMO_SUPERADMIN_MFA_SECRET,
      enrolledAt: new Date().toISOString(),
    })
    expect(mustVerifyMfa('user-4', 'super_admin')).toBe(true)
    expect(getMfaEnrollment('user-4')?.secretBase32).toBe(DEMO_SUPERADMIN_MFA_SECRET)
    const code = generateTotpCode(DEMO_SUPERADMIN_MFA_SECRET)
    expect(verifyUserMfaCode('user-4', code)).toBe(true)
  })
})

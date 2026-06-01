/**
 * Password hashing — scrypt via Node crypto (no extra dependencies).
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, expectedHex] = parts
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  const expected = Buffer.from(expectedHex, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export function generateSecureToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** J-7: invitation valid 72 hours. */
export const INVITE_VALID_MS = 72 * 60 * 60 * 1000

/** J-8: password reset link valid 30 minutes. */
export const RESET_VALID_MS = 30 * 60 * 1000

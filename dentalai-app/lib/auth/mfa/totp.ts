/**
 * RFC 6238 TOTP — Node crypto only (no extra dependencies).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(secret: string): Buffer {
  const normalized = secret.replace(/\s+/g, '').toUpperCase().replace(/=+$/, '')
  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

function hotp(secret: Buffer, counter: bigint, digits: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(counter)
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  return String(code % 10 ** digits).padStart(digits, '0')
}

export function generateTotpCode(
  secretBase32: string,
  opts?: { timeMs?: number; stepSec?: number; digits?: number },
): string {
  const stepSec = opts?.stepSec ?? 30
  const digits = opts?.digits ?? 6
  const timeMs = opts?.timeMs ?? Date.now()
  const counter = BigInt(Math.floor(timeMs / 1000 / stepSec))
  return hotp(base32Decode(secretBase32), counter, digits)
}

export function verifyTotpCode(
  secretBase32: string,
  token: string,
  opts?: { window?: number; stepSec?: number; digits?: number },
): boolean {
  const normalized = token.replace(/\s+/g, '')
  if (!/^\d{6,8}$/.test(normalized)) return false

  const window = opts?.window ?? 1
  const stepSec = opts?.stepSec ?? 30
  const digits = opts?.digits ?? 6
  const now = Date.now()
  const step = Math.floor(now / 1000 / stepSec)

  for (let w = -window; w <= window; w++) {
    const counter = BigInt(step + w)
    const expected = hotp(base32Decode(secretBase32), counter, digits)
    if (expected.length !== normalized.length) continue
    try {
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) return true
    } catch {
      /* length mismatch */
    }
  }

  return false
}

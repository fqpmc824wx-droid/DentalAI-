/**
 * UK phone number normalisation.
 * Converts any common UK phone format to E.164 digits-only (no +, no spaces).
 *
 * Handles:
 *   07700 900001     → 07700900001
 *   +44 7700 900001  → 07700900001
 *   +447700900001    → 07700900001
 *   00447700900001   → 07700900001
 *   0044 7700 900001 → 07700900001
 *   07700-900-001    → 07700900001
 *   (0207) 123 4567  → 02071234567
 *   020 7123 4567    → 02071234567
 *   withheld / unknown / private / no caller id → WITHHELD
 *
 * Returns null if the number is unparseable after normalisation.
 */

const WITHHELD_STRINGS = new Set([
  'withheld',
  'unknown',
  'private',
  'no caller id',
  'anonymous',
  'blocked',
  '',
])

export function normaliseUKPhone(raw: string): string | null {
  if (!raw) return null

  const lower = raw.toLowerCase().trim()
  if (WITHHELD_STRINGS.has(lower)) return null

  // Strip all non-digit characters except leading +
  const stripped = raw.replace(/[^\d+]/g, '')

  let digits: string

  if (stripped.startsWith('+44')) {
    // +447700900001 → 07700900001
    digits = '0' + stripped.slice(3)
  } else if (stripped.startsWith('0044')) {
    // 00447700900001 → 07700900001
    digits = '0' + stripped.slice(4)
  } else if (stripped.startsWith('0')) {
    // 07700900001, 02071234567
    digits = stripped
  } else {
    // Unrecognised format
    return null
  }

  // Basic sanity: UK numbers are 11 digits (07xxx or 01/02xxx)
  if (digits.length !== 11) return null

  return digits
}

/**
 * Returns true if two phone strings refer to the same UK number.
 * Safe to use when either side might be in any common format.
 */
export function ukPhonesMatch(a: string, b: string): boolean {
  const na = normaliseUKPhone(a)
  const nb = normaliseUKPhone(b)
  if (!na || !nb) return false
  return na === nb
}

/**
 * Returns true if the raw phone string is a withheld/unknown number.
 */
export function isWithheld(raw: string): boolean {
  if (!raw) return true
  return WITHHELD_STRINGS.has(raw.toLowerCase().trim()) || normaliseUKPhone(raw) === null
}

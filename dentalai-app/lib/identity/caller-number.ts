import { normaliseUKPhone } from '@/lib/phone'
import type { CallerNumberKind } from './types'

const WITHHELD_STRINGS = new Set(['withheld', 'unknown', 'private', 'anonymous', ''])
const BLOCKED_STRINGS = new Set(['blocked', 'no caller id'])

function isInternationalDigits(stripped: string): boolean {
  if (stripped.startsWith('+44') || stripped.startsWith('0044')) return false
  if (stripped.startsWith('+')) return true
  if (stripped.startsWith('00') && !stripped.startsWith('0044')) return true
  return false
}

/**
 * Classify raw caller ID — S053 withheld / blocked / unknown / international.
 * Returns lookup hint classification only; never identity proof.
 */
export function classifyCallerNumber(raw: string): {
  kind: CallerNumberKind
  normalisedUk: string | null
  lookupHintOnly: true
} {
  if (!raw?.trim()) {
    return { kind: 'withheld', normalisedUk: null, lookupHintOnly: true }
  }

  const lower = raw.toLowerCase().trim()
  if (BLOCKED_STRINGS.has(lower)) {
    return { kind: 'blocked', normalisedUk: null, lookupHintOnly: true }
  }
  if (WITHHELD_STRINGS.has(lower)) {
    return { kind: 'withheld', normalisedUk: null, lookupHintOnly: true }
  }

  const stripped = raw.replace(/[^\d+]/g, '')
  if (isInternationalDigits(stripped)) {
    return { kind: 'international', normalisedUk: null, lookupHintOnly: true }
  }

  const normalised = normaliseUKPhone(raw)
  if (!normalised) {
    return { kind: 'unknown', normalisedUk: null, lookupHintOnly: true }
  }

  return { kind: 'uk_present', normalisedUk: normalised, lookupHintOnly: true }
}

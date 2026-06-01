import { describe, it, expect } from 'vitest'
import { normaliseUKPhone, ukPhonesMatch, isWithheld } from '@/lib/phone'

describe('normaliseUKPhone', () => {
  describe('standard formats → 11-digit normalised', () => {
    it('handles plain 11-digit mobile', () => {
      expect(normaliseUKPhone('07700900001')).toBe('07700900001')
    })

    it('handles mobile with spaces', () => {
      expect(normaliseUKPhone('07700 900001')).toBe('07700900001')
    })

    it('handles mobile with dashes', () => {
      expect(normaliseUKPhone('07700-900-001')).toBe('07700900001')
    })

    it('handles +44 prefix', () => {
      expect(normaliseUKPhone('+447700900001')).toBe('07700900001')
    })

    it('handles +44 with spaces', () => {
      expect(normaliseUKPhone('+44 7700 900001')).toBe('07700900001')
    })

    it('handles 0044 prefix', () => {
      expect(normaliseUKPhone('00447700900001')).toBe('07700900001')
    })

    it('handles 0044 with spaces', () => {
      expect(normaliseUKPhone('0044 7700 900001')).toBe('07700900001')
    })

    it('handles London landline', () => {
      expect(normaliseUKPhone('020 7123 4567')).toBe('02071234567')
    })

    it('handles London landline with brackets', () => {
      expect(normaliseUKPhone('(020) 7123 4567')).toBe('02071234567')
    })

    it('handles landline +44', () => {
      expect(normaliseUKPhone('+44 20 7123 4567')).toBe('02071234567')
    })

    it('same number in different formats normalises identically', () => {
      const formats = [
        '07700900001',
        '07700 900001',
        '+447700900001',
        '+44 7700 900001',
        '00447700900001',
        '07700-900-001',
      ]
      const normalised = formats.map(normaliseUKPhone)
      expect(new Set(normalised).size).toBe(1)
    })
  })

  describe('withheld / empty → null', () => {
    it('returns null for empty string', () => {
      expect(normaliseUKPhone('')).toBeNull()
    })

    it('returns null for "withheld"', () => {
      expect(normaliseUKPhone('withheld')).toBeNull()
    })

    it('returns null for "unknown"', () => {
      expect(normaliseUKPhone('unknown')).toBeNull()
    })

    it('returns null for "private"', () => {
      expect(normaliseUKPhone('private')).toBeNull()
    })

    it('returns null for "anonymous"', () => {
      expect(normaliseUKPhone('anonymous')).toBeNull()
    })
  })

  describe('malformed → null', () => {
    it('returns null for too-short number', () => {
      expect(normaliseUKPhone('0770090')).toBeNull()
    })

    it('returns null for too-long number', () => {
      expect(normaliseUKPhone('077009000011234')).toBeNull()
    })

    it('returns null for non-UK prefix', () => {
      expect(normaliseUKPhone('+1 555 123 4567')).toBeNull()
    })
  })
})

describe('ukPhonesMatch', () => {
  it('matches same number in different formats', () => {
    expect(ukPhonesMatch('07700900001', '+447700900001')).toBe(true)
    expect(ukPhonesMatch('07700 900001', '0044 7700 900001')).toBe(true)
  })

  it('does not match different numbers', () => {
    expect(ukPhonesMatch('07700900001', '07700900002')).toBe(false)
  })

  it('returns false when either side is withheld', () => {
    expect(ukPhonesMatch('withheld', '07700900001')).toBe(false)
    expect(ukPhonesMatch('07700900001', 'unknown')).toBe(false)
  })
})

describe('isWithheld', () => {
  it('detects withheld strings', () => {
    expect(isWithheld('withheld')).toBe(true)
    expect(isWithheld('WITHHELD')).toBe(true)
    expect(isWithheld('unknown')).toBe(true)
    expect(isWithheld('')).toBe(true)
  })

  it('returns false for valid numbers', () => {
    expect(isWithheld('07700900001')).toBe(false)
    expect(isWithheld('+447700900001')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { lookupCallerByPhone } from '@/lib/mock/patients'

describe('lookupCallerByPhone — all 6 identity states', () => {
  describe('withheld', () => {
    it('returns withheld for "withheld"', () => {
      const r = lookupCallerByPhone('withheld')
      expect(r.state).toBe('withheld')
      expect(r.requiresHumanReview).toBe(true)
      expect(r.matches).toHaveLength(0)
      expect(r.confidence).toBe(0)
    })

    it('returns withheld for "unknown"', () => {
      const r = lookupCallerByPhone('unknown')
      expect(r.state).toBe('withheld')
    })

    it('returns withheld for empty string', () => {
      const r = lookupCallerByPhone('')
      expect(r.state).toBe('withheld')
    })
  })

  describe('no_match', () => {
    it('returns no_match for unknown number', () => {
      const r = lookupCallerByPhone('07999000000')
      expect(r.state).toBe('no_match')
      expect(r.requiresHumanReview).toBe(true)
      expect(r.matches).toHaveLength(0)
    })
  })

  describe('confirmed', () => {
    it('returns confirmed for single-clinic unique number', () => {
      const r = lookupCallerByPhone('07700900006') // pat-006, clinic-1 only
      expect(r.state).toBe('confirmed')
      expect(r.requiresHumanReview).toBe(false)
      expect(r.matches).toHaveLength(1)
      expect(r.confidence).toBeGreaterThan(80)
    })

    it('confirmed works with +44 format', () => {
      const r = lookupCallerByPhone('+44 7700 900006')
      expect(r.state).toBe('confirmed')
    })

    it('confirmed works with 0044 format', () => {
      const r = lookupCallerByPhone('0044 7700 900006')
      expect(r.state).toBe('confirmed')
    })

    it('confirms lapsed patient correctly', () => {
      const r = lookupCallerByPhone('07700900005')
      expect(r.state).toBe('confirmed')
      expect(r.matches[0].isLapsed).toBe(true)
    })
  })

  describe('family_number', () => {
    it('returns family_number for shared same-surname landline', () => {
      const r = lookupCallerByPhone('02071234567')
      expect(r.state).toBe('family_number')
      expect(r.requiresHumanReview).toBe(true)
      expect(r.matches.length).toBeGreaterThan(1)
      // All matches must share the same last name
      const lastNames = new Set(r.matches.map(p => p.lastName))
      expect(lastNames.size).toBe(1)
    })
  })

  describe('uncertain', () => {
    it('returns uncertain for cross-clinic number collision', () => {
      // 07700900001 matches pat-001 (clinic-1) AND pat-007 (clinic-2)
      const r = lookupCallerByPhone('07700900001')
      expect(r.state).toBe('uncertain')
      expect(r.requiresHumanReview).toBe(true)
      expect(r.matches.length).toBeGreaterThan(1)
      // Must span multiple clinics
      const clinics = new Set(r.matches.map(p => p.clinicId))
      expect(clinics.size).toBeGreaterThan(1)
    })
  })

  describe('requiresHumanReview rules', () => {
    it('confirmed patient does NOT require human review', () => {
      const r = lookupCallerByPhone('07700900006')
      expect(r.requiresHumanReview).toBe(false)
    })

    it('withheld ALWAYS requires human review', () => {
      expect(lookupCallerByPhone('withheld').requiresHumanReview).toBe(true)
    })

    it('no_match requires human review', () => {
      expect(lookupCallerByPhone('07999000000').requiresHumanReview).toBe(true)
    })

    it('family_number requires human review', () => {
      expect(lookupCallerByPhone('02071234567').requiresHumanReview).toBe(true)
    })

    it('uncertain requires human review', () => {
      expect(lookupCallerByPhone('07700900001').requiresHumanReview).toBe(true)
    })
  })

  describe('patient flags surface correctly', () => {
    it('FTA patient surfaces isFTA flag', () => {
      const r = lookupCallerByPhone('07700900002')
      expect(r.state).toBe('confirmed')
      expect(r.matches[0].isFTA).toBe(true)
    })

    it('patient with outstanding balance surfaces it', () => {
      const r = lookupCallerByPhone('07700900002')
      expect(r.matches[0].outstandingBalance).toBeGreaterThan(0)
    })
  })
})

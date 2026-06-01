import { describe, it, expect } from 'vitest'
import { lookupCallerByPhone } from '@/lib/mock/patients'
import {
  buildFailedVerificationAudit,
  buildIdentitySession,
  CALLER_ID_IS_LOOKUP_HINT_ONLY,
  canDiscloseTopic,
  classifyCallerNumber,
  detectBorrowedPhone,
  identitySessionAuditPayload,
  assertIdentityAuditPayloadSafe,
  nextVerificationAttempt,
  requiresMidCallReverification,
  thirdPartyDisclosureBlocked,
  verifyAgainstCandidates,
  MAX_VERIFICATION_ATTEMPTS,
  buildIdentityBandSignoffArtifact,
  isIdentityBandSignoffComplete,
  IDENTITY_SCRIPTS,
  scriptForScenario,
} from '@/lib/identity'

describe('S041–S057 identity scenario band', () => {
  describe('S057 caller ID is lookup hint only', () => {
    it('exports the locked rule constant', () => {
      expect(CALLER_ID_IS_LOOKUP_HINT_ONLY).toBe(true)
    })

    it('classifies UK number without treating it as verified identity', () => {
      const c = classifyCallerNumber('07700900006')
      expect(c.kind).toBe('uk_present')
      expect(c.lookupHintOnly).toBe(true)
    })
  })

  describe('S053 caller number kinds', () => {
    it('classifies withheld', () => {
      expect(classifyCallerNumber('withheld').kind).toBe('withheld')
    })
    it('classifies blocked', () => {
      expect(classifyCallerNumber('blocked').kind).toBe('blocked')
    })
    it('classifies unknown format', () => {
      expect(classifyCallerNumber('not-a-phone!!!').kind).toBe('unknown')
    })
    it('classifies international non-UK', () => {
      expect(classifyCallerNumber('+1 555 123 4567').kind).toBe('international')
    })
  })

  describe('S041 confirmed / S042 probable / S043 multiple / S044 no_match', () => {
    it('S041 confirmed single match', () => {
      const session = buildIdentitySession({
        rawCallerNumber: '07700900006',
        lookup: lookupCallerByPhone('07700900006'),
        verified: true,
      })
      expect(session.scenario).toBe('confirmed')
      expect(session.requiresHumanReview).toBe(false)
    })

    it('S042 probable from uncertain lookup', () => {
      const lookup = lookupCallerByPhone('07700900001')
      const session = buildIdentitySession({
        rawCallerNumber: '07700900001',
        lookup,
      })
      expect(session.scenario).toBe('probable')
      expect(session.requiresHumanReview).toBe(true)
    })

    it('S043 multiple_match', () => {
      const lookup = lookupCallerByPhone('02071234567')
      const session = buildIdentitySession({
        rawCallerNumber: '02071234567',
        lookup,
      })
      expect(session.scenario).toBe('shared_household')
    })

    it('S044 no_match / new_patient', () => {
      const session = buildIdentitySession({
        rawCallerNumber: '07999000000',
        lookup: lookupCallerByPhone('07999000000'),
      })
      expect(session.scenario).toBe('new_patient')
    })
  })

  describe('S045 withheld', () => {
    it('maps withheld caller to withheld scenario', () => {
      const session = buildIdentitySession({
        rawCallerNumber: 'withheld',
        lookup: lookupCallerByPhone('withheld'),
      })
      expect(session.scenario).toBe('withheld')
      expect(session.callerNumberKind).toBe('withheld')
    })
  })

  describe('S046 borrowed phone', () => {
    it('detects callback number different from presenting line', () => {
      expect(detectBorrowedPhone('07700900006', '07700900001')).toBe(true)
      const session = buildIdentitySession({
        rawCallerNumber: '07700900006',
        lookup: lookupCallerByPhone('07700900006'),
        callbackNumber: '07700900001',
      })
      expect(session.scenario).toBe('borrowed_phone')
    })
  })

  describe('S048 failed verification / S051 repeat-back / S054 postcode fallback', () => {
    const candidates = [
      { id: 'pat-006', firstName: 'Amir', lastName: 'Hassan', dob: '1992-04-11', postcode: 'TD9 9EE' },
    ]

    it('verifies correct name and DOB', () => {
      const r = verifyAgainstCandidates(
        { firstName: 'Amir', lastName: 'Hassan', dateOfBirth: '1992-04-11' },
        candidates,
      )
      expect(r.outcome).toBe('verified')
    })

    it('S051 low confidence requires repeat-back before verified', () => {
      const r = verifyAgainstCandidates(
        { firstName: 'Amir', lastName: 'Hassan', dateOfBirth: '1992-04-11' },
        candidates,
        { lowConfidence: true },
      )
      expect(r.outcome).toBe('needs_repeat_back')
    })

    it('S054 postcode fallback only when required', () => {
      const r = verifyAgainstCandidates(
        { firstName: 'Wrong', lastName: 'Name', dateOfBirth: '1992-04-11', postcode: 'TD9 9EE' },
        candidates,
        { requirePostcode: true },
      )
      expect(r.outcome).toBe('verified')
      expect(r.method).toBe('postcode_fallback')
    })

    it('S048 exhausts after max attempts', () => {
      let attempts = 0
      const step = nextVerificationAttempt(attempts, 'failed')
      attempts = step.attempts
      expect(step.exhausted).toBe(false)
      const step2 = nextVerificationAttempt(attempts, 'failed')
      expect(step2.exhausted).toBe(true)
      expect(step2.attempts).toBe(MAX_VERIFICATION_ATTEMPTS)
    })
  })

  describe('S050 third-party disclosure / S049 child guardian', () => {
    it('blocks third-party disclosure', () => {
      expect(thirdPartyDisclosureBlocked('third_party')).toBe(true)
      expect(
        canDiscloseTopic({
          topic: 'appointment_datetime',
          verified: true,
          callerRole: 'third_party',
          scenario: 'third_party',
        }),
      ).toBe(false)
    })

    it('blocks clinical purpose for child guardian flow', () => {
      expect(
        canDiscloseTopic({
          topic: 'clinical_purpose',
          verified: true,
          callerRole: 'parent_or_guardian',
          scenario: 'child_guardian',
        }),
      ).toBe(false)
    })
  })

  describe('S055 mid-call reverification', () => {
    it('requires reverification for sensitive topics', () => {
      expect(requiresMidCallReverification(true, 'financial')).toBe(true)
      expect(requiresMidCallReverification(true, 'routine')).toBe(false)
    })
  })

  describe('S041–S057 band sign-off artifact', () => {
    it('builds complete identity band sign-off', () => {
      const artifact = buildIdentityBandSignoffArtifact('2026-06-01T12:00:00.000Z')
      expect(isIdentityBandSignoffComplete(artifact)).toBe(true)
      expect(artifact.slices).toHaveLength(17)
      expect(artifact.verificationPolicy.callerIdIsProof).toBe(false)
    })
  })

  describe('locked identity scripts', () => {
    it('exposes Session 2 scripts without PII placeholders leaking names', () => {
      expect(IDENTITY_SCRIPTS.multiple_match).toContain('full name and date of birth')
      expect(scriptForScenario('multiple_match')).toBe(IDENTITY_SCRIPTS.multiple_match)
      expect(scriptForScenario('failed_verification')).toHaveProperty('handoff')
    })

    it('S051 repeat-back script interpolates detail only', () => {
      const line = scriptForScenario('confirmed', { lowConfidenceDetail: '14th of May' })
      expect(line).toContain('14th of May')
    })
  })

  describe('S052 / S056 identity-safe audit', () => {
    it('builds audit without PII', () => {
      const session = buildIdentitySession({
        rawCallerNumber: '07700900006',
        lookup: lookupCallerByPhone('07700900006'),
      })
      const payload = identitySessionAuditPayload(session, 'clinic-1')
      expect(() => assertIdentityAuditPayloadSafe(payload)).not.toThrow()
      expect(payload.lookupHintOnly).toBe(true)
    })

    it('failed verification audit omits raw answers', () => {
      const entry = buildFailedVerificationAudit(1, 'name_and_dob', 2, 'clinic-1')
      expect(entry).not.toHaveProperty('firstName')
      expect(entry.action).toBe('identity.verification_failed')
    })
  })
})

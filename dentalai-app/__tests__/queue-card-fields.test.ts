import { describe, it, expect } from 'vitest'
import {
  mapScenarioToIdentityBadge,
  buildQueueCardPatientDetail,
} from '@/lib/queue/card-identity'
import {
  validateSummary,
  validateInstruction,
  buildPreparedAction,
  assertPreparedAction,
} from '@/lib/queue/prepared-action'

describe('S091 queue card identity (B-2)', () => {
  it('maps locked identity badges from scenario state', () => {
    expect(mapScenarioToIdentityBadge({ scenario: 'confirmed', verified: true })).toBe('confirmed')
    expect(mapScenarioToIdentityBadge({ scenario: 'probable', verified: false })).toBe('probable')
    expect(mapScenarioToIdentityBadge({ scenario: 'multiple_match', verified: false })).toBe('multiple_match')
    expect(mapScenarioToIdentityBadge({ scenario: 'new_patient', verified: false })).toBe('no_match')
    expect(mapScenarioToIdentityBadge({ scenario: 'withheld', verified: false })).toBe('withheld')
    expect(mapScenarioToIdentityBadge({ scenario: 'failed_verification', verified: false })).toBe('failed')
    expect(mapScenarioToIdentityBadge({ scenario: 'borrowed_phone', verified: false })).toBe('unverified')
  })

  it('shows patient name only when identity is confirmed or verified probable', () => {
    const confirmed = buildQueueCardPatientDetail({
      scenario: 'confirmed',
      verified: true,
      callerPhone: '07700900001',
      patient: {
        firstName: 'James',
        lastName: 'Patel',
        dob: '1985-03-12',
        isPrivate: false,
        nhsNumber: '485 777 3456',
      },
    })
    expect(confirmed.badge).toBe('confirmed')
    expect(confirmed.fullName).toBe('James Patel')
    expect(confirmed.fundingStatus).toBe('nhs')

    const withheld = buildQueueCardPatientDetail({
      scenario: 'withheld',
      verified: false,
      callerPhone: 'unknown',
      patient: {
        firstName: 'James',
        lastName: 'Patel',
        dob: '1985-03-12',
        isPrivate: false,
      },
    })
    expect(withheld.fullName).toBeUndefined()
    expect(withheld.phone).toBe('unknown')
  })
})

describe('S091 prepared action (B-3, C-1, C-2)', () => {
  it('accepts a patient-centred summary up to three sentences', () => {
    const result = validateSummary(
      'Caller wants a hygiene appointment on Thursday afternoon. They sounded anxious about a previous missed visit. Preferred callback is the same mobile number.',
    )
    expect(result.ok).toBe(true)
    expect(result.sentenceCount).toBe(3)
  })

  it('rejects transcript-style summaries', () => {
    const result = validateSummary('Caller said: I need an appointment tomorrow.')
    expect(result.ok).toBe(false)
  })

  it('requires a single-line staff instruction', () => {
    expect(validateInstruction('Call back before 3pm and offer the next hygiene slot.').ok).toBe(true)
    expect(validateInstruction('Line one\nLine two').ok).toBe(false)
  })

  it('builds a prepared action with flags, summary, and instruction', () => {
    const action = buildPreparedAction({
      flags: ['anxiety', 'nhs_patient'],
      summary: 'Caller wants to rebook a missed hygiene visit and asked for a Thursday afternoon slot.',
      instruction: 'Call back today and offer the next available Thursday hygiene slot.',
    })
    expect(assertPreparedAction(action)).toBe(true)
    expect(action.flags).toEqual(['anxiety', 'nhs_patient'])
  })
})

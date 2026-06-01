import { describe, it, expect } from 'vitest'
import {
  QUEUE_TAXONOMY,
  LEGACY_QUEUE_TYPE_TO_SUBTYPE,
  assertFullTaxonomyCoverage,
  getTaxonomyCategory,
  getTaxonomySubtype,
  mapLegacyQueueType,
} from '@/lib/queue/taxonomy'
import {
  formatQueueReference,
  parseQueueReference,
  nextQueueSequence,
} from '@/lib/queue/reference'
import { QUEUE_FLAGS, flagsByColour } from '@/lib/queue/flags'
import {
  deriveLockedPriority,
  lockedPriorityToQueuePriority,
  isBatchablePriority,
} from '@/lib/queue/priority-policy'

describe('S087 queue taxonomy (A-1 through A-8)', () => {
  it('registers all eight locked categories', () => {
    const coverage = assertFullTaxonomyCoverage()
    expect(coverage.ok).toBe(true)
    expect(coverage.categoryCount).toBe(8)
    expect(coverage.subtypeCount).toBeGreaterThanOrEqual(30)
    expect(QUEUE_TAXONOMY.map(c => c.productBookRef)).toEqual([
      'A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6', 'A-7', 'A-8',
    ])
  })

  it('covers every subtype in the registry', () => {
    for (const category of QUEUE_TAXONOMY) {
      expect(getTaxonomyCategory(category.id)).toBeDefined()
      for (const subtype of category.subtypes) {
        expect(getTaxonomySubtype(subtype.id)?.categoryId).toBe(category.id)
      }
    }
  })

  it('maps legacy mock queue types into taxonomy subtypes', () => {
    expect(mapLegacyQueueType('booking_request').id).toBe('new_booking')
    expect(mapLegacyQueueType('emergency').productBookRef).toBe('A-6')
    expect(mapLegacyQueueType('identity_review').id).toBe('failed_identity_callback')
    expect(Object.keys(LEGACY_QUEUE_TYPE_TO_SUBTYPE)).toHaveLength(10)
  })
})

describe('S088 queue reference codes (B-1)', () => {
  it('formats Q-clinic-date-sequence reference codes', () => {
    expect(formatQueueReference({ clinicCode: 'c1', dateYmd: '20260601', sequence: 7 })).toBe(
      'Q-c1-20260601-0007',
    )
  })

  it('parses valid reference codes', () => {
    const parsed = parseQueueReference('Q-c1-20260601-0007')
    expect(parsed).toEqual({ clinicCode: 'c1', dateYmd: '20260601', sequence: 7 })
  })

  it('rejects malformed reference codes', () => {
    expect(parseQueueReference('q-001')).toBeNull()
    expect(parseQueueReference('Q-C1-2026-01-07')).toBeNull()
  })

  it('allocates next sequence for a clinic day', () => {
    const existing = ['Q-c1-20260601-0003', 'Q-c1-20260601-0001', 'Q-c2-20260601-0001']
    expect(nextQueueSequence(existing, 'c1', '20260601')).toBe(4)
  })
})

describe('S090 queue flags (C-3 through C-7)', () => {
  it('registers red, amber, teal, blue, and grey flags', () => {
    expect(flagsByColour('red').length).toBeGreaterThan(0)
    expect(flagsByColour('amber').length).toBeGreaterThan(0)
    expect(flagsByColour('teal').length).toBeGreaterThan(0)
    expect(flagsByColour('blue').length).toBeGreaterThan(0)
    expect(flagsByColour('grey').length).toBeGreaterThan(0)
    expect(QUEUE_FLAGS.length).toBeGreaterThanOrEqual(25)
  })
})

describe('S089 priority policy (C-8 through C-10)', () => {
  it('derives critical from emergency flags', () => {
    expect(deriveLockedPriority({ flags: ['emergency_urgent_pain'] })).toBe('critical')
    expect(lockedPriorityToQueuePriority('critical')).toBe('urgent')
  })

  it('marks low priority work as batchable', () => {
    expect(isBatchablePriority('low')).toBe(true)
    expect(isBatchablePriority('critical')).toBe(false)
  })
})

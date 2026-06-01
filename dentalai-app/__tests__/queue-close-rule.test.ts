import { describe, it, expect } from 'vitest'
import { evaluateCloseEligibility } from '@/lib/queue/close-rule'
import type { QueueItem } from '@/lib/queue/types'

const base: QueueItem = {
  id: 'q-close',
  type: 'callback',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900001',
  callerState: 'confirmed',
  title: 'Callback',
  summary: 'Call back.',
  confidence: 80,
  source: 'ai_call',
}

describe('S103 close rule (D-11)', () => {
  it('blocks close without outcome and notes on callback items', () => {
    const r = evaluateCloseEligibility(base, {})
    expect(r.canClose).toBe(false)
    expect(r.requiresOutcome).toBe(true)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('allows close when outcome and notes are present', () => {
    const r = evaluateCloseEligibility(base, {
      outcome: 'reached',
      notes: 'Patient confirmed appointment.',
    })
    expect(r.canClose).toBe(true)
  })

  it('treats terminal items as immutable', () => {
    const r = evaluateCloseEligibility({ ...base, status: 'resolved' }, {
      outcome: 'reached',
      notes: 'Already done',
    })
    expect(r.immutable).toBe(true)
    expect(r.canClose).toBe(false)
  })

  it('blocks generic close on booking requests', () => {
    const r = evaluateCloseEligibility(
      { ...base, type: 'booking_request' },
      { notes: 'enough notes here' },
    )
    expect(r.canClose).toBe(false)
    expect(r.errors.some(e => e.includes('approve'))).toBe(true)
  })
})

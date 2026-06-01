import { describe, it, expect } from 'vitest'
import { buildHandoverBriefing, buildPersonalShiftSummary } from '@/lib/queue/shift-summary'
import type { QueueItem } from '@/lib/queue/types'

const base: QueueItem = {
  id: 'q-shift',
  type: 'callback',
  priority: 'high',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-05-31T20:00:00.000Z',
  callerPhone: '07700900001',
  callerState: 'confirmed',
  title: 'Overnight callback',
  summary: 'Call back.',
  confidence: 80,
  source: 'ai_call',
}

describe('S107 shift summaries (D-12)', () => {
  it('builds non-surveillance handover briefing', () => {
    const briefing = buildHandoverBriefing({
      items: [base],
      nowMs: Date.parse('2026-06-01T10:00:00.000Z'),
    })
    expect(briefing.openItems).toBe(1)
    expect(briefing.overnightCount).toBe(1)
    expect(briefing.banner).toContain('open')
  })

  it('summarises personal session contribution', () => {
    const summary = buildPersonalShiftSummary({
      actorUserId: 'user-1',
      items: [
        { ...base, resolvedBy: 'user-1', status: 'resolved', resolvedAt: '2026-06-01T11:00:00.000Z' },
      ],
    })
    expect(summary.itemsResolved).toBe(1)
    expect(summary.message).toContain('helped close')
  })
})

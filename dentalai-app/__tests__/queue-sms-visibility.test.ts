import { describe, it, expect } from 'vitest'
import { buildSmsVisibilityPanel } from '@/lib/queue/sms-visibility'
import type { QueueItem } from '@/lib/queue/types'

const baseItem: QueueItem = {
  id: 'q-sms',
  type: 'booking_request',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900006',
  callerState: 'confirmed',
  patientId: 'pat-006',
  title: 'Booking request',
  summary: 'Caller asked to book a checkup.',
  confidence: 88,
  source: 'ai_call',
}

describe('S096 SMS visibility panel (D-10)', () => {
  it('shows queued holding SMS with exact content and recipient', () => {
    const panel = buildSmsVisibilityPanel({ item: baseItem })
    expect(panel.visible).toBe(true)
    expect(panel.records[0]?.deliveryState).toBe('queued')
    expect(panel.records[0]?.content).toContain('Thanks for calling')
    expect(panel.records[0]?.recipient).toBe('07700900006')
  })

  it('marks suppressed when identity is withheld', () => {
    const panel = buildSmsVisibilityPanel({
      item: { ...baseItem, callerState: 'withheld', confidence: 20 },
    })
    expect(panel.hasSuppression).toBe(true)
    expect(panel.records[0]?.suppressionReason).toContain('withheld')
    expect(panel.records[0]?.canRetry).toBe(false)
  })

  it('surfaces failed delivery with retry option', () => {
    const panel = buildSmsVisibilityPanel({
      item: { ...baseItem, callerState: 'no_match', confidence: 40 },
    })
    expect(panel.hasFailure).toBe(true)
    expect(panel.records[0]?.canRetry).toBe(true)
    expect(panel.records[0]?.failureReason).toBeTruthy()
  })

  it('shows sent emergency holding SMS with timestamp', () => {
    const panel = buildSmsVisibilityPanel({
      item: { ...baseItem, type: 'emergency' },
    })
    expect(panel.records[0]?.deliveryState).toBe('sent')
    expect(panel.records[0]?.sentAt).toBe(baseItem.createdAt)
  })

  it('hides panel for manual queue items', () => {
    const panel = buildSmsVisibilityPanel({ item: { ...baseItem, source: 'manual' } })
    expect(panel.visible).toBe(false)
  })
})

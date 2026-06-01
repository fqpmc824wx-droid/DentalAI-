import { describe, it, expect } from 'vitest'
import {
  appendCallbackAttempt,
  buildCallbackTrackerView,
  countFailedAttempts,
  evaluateAttemptEligibility,
  requiresManagerReview,
  suggestCallbackWindow,
  allowsUnableAfterThreeClosure,
} from '@/lib/queue/callback-tracker'
import type { QueueItem } from '@/lib/queue/types'

const base: QueueItem = {
  id: 'q-cb',
  type: 'callback',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900006',
  callerState: 'confirmed',
  title: 'Callback request',
  summary: 'Patient asked to be called back.',
  confidence: 80,
  source: 'ai_call',
}

function failedAttempts(n: number) {
  let item = base
  for (let i = 1; i <= n; i++) {
    item = { ...item, callbackAttempts: appendCallbackAttempt({
      item,
      outcome: 'no_answer',
      byUserId: 'user-1',
      byName: 'Alex',
      attemptId: `a-${i}`,
      at: `2026-06-01T${10 + i}:00:00.000Z`,
    }) }
  }
  return item.callbackAttempts ?? []
}

describe('S097 callback tracker (D-5, D-6, D-8)', () => {
  it('requires an outcome before logging an attempt', () => {
    const check = evaluateAttemptEligibility(base, {})
    expect(check.allowed).toBe(false)
    expect(check.errors[0]).toContain('outcome')
  })

  it('appends chronological attempts with staff attribution', () => {
    const attempts = appendCallbackAttempt({
      item: base,
      outcome: 'left_voicemail',
      byUserId: 'user-1',
      byName: 'Alex',
    })
    expect(attempts).toHaveLength(1)
    expect(attempts[0].byName).toBe('Alex')
    expect(attempts[0].outcome).toBe('left_voicemail')
  })

  it('flags manager review after three failed attempts (D-6)', () => {
    const attempts = failedAttempts(3)
    expect(countFailedAttempts(attempts)).toBe(3)
    expect(requiresManagerReview(attempts)).toBe(true)
    expect(allowsUnableAfterThreeClosure(attempts)).toBe(true)
    const view = buildCallbackTrackerView({ item: { ...base, callbackAttempts: attempts } })
    expect(view.managerReviewRequired).toBe(true)
    expect(view.allowsUnableAfterThree).toBe(true)
  })

  it('suggests afternoon retry after morning item creation (D-8)', () => {
    const window = suggestCallbackWindow({
      itemCreatedAt: '2026-06-01T10:00:00.000Z',
      nowMs: Date.parse('2026-06-01T10:30:00.000Z'),
    })
    expect(window.suggestion).toContain('14:00')
    expect(window.withinWindow).toBe(true)
  })

  it('blocks calls outside configured callback hours unless critical override', () => {
    const outside = suggestCallbackWindow({
      itemCreatedAt: base.createdAt,
      nowMs: Date.parse('2026-06-01T19:00:00.000Z'),
    })
    expect(outside.withinWindow).toBe(false)
    expect(outside.suggestion).toContain('Outside callback hours')

    const override = suggestCallbackWindow({
      itemCreatedAt: base.createdAt,
      nowMs: Date.parse('2026-06-01T19:00:00.000Z'),
      criticalOverride: true,
    })
    expect(override.suggestion).not.toContain('Outside callback hours')
  })

  it('allows a fourth manual attempt after manager review threshold', () => {
    const view = buildCallbackTrackerView({
      item: { ...base, callbackAttempts: failedAttempts(3) },
    })
    expect(view.fourthAttemptAllowed).toBe(true)
  })
})

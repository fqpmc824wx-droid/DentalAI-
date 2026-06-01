import { describe, it, expect } from 'vitest'
import {
  evaluatePatientCalledBackEligibility,
  bypassesFullOutcomeForm,
  PATIENT_CALLED_BACK_LABEL,
} from '@/lib/queue/return-call'
import type { QueueItem } from '@/lib/queue/types'

const base: QueueItem = {
  id: 'q-return',
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

describe('S098 one-tap return call (D-7)', () => {
  it('allows one-tap closure for open callback items', () => {
    const check = evaluatePatientCalledBackEligibility(base)
    expect(check.allowed).toBe(true)
    expect(check.closureLabel).toBe(PATIENT_CALLED_BACK_LABEL)
  })

  it('bypasses the full outcome form and notes gate', () => {
    expect(bypassesFullOutcomeForm()).toBe(true)
  })

  it('blocks one-tap closure on terminal items', () => {
    const check = evaluatePatientCalledBackEligibility({ ...base, status: 'resolved' })
    expect(check.allowed).toBe(false)
    expect(check.errors[0]).toContain('closed')
  })

  it('blocks one-tap closure on non-callback types', () => {
    const check = evaluatePatientCalledBackEligibility({ ...base, type: 'booking_request' })
    expect(check.allowed).toBe(false)
  })
})

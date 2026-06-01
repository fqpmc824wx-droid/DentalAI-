import { describe, it, expect } from 'vitest'
import {
  buildDuplicateCallerAlert,
  countSameDayCalls,
  evaluateDuplicateCaller,
  elevateLockedPriorityOneLevel,
} from '@/lib/queue/duplicate-caller'
import type { QueueItem } from '@/lib/queue/types'

const mk = (id: string, hour: number): QueueItem => ({
  id,
  type: 'callback',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: `2026-06-01T${String(hour).padStart(2, '0')}:00:00.000Z`,
  callerPhone: '07700900001',
  callerState: 'confirmed',
  patientId: 'pat-001',
  title: `Call ${id}`,
  summary: 'Test',
  confidence: 80,
  source: 'ai_call',
})

describe('S106 duplicate caller (E-2)', () => {
  it('counts same-day calls for the same patient', () => {
    const items = [mk('a', 9), mk('b', 11), mk('c', 14)]
    expect(countSameDayCalls({ item: items[2], allItems: items })).toBe(3)
  })

  it('adds flag and elevates priority on second same-day call', () => {
    const items = [mk('a', 9), mk('b', 11)]
    const eval_ = evaluateDuplicateCaller({ item: items[1], allItems: items })
    expect(eval_.addDuplicateCallerFlag).toBe(true)
    expect(eval_.suggestedPriority).toBe('high')
    expect(eval_.managerAlertRequired).toBe(false)
  })

  it('requires manager alert on three or more same-day calls', () => {
    const items = [mk('a', 9), mk('b', 11), mk('c', 14)]
    const alert = buildDuplicateCallerAlert({ item: items[2], allItems: items })
    expect(alert.managerAlertRequired).toBe(true)
    expect(alert.message).toContain('manager')
  })

  it('elevates locked priority one level at a time', () => {
    expect(elevateLockedPriorityOneLevel('standard')).toBe('high')
    expect(elevateLockedPriorityOneLevel('critical')).toBe('critical')
  })
})

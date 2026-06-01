import { describe, it, expect } from 'vitest'
import { buildContactHistoryPanel } from '@/lib/queue/contact-history'
import type { QueueItem } from '@/lib/queue/types'
import type { MockPatient } from '@/lib/mock/patients'

const item: QueueItem = {
  id: 'q-hist',
  type: 'callback',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900002',
  callerState: 'confirmed',
  patientId: 'pat-002',
  title: 'Callback',
  summary: 'Test',
  confidence: 90,
  source: 'ai_call',
}

const patient: MockPatient = {
  id: 'pat-002',
  firstName: 'Sarah',
  lastName: 'Hussain',
  dob: '1990-07-22',
  phone: '07700900002',
  clinicId: 'clinic-1',
  isPrivate: true,
  outstandingBalance: 85,
  lastAppointment: '2024-09-03',
  nextAppointment: null,
  isFTA: true,
  isLapsed: false,
  notes: 'FTA – missed hygiene appointment 03/09/24',
}

describe('S109 contact history (E-3)', () => {
  it('builds collapsed panel entries for matched patients', () => {
    const panel = buildContactHistoryPanel({
      item,
      patient,
      allItems: [
        item,
        {
          ...item,
          id: 'q-old',
          status: 'resolved',
          title: 'Prior callback',
          updatedAt: '2026-05-30T12:00:00.000Z',
        },
      ],
    })
    expect(panel.show).toBe(true)
    expect(panel.collapsedByDefault).toBe(true)
    expect(panel.entries.some(e => e.label === 'FTA count')).toBe(true)
    expect(panel.entries.some(e => e.label === 'Holding SMS today')).toBe(true)
  })

  it('hides panel when no patient match', () => {
    const panel = buildContactHistoryPanel({
      item: { ...item, patientId: undefined },
      allItems: [item],
    })
    expect(panel.show).toBe(false)
  })
})

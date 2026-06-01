import { describe, it, expect } from 'vitest'
import {
  buildSamePatientBanner,
  findSamePatientOpenItems,
} from '@/lib/queue/same-patient-banner'
import type { QueueItem } from '@/lib/queue/types'

const base: QueueItem = {
  id: 'q-main',
  type: 'callback',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900001',
  callerState: 'confirmed',
  patientId: 'pat-001',
  title: 'Callback request',
  summary: 'Call back.',
  confidence: 80,
  source: 'ai_call',
}

const sibling: QueueItem = {
  id: 'q-sibling',
  type: 'booking_request',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T09:00:00.000Z',
  callerPhone: '07700900001',
  callerState: 'confirmed',
  patientId: 'pat-001',
  title: 'Hygiene booking',
  summary: 'Book hygiene.',
  confidence: 90,
  source: 'ai_call',
}

describe('S105 same-patient banner (E-1)', () => {
  it('hides banner when patient has no other open items', () => {
    const banner = buildSamePatientBanner({ currentItem: base, allItems: [base] })
    expect(banner.show).toBe(false)
  })

  it('shows count and links for other open items on the same patient', () => {
    const banner = buildSamePatientBanner({ currentItem: base, allItems: [base, sibling] })
    expect(banner.show).toBe(true)
    expect(banner.count).toBe(1)
    expect(banner.relatedItems[0].href).toBe('/queue/q-sibling')
    expect(banner.guidance).toContain('never auto-merged')
  })

  it('excludes terminal and other-clinic items', () => {
    const resolved = { ...sibling, status: 'resolved' as const }
    const otherClinic = { ...sibling, id: 'q-other', clinicId: 'clinic-2' }
    const open = findSamePatientOpenItems({
      currentItem: base,
      allItems: [base, resolved, otherClinic],
    })
    expect(open).toHaveLength(0)
  })

  it('hides banner when current item has no patient match', () => {
    const banner = buildSamePatientBanner({
      currentItem: { ...base, patientId: undefined },
      allItems: [base, sibling],
    })
    expect(banner.show).toBe(false)
  })
})

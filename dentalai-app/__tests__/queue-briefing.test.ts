import { describe, it, expect } from 'vitest'
import { buildHumanBriefingPanel, derivePatientToneWarning } from '@/lib/queue/briefing'
import type { QueueItem } from '@/lib/queue/types'

const baseItem: QueueItem = {
  id: 'q-test',
  type: 'booking_request',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900006',
  callerState: 'confirmed',
  patientId: 'pat-006',
  title: 'Routine checkup request',
  summary: 'Caller asked to book a routine checkup next month.',
  appointmentTypeId: 'routine_checkup',
  confidence: 88,
  ruleDecision: 'allow',
  source: 'ai_call',
}

describe('S092 human briefing panel (B-4)', () => {
  it('includes tone warning for emergency items', () => {
    expect(derivePatientToneWarning({ ...baseItem, type: 'emergency' })).toBe('distressed')
  })

  it('builds opening script with clinic and staff placeholders resolved', () => {
    const panel = buildHumanBriefingPanel({
      item: baseItem,
      patient: null,
      clinicName: 'GK Hawick',
      staffName: 'Alex',
    })
    expect(panel.suggestedOpeningScript).toContain('GK Hawick')
    expect(panel.suggestedOpeningScript).toContain('Alex')
    expect(panel.scriptEditableByClinic).toBe(true)
  })

  it('provides collapsed contact history, transcript, and AI timeline', () => {
    const panel = buildHumanBriefingPanel({ item: baseItem, patient: null })
    expect(panel.contactHistory.length).toBeGreaterThan(0)
    expect(panel.transcript.length).toBeGreaterThan(0)
    expect(panel.aiTimeline.length).toBeGreaterThan(0)
    expect(panel.defaultCollapsed).toBe(true)
  })

  it('omits tone message when tone is none', () => {
    const panel = buildHumanBriefingPanel({ item: baseItem, patient: null })
    expect(panel.toneWarning).toBe('none')
    expect(panel.toneMessage).toBeUndefined()
  })
})

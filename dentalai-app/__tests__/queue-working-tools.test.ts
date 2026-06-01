import { describe, it, expect } from 'vitest'
import {
  buildWorkingToolsPanel,
  deriveQueueLockState,
  suggestCallbackTime,
} from '@/lib/queue/working-tools'
import type { QueueItem } from '@/lib/queue/types'
import type { SessionActor } from '@/lib/access-control'

const baseItem: QueueItem = {
  id: 'q-tools',
  type: 'callback',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900006',
  callerState: 'confirmed',
  patientId: 'pat-006',
  title: 'Callback request',
  summary: 'Patient asked to be called back about hygiene.',
  confidence: 80,
  source: 'ai_call',
}

const actor: SessionActor = {
  userId: 'user-1',
  name: 'Alex',
  email: 'alex@example.com',
  role: 'receptionist',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1'],
}

describe('S095 working tools panel (B-6)', () => {
  it('provides autosave scratchpad key and holding SMS content', () => {
    const panel = buildWorkingToolsPanel({ item: baseItem, actor })
    expect(panel.scratchpadStorageKey).toBe('dentalai-scratchpad-q-tools')
    expect(panel.holdingSms.status).toBe('queued')
    expect(panel.holdingSms.content).toContain('Thanks for calling')
  })

  it('suggests afternoon callback after morning item creation', () => {
    expect(suggestCallbackTime('2026-06-01T10:00:00.000Z')).toContain('14:00')
  })

  it('tracks lock state for assigned items', () => {
    const lock = deriveQueueLockState({
      item: {
        ...baseItem,
        assignedTo: 'user-1',
        lockMode: 'hard_lock',
        lockAssignedAt: '2026-06-01T10:00:00.000Z',
        lockLastActivityAt: '2026-06-01T10:00:00.000Z',
      },
      actorUserId: 'user-1',
      assigneeName: 'Alex',
    })
    expect(lock.lockState).toBe('locked_by_self')
    expect(lock.lockExpiresAt).toBeDefined()
  })

  it('requires outcome selector for callback items', () => {
    const panel = buildWorkingToolsPanel({ item: baseItem, actor })
    expect(panel.requiredOutcome).toBe(true)
    expect(panel.showPatientCalledBack).toBe(true)
    expect(panel.outcomeOptions.length).toBeGreaterThan(0)
  })

  it('suppresses holding SMS when identity is withheld', () => {
    const panel = buildWorkingToolsPanel({
      item: { ...baseItem, callerState: 'withheld', confidence: 30 },
      actor,
    })
    expect(panel.holdingSms.status).toBe('suppressed')
    expect(panel.holdingSms.suppressionReason).toContain('withheld')
  })

  it('includes manager-visible audit trail hint', () => {
    const panel = buildWorkingToolsPanel({ item: baseItem, actor })
    expect(panel.auditTrailHint).toContain('audit trail')
  })
})

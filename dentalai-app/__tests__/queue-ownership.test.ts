import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildQueueLockView,
  buildQueueRowInProgressLabel,
  formatInProgressLabel,
  hardLockPatch,
  releaseLockPatch,
  shouldReleaseInactiveLock,
  shouldReleaseSessionLock,
  shouldShowInactiveTimer,
  softClaimPatch,
  sweepExpiredLocks,
} from '@/lib/queue/ownership'
import { validatePassReason, buildPassToColleaguePanel } from '@/lib/queue/colleague-presence'
import type { QueueItem } from '@/lib/queue/types'
import { __resetQueueForTests } from '@/lib/queue/store'

const base: QueueItem = {
  id: 'q-own',
  type: 'callback',
  priority: 'normal',
  status: 'pending',
  clinicId: 'clinic-1',
  createdAt: '2026-06-01T10:00:00.000Z',
  callerPhone: '07700900001',
  callerState: 'confirmed',
  title: 'Callback',
  summary: 'Please call back.',
  confidence: 80,
  source: 'ai_call',
}

describe('S099 auto-lock (D-1)', () => {
  it('formats in progress label for queue rows', () => {
    expect(formatInProgressLabel('Sarah Ahmed')).toBe('In progress — Sarah Ahmed')
    expect(buildQueueRowInProgressLabel(
      { ...base, assignedTo: 'user-1', lockMode: 'hard_lock' },
      'Sarah Ahmed',
    )).toBe('In progress — Sarah Ahmed')
  })

  it('shows timer after eight minutes', () => {
    const item: QueueItem = {
      ...base,
      assignedTo: 'user-1',
      lockMode: 'hard_lock',
      lockAssignedAt: '2026-06-01T10:00:00.000Z',
      lockLastActivityAt: '2026-06-01T10:00:00.000Z',
    }
    expect(shouldShowInactiveTimer(item, Date.parse('2026-06-01T10:07:00.000Z'))).toBe(false)
    expect(shouldShowInactiveTimer(item, Date.parse('2026-06-01T10:09:00.000Z'))).toBe(true)
  })

  it('releases after ten minutes inactivity and preserves draft notes', () => {
    const item: QueueItem = {
      ...base,
      assignedTo: 'user-1',
      lockMode: 'hard_lock',
      lockLastActivityAt: '2026-06-01T10:00:00.000Z',
      notes: 'Called once — no answer',
    }
    expect(shouldReleaseInactiveLock(item, Date.parse('2026-06-01T10:11:00.000Z'))).toBe(true)
    const patch = releaseLockPatch(item, item.notes)
    expect(patch.assignedTo).toBeUndefined()
    expect(patch.draftNotes).toContain('no answer')
  })

  it('marks read-only when hard locked by another user', () => {
    const view = buildQueueLockView({
      item: {
        ...base,
        assignedTo: 'user-2',
        lockMode: 'hard_lock',
        lockAssignedAt: '2026-06-01T10:00:00.000Z',
        lockLastActivityAt: '2026-06-01T10:00:00.000Z',
      },
      actorUserId: 'user-1',
      assigneeName: 'Hamza Khan',
    })
    expect(view.readOnlyForActor).toBe(true)
    expect(view.inProgressLabel).toBe('In progress — Hamza Khan')
  })
})

describe('S100 soft claim (D-2)', () => {
  it('soft claim does not start inactivity until hard lock', () => {
    const patch = softClaimPatch('user-1', '2026-06-01T10:00:00.000Z')
    expect(patch.lockMode).toBe('soft_claim')
    expect(patch.lockLastActivityAt).toBeUndefined()
    const view = buildQueueLockView({
      item: { ...base, ...patch },
      actorUserId: 'user-1',
    })
    expect(view.uiState).toBe('soft_claim_by_self')
    expect(shouldReleaseInactiveLock({ ...base, ...patch }, Date.now())).toBe(false)
  })

  it('hard lock patch sets activity timestamps', () => {
    const patch = hardLockPatch('user-1', '2026-06-01T10:00:00.000Z')
    expect(patch.lockMode).toBe('hard_lock')
    expect(patch.lockLastActivityAt).toBe('2026-06-01T10:00:00.000Z')
  })
})

describe('S101 pass to colleague (D-3)', () => {
  beforeEach(() => {
    __resetQueueForTests()
  })

  it('requires five character pass reason', () => {
    expect(validatePassReason('hi').ok).toBe(false)
    expect(validatePassReason('handover to afternoon shift').ok).toBe(true)
  })

  it('lists same-clinic colleagues when holder can pass', () => {
    const panel = buildPassToColleaguePanel({
      item: {
        ...base,
        assignedTo: 'user-1',
        lockMode: 'hard_lock',
      },
      actorUserId: 'user-1',
      clinicId: 'clinic-1',
      allClinicItems: [],
    })
    expect(panel.visible).toBe(true)
    expect(panel.colleagues.length).toBeGreaterThan(0)
    expect(panel.minReasonLength).toBe(5)
  })
})

describe('S102 session release (D-4)', () => {
  it('releases session-ended locks after two minutes', () => {
    const item: QueueItem = {
      ...base,
      assignedTo: 'user-1',
      lockMode: 'hard_lock',
      lockSessionEndedAt: '2026-06-01T10:00:00.000Z',
    }
    expect(shouldReleaseSessionLock(item, Date.parse('2026-06-01T10:01:00.000Z'))).toBe(false)
    expect(shouldReleaseSessionLock(item, Date.parse('2026-06-01T10:02:30.000Z'))).toBe(true)
  })

  it('sweep applies release patches in batch', () => {
    const stale: QueueItem = {
      ...base,
      id: 'q-stale',
      assignedTo: 'user-1',
      lockMode: 'hard_lock',
      lockLastActivityAt: '2026-06-01T09:00:00.000Z',
      notes: 'draft work',
    }
    const updates = sweepExpiredLocks([stale], Date.parse('2026-06-01T10:30:00.000Z'))
    expect(updates).toHaveLength(1)
    expect(updates[0].patch.draftNotes).toBeDefined()
  })
})

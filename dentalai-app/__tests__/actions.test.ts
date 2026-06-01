/**
 * Server action pipeline tests.
 *
 * Tests the full action pipeline end-to-end against the in-memory store:
 *   input validation → session auth → clinic access → permission check → store mutation → audit log
 *
 * 'use server' is a string literal that esbuild drops — actions run as plain async functions here.
 * requireSession + revalidatePath are mocked so no Next.js runtime is needed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SessionActor } from '@/lib/access-control'

// ── Hoist mocks before any module loads ──────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/access', () => {
  // Replicate the pure access-control logic inline so we don't trigger
  // lib/auth → lib/env → env-var validation on module load.
  class AccessDeniedError extends Error {
    userId: string
    clinicId: string
    constructor(userId: string, clinicId: string) {
      super(`Access denied: user ${userId} cannot access clinic ${clinicId}`)
      this.name = 'AccessDeniedError'
      this.userId = userId
      this.clinicId = clinicId
    }
  }

  function canAccessClinic(actor: { role: string; clinicIds: string[] }, clinicId: string): boolean {
    if (actor.role === 'super_admin') return true
    return actor.clinicIds.includes(clinicId)
  }

  function assertClinicAccess(actor: { role: string; clinicIds: string[]; userId: string }, clinicId: string): void {
    if (!canAccessClinic(actor, clinicId)) {
      throw new AccessDeniedError(actor.userId, clinicId)
    }
  }

  return {
    requireSession: vi.fn(),
    canAccessClinic,
    assertClinicAccess,
    AccessDeniedError,
    accessibleClinics: (actor: { clinicIds: string[] }) => actor.clinicIds,
  }
})

// ── Imports (after mocks are hoisted) ────────────────────────────────────────

import { requireSession } from '@/lib/access'
import {
  approveQueueItem,
  rejectQueueItem,
  resolveQueueItem,
  escalateQueueItem,
  recordEmergencyOutcome,
  recordCallbackAttempt,
  modifyAndApproveQueueItem,
  acknowledgeQueueItem,
} from '@/lib/queue/actions'
import { getQueueItem } from '@/lib/queue/store'
import { getAuditEvents } from '@/lib/audit/store'

// ── Actors ────────────────────────────────────────────────────────────────────

const MANAGER: SessionActor = {
  userId: 'user-mgr-1',
  name: 'Test Manager',
  email: 'manager@test.com',
  role: 'practice_manager',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1'],
}

const RECEPTIONIST: SessionActor = {
  userId: 'user-rec-1',
  name: 'Test Receptionist',
  email: 'reception@test.com',
  role: 'receptionist',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1'],
}

const OTHER_CLINIC: SessionActor = {
  userId: 'user-other-1',
  name: 'Other Clinic Manager',
  email: 'other@test.com',
  role: 'practice_manager',
  clinicId: 'clinic-9',
  clinicIds: ['clinic-9'],
}

function asSession(actor: SessionActor) {
  vi.mocked(requireSession).mockResolvedValue(actor)
}

// ── Test store helpers ─────────────────────────────────────────────────────────

const globalStore = globalThis as typeof globalThis & {
  __queueItems?: import('@/lib/queue/types').QueueItem[]
  __auditEvents?: import('@/lib/audit/types').AuditEvent[]
}

function seedItem(overrides: Partial<import('@/lib/queue/types').QueueItem> & { id: string }): void {
  // Spread overrides last so any explicit field wins over the defaults.
  // id is required in overrides so it is always present in the final object.
  const base: import('@/lib/queue/types').QueueItem = {
    type: 'booking_request',
    priority: 'normal',
    status: 'pending',
    clinicId: 'clinic-1',
    createdAt: new Date().toISOString(),
    callerPhone: '07700900001',
    callerState: 'confirmed',
    title: 'Test item',
    summary: 'Test summary',
    confidence: 90,
    ruleDecision: 'allow',
    ruleReasons: ['All checks passed'],
    source: 'mock',
    ...overrides,
  }
  globalStore.__queueItems = (globalStore.__queueItems ?? []).filter(i => i.id !== overrides.id)
  globalStore.__queueItems.unshift(base)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Clear audit events between tests for isolation
  globalStore.__auditEvents = []
  // Seed standard test items
  seedItem({ id: 'test-booking-1', type: 'booking_request', clinicId: 'clinic-1' })
  seedItem({ id: 'test-emergency-1', type: 'emergency', priority: 'urgent', clinicId: 'clinic-1' })
  seedItem({ id: 'test-callback-1', type: 'callback', clinicId: 'clinic-1' })
  seedItem({ id: 'test-recall-1', type: 'recall', clinicId: 'clinic-1' })
  seedItem({ id: 'test-resolved-1', type: 'booking_request', status: 'approved', clinicId: 'clinic-1' })
})

// ── Input validation ──────────────────────────────────────────────────────────

describe('input validation', () => {
  it('rejects malformed item IDs', async () => {
    asSession(MANAGER)
    const result = await approveQueueItem('../../../etc/passwd')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('Invalid item ID')
  })

  it('rejects empty item IDs', async () => {
    asSession(MANAGER)
    const result = await approveQueueItem('')
    expect(result.ok).toBe(false)
  })

  it('rejects item IDs with special characters', async () => {
    asSession(MANAGER)
    const result = await approveQueueItem('item<script>alert(1)</script>')
    expect(result.ok).toBe(false)
  })

  it('rejects emergency outcome with notes under 5 characters', async () => {
    asSession(MANAGER)
    const result = await recordEmergencyOutcome('test-emergency-1', 'contacted', 'hi')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('5 character')
  })

  it('rejects emergency outcome with invalid outcome enum', async () => {
    asSession(MANAGER)
    const result = await recordEmergencyOutcome('test-emergency-1', 'not_a_real_outcome', 'Valid notes here')
    expect(result.ok).toBe(false)
  })

  it('rejects escalate with empty reason', async () => {
    asSession(MANAGER)
    const result = await escalateQueueItem('test-booking-1', '')
    expect(result.ok).toBe(false)
  })
})

// ── Clinic access control ─────────────────────────────────────────────────────

describe('clinic access', () => {
  it('denies action when actor is in a different clinic', async () => {
    asSession(OTHER_CLINIC)
    const result = await approveQueueItem('test-booking-1')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('permission')
  })

  it('logs access.denied audit event when clinic mismatch', async () => {
    asSession(OTHER_CLINIC)
    await approveQueueItem('test-booking-1')
    const denied = getAuditEvents({ action: 'access.denied', clinicId: 'clinic-1' })
    expect(denied.length).toBeGreaterThan(0)
  })

  it('returns not-found error for non-existent items', async () => {
    asSession(MANAGER)
    const result = await approveQueueItem('does-not-exist')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('not found')
  })
})

// ── Role permission gating ────────────────────────────────────────────────────

describe('role permission gating', () => {
  describe('receptionist', () => {
    it('can approve booking requests', async () => {
      asSession(RECEPTIONIST)
      const result = await approveQueueItem('test-booking-1')
      expect(result.ok).toBe(true)
    })

    it('can reject booking requests', async () => {
      asSession(RECEPTIONIST)
      seedItem({ id: 'test-booking-rec-reject', type: 'booking_request', clinicId: 'clinic-1' })
      const result = await rejectQueueItem('test-booking-rec-reject')
      expect(result.ok).toBe(true)
    })

    it('cannot approve when rules engine blocked the request', async () => {
      asSession(RECEPTIONIST)
      seedItem({ id: 'test-booking-blocked', type: 'booking_request', clinicId: 'clinic-1', ruleDecision: 'block' })
      const result = await approveQueueItem('test-booking-blocked')
      expect(result.ok).toBe(false)
      expect((result as { ok: false; error: string }).error).toContain('blocked')
    })

    it('can reject when rules engine blocked the request', async () => {
      asSession(RECEPTIONIST)
      seedItem({ id: 'test-booking-blocked-reject', type: 'booking_request', clinicId: 'clinic-1', ruleDecision: 'block' })
      const result = await rejectQueueItem('test-booking-blocked-reject')
      expect(result.ok).toBe(true)
    })

    it('cannot generically resolve a callback', async () => {
      asSession(RECEPTIONIST)
      const result = await resolveQueueItem('test-callback-1')
      expect(result.ok).toBe(false)
    })

    it('cannot escalate items', async () => {
      asSession(RECEPTIONIST)
      const result = await escalateQueueItem('test-booking-1', 'needs escalating')
      expect(result.ok).toBe(false)
    })

    it('can acknowledge any pending item', async () => {
      asSession(RECEPTIONIST)
      const result = await acknowledgeQueueItem('test-booking-1')
      expect(result.ok).toBe(true)
    })

    it('can record emergency outcome', async () => {
      asSession(RECEPTIONIST)
      const result = await recordEmergencyOutcome(
        'test-emergency-1',
        'contacted',
        'Patient called back and was advised to attend today',
      )
      expect(result.ok).toBe(true)
    })

    it('logs permission denied audit event for blocked rules approval', async () => {
      asSession(RECEPTIONIST)
      seedItem({ id: 'test-booking-blocked-audit', type: 'booking_request', clinicId: 'clinic-1', ruleDecision: 'block' })
      await approveQueueItem('test-booking-blocked-audit')
      const denied = getAuditEvents({ action: 'access.denied' })
      expect(denied.length).toBeGreaterThan(0)
    })
  })

  describe('practice_manager', () => {
    it('can approve booking requests', async () => {
      asSession(MANAGER)
      const result = await approveQueueItem('test-booking-1')
      expect(result.ok).toBe(true)
    })

    it('can reject booking requests', async () => {
      asSession(MANAGER)
      seedItem({ id: 'test-booking-2', type: 'booking_request', clinicId: 'clinic-1' })
      const result = await rejectQueueItem('test-booking-2')
      expect(result.ok).toBe(true)
    })

    it('can escalate items', async () => {
      asSession(MANAGER)
      seedItem({ id: 'test-booking-3', type: 'booking_request', clinicId: 'clinic-1' })
      const result = await escalateQueueItem('test-booking-3', 'needs further review')
      expect(result.ok).toBe(true)
    })

    it('can modify and approve booking requests', async () => {
      asSession(MANAGER)
      seedItem({ id: 'test-booking-4', type: 'booking_request', clinicId: 'clinic-1' })
      const result = await modifyAndApproveQueueItem('test-booking-4', {
        notes: 'Changed to hygiene appointment after discussion',
        appointmentTypeId: 'hygiene',
      })
      expect(result.ok).toBe(true)
    })
  })
})

// ── Type-action gating ────────────────────────────────────────────────────────

describe('type-action gating (defense-in-depth)', () => {
  it('blocks generic resolve on emergency — permissions matrix layer', async () => {
    asSession(MANAGER)
    const result = await resolveQueueItem('test-emergency-1')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('Emergency items')
  })

  it('blocks generic resolve on booking_request', async () => {
    asSession(MANAGER)
    seedItem({ id: 'test-booking-resolve', type: 'booking_request', clinicId: 'clinic-1' })
    const result = await resolveQueueItem('test-booking-resolve')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('Booking requests')
  })

  it('blocks approve_request on emergency', async () => {
    asSession(MANAGER)
    const result = await approveQueueItem('test-emergency-1')
    expect(result.ok).toBe(false)
  })

  it('blocks emergency_outcome on non-emergency items', async () => {
    asSession(MANAGER)
    const result = await recordEmergencyOutcome(
      'test-booking-1',
      'contacted',
      'Valid notes for a non-emergency item',
    )
    expect(result.ok).toBe(false)
  })
})

// ── Successful action pipelines ───────────────────────────────────────────────

describe('successful action pipelines', () => {
  describe('approve booking request', () => {
    it('sets status to approved', async () => {
      asSession(MANAGER)
      const result = await approveQueueItem('test-booking-1')
      expect(result.ok).toBe(true)
      const item = getQueueItem('test-booking-1')
      expect(item?.status).toBe('approved')
    })

    it('records resolvedBy and resolvedAt', async () => {
      asSession(MANAGER)
      await approveQueueItem('test-booking-1')
      const item = getQueueItem('test-booking-1')
      expect(item?.resolvedBy).toBe(MANAGER.userId)
      expect(item?.resolvedAt).toBeTruthy()
    })

    it('creates a booking.request_approved audit event', async () => {
      asSession(MANAGER)
      await approveQueueItem('test-booking-1')
      const events = getAuditEvents({ action: 'booking.request_approved', clinicId: 'clinic-1' })
      expect(events.length).toBe(1)
      expect(events[0].actor.userId).toBe(MANAGER.userId)
      expect(events[0].status).toBe('success')
    })
  })

  describe('reject booking request', () => {
    it('sets status to rejected', async () => {
      asSession(MANAGER)
      const result = await rejectQueueItem('test-booking-1', 'Patient has outstanding balance')
      expect(result.ok).toBe(true)
      const item = getQueueItem('test-booking-1')
      expect(item?.status).toBe('rejected')
    })

    it('stores the rejection reason in notes', async () => {
      asSession(MANAGER)
      await rejectQueueItem('test-booking-1', 'Outstanding balance — call needed first')
      const item = getQueueItem('test-booking-1')
      expect(item?.notes).toBe('Outstanding balance — call needed first')
    })

    it('creates a booking.request_rejected audit event', async () => {
      asSession(MANAGER)
      await rejectQueueItem('test-booking-1')
      const events = getAuditEvents({ action: 'booking.request_rejected', clinicId: 'clinic-1' })
      expect(events.length).toBe(1)
    })
  })

  describe('emergency outcome', () => {
    it('sets status to resolved with outcome prefix in notes', async () => {
      asSession(MANAGER)
      const result = await recordEmergencyOutcome(
        'test-emergency-1',
        'transferred',
        'Transferred to on-call dentist for same-day slot',
      )
      expect(result.ok).toBe(true)
      const item = getQueueItem('test-emergency-1')
      expect(item?.status).toBe('resolved')
      expect(item?.notes).toContain('[TRANSFERRED]')
      expect(item?.notes).toContain('Transferred to on-call dentist')
    })

    it('creates a queue.emergency_outcome_recorded audit event', async () => {
      asSession(MANAGER)
      await recordEmergencyOutcome(
        'test-emergency-1',
        'contacted',
        'Patient contacted successfully and booked in',
      )
      const events = getAuditEvents({ action: 'queue.emergency_outcome_recorded', clinicId: 'clinic-1' })
      expect(events.length).toBe(1)
      expect(events[0].metadata?.outcome).toBe('contacted')
    })
  })

  describe('callback attempt', () => {
    it('reached: sets status to resolved', async () => {
      asSession(MANAGER)
      const result = await recordCallbackAttempt('test-callback-1', 'reached')
      expect(result.ok).toBe(true)
      const item = getQueueItem('test-callback-1')
      expect(item?.status).toBe('resolved')
    })

    it('unable_to_reach: keeps status as acknowledged', async () => {
      asSession(MANAGER)
      const result = await recordCallbackAttempt('test-callback-1', 'unable_to_reach')
      expect(result.ok).toBe(true)
      const item = getQueueItem('test-callback-1')
      expect(item?.status).toBe('acknowledged')
    })
  })

  describe('modify and approve', () => {
    it('sets status to approved and records modified audit event', async () => {
      asSession(MANAGER)
      seedItem({ id: 'test-modify-1', type: 'booking_request', clinicId: 'clinic-1' })
      const result = await modifyAndApproveQueueItem('test-modify-1', {
        notes: 'Switched to hygiene — patient agreed',
        appointmentTypeId: 'hygiene',
      })
      expect(result.ok).toBe(true)
      const item = getQueueItem('test-modify-1')
      expect(item?.status).toBe('approved')
      const events = getAuditEvents({ action: 'booking.request_modified', clinicId: 'clinic-1' })
      expect(events.length).toBe(1)
    })
  })

  describe('escalate', () => {
    it('sets status to escalated', async () => {
      asSession(MANAGER)
      seedItem({ id: 'test-escalate-1', type: 'booking_request', clinicId: 'clinic-1' })
      const result = await escalateQueueItem('test-escalate-1', 'Complex case — manager review needed')
      expect(result.ok).toBe(true)
      const item = getQueueItem('test-escalate-1')
      expect(item?.status).toBe('escalated')
    })

    it('stores the escalation reason', async () => {
      asSession(MANAGER)
      seedItem({ id: 'test-escalate-2', type: 'booking_request', clinicId: 'clinic-1' })
      await escalateQueueItem('test-escalate-2', 'High-value patient needs personal callback')
      const item = getQueueItem('test-escalate-2')
      expect(item?.notes).toBe('High-value patient needs personal callback')
    })
  })
})

// ── Terminal-state guard ─────────────────────────────────────────────────────

describe('already-resolved items', () => {
  it('blocks acknowledge on an approved item and preserves the terminal status', async () => {
    asSession(MANAGER)

    const result = await acknowledgeQueueItem('test-resolved-1')

    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('already closed')
    expect(getQueueItem('test-resolved-1')?.status).toBe('approved')

    const events = getAuditEvents({ action: 'access.denied', clinicId: 'clinic-1' })
    expect(events).toHaveLength(1)
    expect(events[0]?.metadata?.reason).toBe('terminal_state')
    expect(events[0]?.metadata?.itemStatus).toBe('approved')
  })

  it('blocks modify-and-approve on a rejected item', async () => {
    asSession(MANAGER)
    seedItem({ id: 'test-terminal-rejected', type: 'booking_request', status: 'rejected', clinicId: 'clinic-1' })

    const result = await modifyAndApproveQueueItem('test-terminal-rejected', {
      notes: 'Attempting to reopen a closed request',
      appointmentTypeId: 'hygiene',
    })

    expect(result.ok).toBe(false)
    expect(getQueueItem('test-terminal-rejected')?.status).toBe('rejected')
  })

  it('blocks callback mutation on a resolved callback item', async () => {
    asSession(MANAGER)
    seedItem({ id: 'test-terminal-callback', type: 'callback', status: 'resolved', clinicId: 'clinic-1' })

    const result = await recordCallbackAttempt('test-terminal-callback', 'unable_to_reach')

    expect(result.ok).toBe(false)
    expect(getQueueItem('test-terminal-callback')?.status).toBe('resolved')
  })
})

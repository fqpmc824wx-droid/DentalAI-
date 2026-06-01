/**
 * Queue permission matrix tests.
 *
 * Locked target: active receptionists and practice managers can approve ordinary
 * booking requests (first claim wins at the queue layer). Rules-engine Block
 * disables approve/modify — not reject.
 */

import { describe, it, expect } from 'vitest'
import {
  canRolePerformAction,
  isActionValidForType,
  isBookingApprovalBlockedByRules,
  assertActionPermitted,
  assertBookingMutationPermitted,
  PermissionDeniedError,
} from '@/lib/queue/permissions'

describe('canRolePerformAction', () => {
  describe('receptionist', () => {
    it('can approve booking requests', () => {
      expect(canRolePerformAction('receptionist', 'approve_request')).toBe(true)
    })
    it('can reject booking requests', () => {
      expect(canRolePerformAction('receptionist', 'reject_request')).toBe(true)
    })
    it('can modify booking requests', () => {
      expect(canRolePerformAction('receptionist', 'modify_request')).toBe(true)
    })
    it('cannot generically resolve', () => {
      expect(canRolePerformAction('receptionist', 'resolve')).toBe(false)
    })
    it('cannot escalate', () => {
      expect(canRolePerformAction('receptionist', 'escalate')).toBe(false)
    })
    it('can acknowledge', () => {
      expect(canRolePerformAction('receptionist', 'acknowledge')).toBe(true)
    })
    it('can callback', () => {
      expect(canRolePerformAction('receptionist', 'callback')).toBe(true)
    })
    it('can record emergency outcome', () => {
      expect(canRolePerformAction('receptionist', 'emergency_outcome')).toBe(true)
    })
  })

  describe('practice_manager', () => {
    it('can approve booking requests', () => {
      expect(canRolePerformAction('practice_manager', 'approve_request')).toBe(true)
    })
    it('can reject booking requests', () => {
      expect(canRolePerformAction('practice_manager', 'reject_request')).toBe(true)
    })
    it('can modify booking requests', () => {
      expect(canRolePerformAction('practice_manager', 'modify_request')).toBe(true)
    })
    it('can resolve', () => {
      expect(canRolePerformAction('practice_manager', 'resolve')).toBe(true)
    })
    it('can escalate', () => {
      expect(canRolePerformAction('practice_manager', 'escalate')).toBe(true)
    })
  })

  describe('group_owner', () => {
    it('matches practice_manager permissions', () => {
      const actions = [
        'acknowledge', 'approve_request', 'reject_request', 'modify_request',
        'callback', 'callback_unable', 'escalate', 'resolve', 'emergency_outcome',
      ] as const
      for (const a of actions) {
        expect(canRolePerformAction('group_owner', a)).toBe(true)
      }
    })
  })

  describe('super_admin', () => {
    it('has all permissions', () => {
      const actions = [
        'acknowledge', 'approve_request', 'reject_request', 'modify_request',
        'callback', 'callback_unable', 'escalate', 'resolve', 'emergency_outcome',
      ] as const
      for (const a of actions) {
        expect(canRolePerformAction('super_admin', a)).toBe(true)
      }
    })
  })
})

describe('isActionValidForType', () => {
  describe('emergency items', () => {
    it('cannot be generically resolved', () => {
      expect(isActionValidForType('emergency', 'resolve')).toBe(false)
    })
    it('must use emergency_outcome', () => {
      expect(isActionValidForType('emergency', 'emergency_outcome')).toBe(true)
    })
    it('cannot be approved as a booking', () => {
      expect(isActionValidForType('emergency', 'approve_request')).toBe(false)
    })
  })

  describe('booking_request items', () => {
    it('cannot be generically resolved', () => {
      expect(isActionValidForType('booking_request', 'resolve')).toBe(false)
    })
    it('can be approved', () => {
      expect(isActionValidForType('booking_request', 'approve_request')).toBe(true)
    })
  })
})

describe('isBookingApprovalBlockedByRules', () => {
  it('blocks approve and modify when ruleDecision is block', () => {
    expect(isBookingApprovalBlockedByRules('booking_request', 'block', 'approve_request')).toBe(true)
    expect(isBookingApprovalBlockedByRules('booking_request', 'block', 'modify_request')).toBe(true)
  })
  it('does not block reject when ruleDecision is block', () => {
    expect(isBookingApprovalBlockedByRules('booking_request', 'block', 'reject_request')).toBe(false)
  })
  it('does not block when ruleDecision is allow or review', () => {
    expect(isBookingApprovalBlockedByRules('booking_request', 'allow', 'approve_request')).toBe(false)
    expect(isBookingApprovalBlockedByRules('booking_request', 'review', 'modify_request')).toBe(false)
  })
})

describe('assertActionPermitted', () => {
  it('allows receptionist to approve booking requests at role/type layer', () => {
    expect(() => assertActionPermitted('receptionist', 'booking_request', 'approve_request'))
      .not.toThrow()
  })

  it('throws when action is invalid for type', () => {
    expect(() => assertActionPermitted('practice_manager', 'emergency', 'resolve'))
      .toThrow(PermissionDeniedError)
  })
})

describe('assertBookingMutationPermitted', () => {
  it('throws when rules engine blocked approval', () => {
    expect(() =>
      assertBookingMutationPermitted('receptionist', 'booking_request', 'block', 'approve_request'),
    ).toThrow(PermissionDeniedError)
  })

  it('allows receptionist approve when rules allow', () => {
    expect(() =>
      assertBookingMutationPermitted('receptionist', 'booking_request', 'allow', 'approve_request'),
    ).not.toThrow()
  })

  it('allows reject even when rules block approval', () => {
    expect(() =>
      assertBookingMutationPermitted('receptionist', 'booking_request', 'block', 'reject_request'),
    ).not.toThrow()
  })
})

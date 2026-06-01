import { describe, it, expect, beforeEach } from 'vitest'
import {
  requiresAccessReason,
  assertClinicAccessWithReason,
  AccessReasonRequiredError,
} from '@/lib/access-control'
import type { SessionActor } from '@/lib/access-control'
import { getAuditEvents, __resetAuditForTests } from '@/lib/audit/store'

beforeEach(() => {
  __resetAuditForTests()
})

const superAdmin: SessionActor = {
  userId: 'user-4',
  name: 'DentalAI Admin',
  email: 'admin@dentalai.co.uk',
  role: 'super_admin',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1', 'clinic-2', 'clinic-3'],
}

const receptionist: SessionActor = {
  userId: 'user-1',
  name: 'Sarah Ahmed',
  email: 'reception@smile-dental.co.uk',
  role: 'receptionist',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1'],
}

describe('requiresAccessReason', () => {
  it('is false for super_admin within assigned clinics', () => {
    expect(requiresAccessReason(superAdmin, 'clinic-1')).toBe(false)
    expect(requiresAccessReason(superAdmin, 'clinic-2')).toBe(false)
  })

  it('is true for super_admin cross-estate clinic access', () => {
    expect(requiresAccessReason(superAdmin, 'clinic-99')).toBe(true)
  })

  it('is false for non-super_admin roles', () => {
    expect(requiresAccessReason(receptionist, 'clinic-99')).toBe(false)
  })
})

describe('assertClinicAccessWithReason', () => {
  it('allows super_admin cross-estate access with a documented reason', () => {
    expect(() =>
      assertClinicAccessWithReason(superAdmin, 'clinic-99', 'Incident response for estate rollout'),
    ).not.toThrow()

    const events = getAuditEvents({ action: 'access.reason_logged', clinicId: 'clinic-99' })
    expect(events.length).toBe(1)
    expect(events[0]?.metadata?.crossEstate).toBe(true)
  })

  it('blocks super_admin cross-estate access without a sufficient reason', () => {
    expect(() => assertClinicAccessWithReason(superAdmin, 'clinic-99', 'bad')).toThrow(
      AccessReasonRequiredError,
    )
    expect(getAuditEvents({ action: 'access.reason_logged' }).length).toBe(0)
  })

  it('does not require a reason for assigned clinics', () => {
    expect(() => assertClinicAccessWithReason(superAdmin, 'clinic-1')).not.toThrow()
    expect(getAuditEvents({ action: 'access.reason_logged' }).length).toBe(0)
  })
})

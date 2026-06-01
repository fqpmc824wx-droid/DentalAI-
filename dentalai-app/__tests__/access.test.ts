import { describe, it, expect } from 'vitest'
import { canAccessClinic, assertClinicAccess, AccessDeniedError } from '@/lib/access-control'
import type { SessionActor } from '@/lib/access-control'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const receptionist: SessionActor = {
  userId: 'user-1',
  name: 'Sarah Ahmed',
  email: 'reception@smile-dental.co.uk',
  role: 'receptionist',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1'],
}

const practiceManager: SessionActor = {
  userId: 'user-2',
  name: 'Hamza Khan',
  email: 'manager@smile-dental.co.uk',
  role: 'practice_manager',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1'],
}

const groupOwner: SessionActor = {
  userId: 'user-3',
  name: 'Dr Tariq Mahmood',
  email: 'owner@smile-dental.co.uk',
  role: 'group_owner',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1', 'clinic-2', 'clinic-3'],
}

const superAdmin: SessionActor = {
  userId: 'user-4',
  name: 'DentalAI Admin',
  email: 'admin@dentalai.co.uk',
  role: 'super_admin',
  clinicId: 'clinic-1',
  clinicIds: ['clinic-1', 'clinic-2', 'clinic-3'],
}

// ── canAccessClinic ───────────────────────────────────────────────────────────

describe('canAccessClinic', () => {
  describe('receptionist', () => {
    it('can access own clinic', () => {
      expect(canAccessClinic(receptionist, 'clinic-1')).toBe(true)
    })

    it('cannot access another clinic', () => {
      expect(canAccessClinic(receptionist, 'clinic-2')).toBe(false)
    })

    it('cannot access a third clinic', () => {
      expect(canAccessClinic(receptionist, 'clinic-3')).toBe(false)
    })
  })

  describe('practice_manager', () => {
    it('can access own clinic', () => {
      expect(canAccessClinic(practiceManager, 'clinic-1')).toBe(true)
    })

    it('cannot access another clinic', () => {
      expect(canAccessClinic(practiceManager, 'clinic-2')).toBe(false)
    })
  })

  describe('group_owner', () => {
    it('can access all assigned clinics', () => {
      expect(canAccessClinic(groupOwner, 'clinic-1')).toBe(true)
      expect(canAccessClinic(groupOwner, 'clinic-2')).toBe(true)
      expect(canAccessClinic(groupOwner, 'clinic-3')).toBe(true)
    })

    it('cannot access clinic not in their group', () => {
      expect(canAccessClinic(groupOwner, 'clinic-99')).toBe(false)
    })
  })

  describe('super_admin', () => {
    it('can access any clinic regardless of clinicIds', () => {
      expect(canAccessClinic(superAdmin, 'clinic-1')).toBe(true)
      expect(canAccessClinic(superAdmin, 'clinic-2')).toBe(true)
      expect(canAccessClinic(superAdmin, 'clinic-99')).toBe(true)
      expect(canAccessClinic(superAdmin, 'some-random-clinic')).toBe(true)
    })
  })
})

// ── assertClinicAccess ────────────────────────────────────────────────────────

describe('assertClinicAccess', () => {
  it('does not throw when access is allowed', () => {
    expect(() => assertClinicAccess(receptionist, 'clinic-1')).not.toThrow()
    expect(() => assertClinicAccess(groupOwner, 'clinic-2')).not.toThrow()
    expect(() => assertClinicAccess(superAdmin, 'clinic-99')).not.toThrow()
  })

  it('throws AccessDeniedError when access is denied', () => {
    expect(() => assertClinicAccess(receptionist, 'clinic-2')).toThrow(AccessDeniedError)
    expect(() => assertClinicAccess(practiceManager, 'clinic-3')).toThrow(AccessDeniedError)
    expect(() => assertClinicAccess(groupOwner, 'clinic-99')).toThrow(AccessDeniedError)
  })

  it('AccessDeniedError carries userId and clinicId', () => {
    try {
      assertClinicAccess(receptionist, 'clinic-2')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AccessDeniedError)
      const e = err as AccessDeniedError
      expect(e.userId).toBe('user-1')
      expect(e.clinicId).toBe('clinic-2')
    }
  })

  it('error message is human-readable', () => {
    try {
      assertClinicAccess(receptionist, 'clinic-2')
    } catch (err) {
      expect((err as Error).message).toContain('user-1')
      expect((err as Error).message).toContain('clinic-2')
    }
  })
})

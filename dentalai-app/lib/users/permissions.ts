import type { Role } from '@/types'
import type { SessionActor } from '@/lib/access-control'

const STAFF_MANAGER_ROLES: Role[] = ['practice_manager', 'group_owner', 'super_admin']

export function canManageStaff(actor: SessionActor): boolean {
  return STAFF_MANAGER_ROLES.includes(actor.role)
}

export function canManageRole(actor: SessionActor, targetRole: Role): boolean {
  if (!canManageStaff(actor)) return false
  if (actor.role === 'super_admin') return true
  if (actor.role === 'group_owner') {
    return targetRole === 'receptionist' || targetRole === 'practice_manager'
  }
  if (actor.role === 'practice_manager') {
    return targetRole === 'receptionist'
  }
  return false
}

export function canManageUser(actor: SessionActor, targetClinicIds: string[]): boolean {
  if (!canManageStaff(actor)) return false
  if (actor.role === 'super_admin') return true
  return targetClinicIds.every(id => actor.clinicIds.includes(id))
}

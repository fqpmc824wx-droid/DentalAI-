import type { MockUser } from '@/types'
import { getUserByEmail as getStoredUserByEmail } from '@/lib/users/store'

export const MOCK_USERS: MockUser[] = [
  {
    id: 'user-1',
    email: 'reception@smile-dental.co.uk',
    password: 'demo',
    name: 'Sarah Ahmed',
    role: 'receptionist',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1'],
  },
  {
    id: 'user-2',
    email: 'manager@smile-dental.co.uk',
    password: 'demo',
    name: 'Hamza Khan',
    role: 'practice_manager',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1'],
  },
  {
    id: 'user-3',
    email: 'owner@smile-dental.co.uk',
    password: 'demo',
    name: 'Dr Tariq Mahmood',
    role: 'group_owner',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1', 'clinic-2', 'clinic-3'],
  },
  {
    id: 'user-4',
    email: 'admin@dentalai.co.uk',
    password: 'demo',
    name: 'DentalAI Admin',
    role: 'super_admin',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1', 'clinic-2', 'clinic-3'],
  },
]

/** @deprecated Use lib/users/store getUserByEmail — kept for tests referencing mock shape. */
export function findUserByEmail(email: string): MockUser | undefined {
  const user = getStoredUserByEmail(email)
  if (!user) return undefined
  return {
    id: user.id,
    email: user.email,
    password: 'demo',
    name: user.name,
    role: user.role,
    clinicId: user.clinicId,
    clinicIds: user.clinicIds,
  }
}

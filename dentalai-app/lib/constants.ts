import type { Role } from '@/types'

export const ROLE_LABELS: Record<Role, string> = {
  receptionist: 'Receptionist',
  practice_manager: 'Practice Manager',
  group_owner: 'Group Owner',
  super_admin: 'Super Admin',
}

export const ROLE_COLORS: Record<Role, string> = {
  receptionist: 'bg-blue-500/10 text-blue-400',
  practice_manager: 'bg-purple-500/10 text-purple-400',
  group_owner: 'bg-amber-500/10 text-amber-400',
  super_admin: 'bg-red-500/10 text-red-400',
}

import type { Role } from '@/types'

export type NavItem = {
  href: string
  label: string
  showCount?: boolean
}

export type RoleNavigation = {
  /** Up to four primary destinations (mobile bottom bar). */
  primary: NavItem[]
  /** Overflow destinations (More drawer / desktop secondary band). */
  more: NavItem[]
}

const PRIMARY_FOUR: NavItem[] = [
  { href: '/dashboard', label: 'Today' },
  { href: '/queue', label: 'Queue', showCount: true },
  { href: '/identity', label: 'Identity' },
  { href: '/rules', label: 'Rules' },
]

const MANAGER_MORE: NavItem[] = [
  { href: '/staff', label: 'Staff' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/audit', label: 'Audit' },
]

/** Primary + More navigation per role (K-6 four-role matrix). */
export const ROLE_NAVIGATION: Record<Role, RoleNavigation> = {
  receptionist: {
    primary: PRIMARY_FOUR,
    more: [],
  },
  practice_manager: {
    primary: PRIMARY_FOUR,
    more: MANAGER_MORE,
  },
  group_owner: {
    primary: PRIMARY_FOUR,
    more: MANAGER_MORE,
  },
  super_admin: {
    primary: PRIMARY_FOUR,
    more: MANAGER_MORE,
  },
}

export function navigationForRole(role: Role): RoleNavigation {
  return ROLE_NAVIGATION[role]
}

export function allNavItems(role: Role): NavItem[] {
  const nav = navigationForRole(role)
  return [...nav.primary, ...nav.more]
}

export function isNavItemVisible(role: Role, href: string): boolean {
  return allNavItems(role).some(item => item.href === href || href.startsWith(`${item.href}/`))
}

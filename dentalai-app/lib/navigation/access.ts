import type { Role } from '@/types'
import type { SessionActor } from '@/lib/access-control'
import { allNavItems } from '@/lib/navigation/menus'

const ALL_ROLES: Role[] = ['receptionist', 'practice_manager', 'group_owner', 'super_admin']
const MANAGER_ROLES: Role[] = ['practice_manager', 'group_owner', 'super_admin']

/** Route prefix → roles allowed. Must match navigation menus (K-6). */
export const ROUTE_ACCESS: Record<string, Role[] | 'all'> = {
  '/dashboard': 'all',
  '/queue': 'all',
  '/identity': 'all',
  '/rules': 'all',
  '/audit': MANAGER_ROLES,
  '/integrations': MANAGER_ROLES,
  '/staff': MANAGER_ROLES,
}

export function normalizeRoutePath(pathname: string): string {
  if (pathname === '/') return '/dashboard'
  const base = pathname.split('?')[0]
  const segments = base.split('/').filter(Boolean)
  if (segments.length === 0) return '/dashboard'
  return `/${segments[0]}`
}

export function rolesForRoute(pathname: string): Role[] {
  const base = normalizeRoutePath(pathname)
  const entry = ROUTE_ACCESS[base]
  if (!entry || entry === 'all') return ALL_ROLES
  return entry
}

export function canAccessRoute(role: Role, pathname: string): boolean {
  return rolesForRoute(pathname).includes(role)
}

export function deniedRouteRedirect(): string {
  return '/dashboard'
}

export function assertRouteAccess(actor: SessionActor, pathname: string): void {
  if (!canAccessRoute(actor.role, pathname)) {
    throw new RouteAccessDeniedError(actor.userId, actor.role, normalizeRoutePath(pathname))
  }
}

/** True when href appears in the role's Primary or More menu (dead link guard). */
export function isRegisteredNavRoute(role: Role, href: string): boolean {
  return allNavItems(role).some(item => href === item.href || href.startsWith(`${item.href}/`))
}

export class RouteAccessDeniedError extends Error {
  public readonly userId: string
  public readonly role: Role
  public readonly route: string

  constructor(userId: string, role: Role, route: string) {
    super(`Route access denied: ${role} cannot access ${route}`)
    this.name = 'RouteAccessDeniedError'
    this.userId = userId
    this.role = role
    this.route = route
  }
}

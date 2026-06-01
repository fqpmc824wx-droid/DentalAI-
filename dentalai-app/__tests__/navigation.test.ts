import { describe, expect, it } from 'vitest'
import {
  allNavItems,
  navigationForRole,
  ROLE_NAVIGATION,
} from '@/lib/navigation/menus'
import {
  canAccessRoute,
  normalizeRoutePath,
  rolesForRoute,
  RouteAccessDeniedError,
  assertRouteAccess,
} from '@/lib/navigation/access'
import type { SessionActor } from '@/lib/access-control'

describe('ROLE_NAVIGATION', () => {
  it('gives every role four primary work routes', () => {
    for (const role of Object.keys(ROLE_NAVIGATION) as (keyof typeof ROLE_NAVIGATION)[]) {
      const nav = navigationForRole(role)
      expect(nav.primary.map(i => i.href)).toEqual([
        '/dashboard',
        '/queue',
        '/identity',
        '/rules',
      ])
    }
  })

  it('hides manager-only links from receptionist More menu', () => {
    expect(navigationForRole('receptionist').more).toHaveLength(0)
  })

  it('shows integrations, staff, and audit for practice manager', () => {
    const more = navigationForRole('practice_manager').more.map(i => i.href)
    expect(more).toEqual(['/staff', '/integrations', '/audit'])
  })
})

describe('route access matrix', () => {
  it('allows all roles on queue work routes', () => {
    for (const role of ['receptionist', 'practice_manager', 'group_owner', 'super_admin'] as const) {
      expect(canAccessRoute(role, '/queue')).toBe(true)
      expect(canAccessRoute(role, '/queue/item-1')).toBe(true)
    }
  })

  it('blocks receptionist from integrations, staff, and audit', () => {
    expect(canAccessRoute('receptionist', '/integrations')).toBe(false)
    expect(canAccessRoute('receptionist', '/staff')).toBe(false)
    expect(canAccessRoute('receptionist', '/audit')).toBe(false)
  })

  it('allows managers onto admin routes', () => {
    expect(canAccessRoute('practice_manager', '/integrations')).toBe(true)
    expect(canAccessRoute('group_owner', '/staff')).toBe(true)
    expect(canAccessRoute('super_admin', '/staff')).toBe(true)
  })

  it('normalizes nested paths to route prefix', () => {
    expect(normalizeRoutePath('/queue/abc')).toBe('/queue')
    expect(normalizeRoutePath('/')).toBe('/dashboard')
  })

  it('restricts audit to manager roles', () => {
    expect(rolesForRoute('/audit')).toEqual([
      'practice_manager',
      'group_owner',
      'super_admin',
    ])
  })
})

describe('assertRouteAccess', () => {
  const receptionist: SessionActor = {
    userId: 'u1',
    name: 'Rec',
    email: 'r@test',
    role: 'receptionist',
    clinicId: 'clinic-1',
    clinicIds: ['clinic-1'],
  }

  it('throws RouteAccessDeniedError for blocked routes', () => {
    expect(() => assertRouteAccess(receptionist, '/staff')).toThrow(RouteAccessDeniedError)
    expect(() => assertRouteAccess(receptionist, '/audit')).toThrow(RouteAccessDeniedError)
  })

  it('does not throw for allowed routes', () => {
    expect(() => assertRouteAccess(receptionist, '/rules')).not.toThrow()
  })
})

describe('dead link guard', () => {
  it('only exposes registered hrefs per role', () => {
    const receptionistHrefs = allNavItems('receptionist').map(i => i.href)
    expect(receptionistHrefs.every(h => h.startsWith('/'))).toBe(true)
    expect(receptionistHrefs).not.toContain('/settings')
    expect(receptionistHrefs).not.toContain('/audit')
  })
})

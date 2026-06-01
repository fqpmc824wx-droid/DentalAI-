/**
 * P06 · S022 — browser acceptance criteria (automated + manual evidence).
 *
 * Manual browser re-run recorded 2026-06-01 late BST against localhost:3000:
 * - Unauthenticated /dashboard → /login redirect
 * - Receptionist sign-in (reception@smile-dental.co.uk / demo)
 * - Clinic-scoped dashboard ("GK Dental — Hawick")
 * - Primary nav: Today, Queue, Identity, Rules (no More drawer)
 * - /integrations, /staff, /audit → redirected to /dashboard for receptionist
 * - Hawick queue item /queue/q-001 renders; cross-clinic /queue/q-007 denied
 * - Practice manager sign-in shows Staff, Integrations, Audit in More nav
 * - Manager /integrations renders Dentally readiness (no token in page)
 * - Sign-out returns to /login; logged-in /login redirects to /dashboard
 * - CSP + companion headers present on HTML responses
 */

import { describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from '@/lib/security/headers'
import {
  canAccessRoute,
  deniedRouteRedirect,
} from '@/lib/navigation/access'
import { canAccessClinic } from '@/lib/access-control'
import { navigationForRole } from '@/lib/navigation/menus'
import type { SessionActor } from '@/lib/access-control'

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

describe('S022 auth and protected routes', () => {
  it('blocks receptionist from manager-only routes (middleware uses same matrix)', () => {
    expect(canAccessRoute('receptionist', '/integrations')).toBe(false)
    expect(canAccessRoute('receptionist', '/staff')).toBe(false)
    expect(canAccessRoute('receptionist', '/audit')).toBe(false)
    expect(deniedRouteRedirect()).toBe('/dashboard')
  })

  it('allows practice manager onto admin surfaces', () => {
    expect(canAccessRoute('practice_manager', '/integrations')).toBe(true)
    expect(canAccessRoute('practice_manager', '/staff')).toBe(true)
    expect(canAccessRoute('practice_manager', '/audit')).toBe(true)
  })
})

describe('S022 clinic access', () => {
  it('scopes receptionist to own clinic only', () => {
    expect(canAccessClinic(receptionist, 'clinic-1')).toBe(true)
    expect(canAccessClinic(receptionist, 'clinic-2')).toBe(false)
  })

  it('allows manager own clinic (single-clinic demo account)', () => {
    expect(canAccessClinic(practiceManager, 'clinic-1')).toBe(true)
    expect(canAccessClinic(practiceManager, 'clinic-2')).toBe(false)
  })
})

describe('S022 role navigation matrix', () => {
  it('exposes four primary routes for every role', () => {
    for (const role of ['receptionist', 'practice_manager', 'group_owner', 'super_admin'] as const) {
      expect(navigationForRole(role).primary.map(i => i.href)).toEqual([
        '/dashboard',
        '/queue',
        '/identity',
        '/rules',
      ])
    }
  })

  it('hides More drawer links from receptionist', () => {
    expect(navigationForRole('receptionist').more).toHaveLength(0)
  })

  it('shows manager More links matching browser acceptance', () => {
    expect(navigationForRole('practice_manager').more.map(i => i.href)).toEqual([
      '/staff',
      '/integrations',
      '/audit',
    ])
  })
})

describe('S022 CSP and security headers', () => {
  it('serves restrictive CSP in staging/production builds', () => {
    const csp = buildContentSecurityPolicy('production')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('unsafe-eval')
  })

  it('includes all companion hardening headers checked in browser re-run', () => {
    const headers = buildSecurityHeaders('development')
    expect(headers['Content-Security-Policy']).toBeTruthy()
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Permissions-Policy']).toContain('microphone=()')
  })
})

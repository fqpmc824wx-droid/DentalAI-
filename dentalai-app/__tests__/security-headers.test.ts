import { describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from '@/lib/security/headers'

describe('security headers baseline', () => {
  it('builds a restrictive CSP without unsafe-eval in staging/production', () => {
    const csp = buildContentSecurityPolicy('staging')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('unsafe-eval')
  })

  it('allows unsafe-eval only in development for Next hot reload', () => {
    const csp = buildContentSecurityPolicy('development')
    expect(csp).toContain('unsafe-eval')
  })

  it('includes companion hardening headers', () => {
    const headers = buildSecurityHeaders('production')
    expect(headers['Content-Security-Policy']).toBeTruthy()
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Permissions-Policy']).toContain('camera=()')
  })
})

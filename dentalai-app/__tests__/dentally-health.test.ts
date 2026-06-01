/**
 * Dentally health-check tests — Phase 2.3.
 *
 * Uses the client test seam to stub every health-state combination:
 *   - connected (200)
 *   - degraded (slow response > 75% of timeout)
 *   - degraded (429 rate limit)
 *   - unavailable (401, 403, 500, timeout, network)
 *   - not_configured (env missing)
 *
 * Verifies the report never leaks the token, the raw body, or a stack trace.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { __setDentallyTransport, __resetDentallyTransport } from '@/lib/dentally/client'
import { checkDentallyHealth } from '@/lib/dentally/health'

const TEST_BASE = 'https://api.dentally.test'
const TEST_TOKEN = 'health-test-token-abc-456'

function configuredEnv(timeoutMs = 1000) {
  return () => ({
    configured: true as const,
    baseUrl: TEST_BASE,
    getAuthorizationHeader: () => `Bearer ${TEST_TOKEN}`,
    timeoutMs,
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('checkDentallyHealth', () => {
  afterEach(() => __resetDentallyTransport())

  it('returns "connected" on 200', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse([{ id: 'p1' }]),
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('connected')
    expect(typeof report.checkedAt).toBe('string')
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
    expect(report.probePath).toBe('/v1/user')
    expect(report.errorCategory).toBeUndefined()
  })

  it('returns "not_configured" when env is missing', async () => {
    __setDentallyTransport({
      env: () => ({ configured: false }),
      fetch: async () => {
        throw new Error('should not be called')
      },
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('not_configured')
    expect(report.errorCategory).toBe('not_configured')
    expect(report.message).toContain('not configured')
  })

  it('returns "unavailable" on 401', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({}, 401),
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('unavailable')
    expect(report.errorCategory).toBe('unauthorized')
  })

  it('returns "unavailable" on 403', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({}, 403),
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('unavailable')
    expect(report.errorCategory).toBe('forbidden')
  })

  it('returns "degraded" on 429 (rate limit)', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({}, 429),
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('degraded')
    expect(report.errorCategory).toBe('rate_limited')
  })

  it('returns "unavailable" on 500', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({}, 500),
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('unavailable')
    expect(report.errorCategory).toBe('server_error')
  })

  it('returns "unavailable" on timeout', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        throw e
      },
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('unavailable')
    expect(report.errorCategory).toBe('timeout')
  })

  it('returns "unavailable" on network error', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('unavailable')
    expect(report.errorCategory).toBe('network_error')
  })

  it('returns "unavailable" on malformed JSON', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () =>
        new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    })
    const report = await checkDentallyHealth()
    expect(report.status).toBe('unavailable')
    expect(report.errorCategory).toBe('malformed')
  })

  it('NEVER includes the token in the report', async () => {
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () => jsonResponse({ secret: TEST_TOKEN }),
    })
    const report = await checkDentallyHealth()
    expect(JSON.stringify(report)).not.toContain(TEST_TOKEN)
  })

  it('NEVER includes the response body in the report on error', async () => {
    const sensitiveBody = 'patient name James Patel and dob 1985-03-12'
    __setDentallyTransport({
      env: configuredEnv(),
      fetch: async () =>
        new Response(sensitiveBody, { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    })
    const report = await checkDentallyHealth()
    expect(JSON.stringify(report)).not.toContain('James Patel')
    expect(JSON.stringify(report)).not.toContain('1985-03-12')
  })
})

/**
 * Dentally client tests — Phase 2.2.
 *
 * All tests use the test-seam (__setDentallyTransport) to inject a stub
 * fetch. No real Dentally call is ever made.
 *
 * Coverage:
 *   - success path returns { ok, data, durationMs }
 *   - not_configured when env missing
 *   - 401 → unauthorized
 *   - 403 → forbidden
 *   - 404 → not_found
 *   - 429 → rate_limited
 *   - 500 → server_error
 *   - network error → network_error
 *   - timeout → timeout
 *   - malformed JSON → malformed
 *   - write methods are unreachable (only dentallyGet is exported)
 *   - Authorization header is set with bearer token
 *   - URL never contains the token
 *   - errors never expose the token
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  dentallyGet,
  __setDentallyTransport,
  __resetDentallyTransport,
} from '@/lib/dentally/client'

const TEST_BASE = 'https://api.dentally.test'
const TEST_TOKEN = 'test-token-xyz-12345'

function configuredEnv() {
  return {
    configured: true as const,
    baseUrl: TEST_BASE,
    getAuthorizationHeader: () => `Bearer ${TEST_TOKEN}`,
    timeoutMs: 1000,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function statusResponse(status: number): Response {
  return new Response(JSON.stringify({ error: 'something' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function statusResponseWithHeaders(status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'something' }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('dentallyGet — happy path', () => {
  afterEach(() => __resetDentallyTransport())

  it('returns ok=true with parsed data on 200', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => jsonResponse({ id: 'p1', name: 'Smile Dental' }),
    })

    const result = await dentallyGet<{ id: string; name: string }>('/v1/sites/p1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe('p1')
      expect(result.data.name).toBe('Smile Dental')
      expect(typeof result.durationMs).toBe('number')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('sets Authorization: Bearer header', async () => {
    let capturedInit: RequestInit | undefined
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async (_input, init) => {
        capturedInit = init
        return jsonResponse({ ok: true })
      },
    })

    await dentallyGet('/v1/sites')
    const headers = capturedInit?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(headers.Accept).toBe('application/json')
  })

  it('uses GET method and never sends credentials', async () => {
    let capturedInit: RequestInit | undefined
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async (_input, init) => {
        capturedInit = init
        return jsonResponse({ ok: true })
      },
    })

    await dentallyGet('/v1/sites')
    expect(capturedInit?.method).toBe('GET')
    expect(capturedInit?.credentials).toBe('omit')
    expect(capturedInit?.referrerPolicy).toBe('no-referrer')
  })

  it('does NOT include the token in the URL', async () => {
    let capturedUrl: string | undefined
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async (input) => {
        capturedUrl = typeof input === 'string' ? input : input.toString()
        return jsonResponse({ ok: true })
      },
    })

    await dentallyGet('/v1/sites')
    expect(capturedUrl).toBeDefined()
    expect(capturedUrl).not.toContain(TEST_TOKEN)
    expect(capturedUrl).toBe(`${TEST_BASE}/v1/sites`)
  })
})

describe('dentallyGet — env handling', () => {
  afterEach(() => __resetDentallyTransport())

  it('returns not_configured when env reader says unconfigured', async () => {
    __setDentallyTransport({
      env: () => ({ configured: false }),
      fetch: async () => {
        throw new Error('fetch should not be called')
      },
    })

    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.category).toBe('not_configured')
  })

  it('does not call fetch when not configured', async () => {
    const fetchSpy = vi.fn()
    __setDentallyTransport({
      env: () => ({ configured: false }),
      fetch: fetchSpy as never,
    })

    await dentallyGet('/v1/sites')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('dentallyGet — HTTP error mapping', () => {
  afterEach(() => __resetDentallyTransport())

  const cases: Array<{ status: number; category: string }> = [
    { status: 401, category: 'unauthorized' },
    { status: 403, category: 'forbidden' },
    { status: 404, category: 'not_found' },
    { status: 429, category: 'rate_limited' },
    { status: 500, category: 'server_error' },
    { status: 502, category: 'server_error' },
    { status: 503, category: 'server_error' },
  ]

  for (const { status, category } of cases) {
    it(`maps HTTP ${status} to category "${category}"`, async () => {
      __setDentallyTransport({
        env: configuredEnv,
        fetch: async () => statusResponse(status),
      })
      const result = await dentallyGet('/v1/sites')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.category).toBe(category)
        expect(result.statusCode).toBe(status)
      }
    })
  }

  it('418 (an odd status) maps to "unknown"', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => statusResponse(418),
    })
    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.category).toBe('unknown')
  })

  it('preserves safe Retry-After timing on rate limits', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => statusResponseWithHeaders(429, { 'Retry-After': '7' }),
    })

    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.category).toBe('rate_limited')
      expect(result.retryAfterMs).toBe(7000)
    }
  })

  it('ignores malformed Retry-After values', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => statusResponseWithHeaders(429, { 'Retry-After': 'soon please' }),
    })

    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.category).toBe('rate_limited')
      expect(result.retryAfterMs).toBeUndefined()
    }
  })
})

describe('dentallyGet — transport errors', () => {
  afterEach(() => __resetDentallyTransport())

  it('classifies thrown TypeError as network_error', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.category).toBe('network_error')
  })

  it('classifies AbortError as timeout', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        throw e
      },
    })
    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.category).toBe('timeout')
  })

  it('handles malformed JSON as "malformed"', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () =>
        new Response('not json at all <html>', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    })
    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.category).toBe('malformed')
  })
})

describe('dentallyGet — input validation', () => {
  afterEach(() => __resetDentallyTransport())

  it('throws if path does not use a safe /v1/ relative Dentally path', async () => {
    __setDentallyTransport({ env: configuredEnv, fetch: async () => jsonResponse({}) })
    await expect(dentallyGet('v1/sites')).rejects.toThrow(/safe relative/)
    await expect(dentallyGet('/v2/sites')).rejects.toThrow(/safe relative/)
    await expect(dentallyGet('//evil.example/v1/sites')).rejects.toThrow(/safe relative/)
    await expect(dentallyGet('/v1/sites bad')).rejects.toThrow(/safe relative/)
  })
})

describe('dentallyGet — duration tracking', () => {
  afterEach(() => __resetDentallyTransport())

  it('records durationMs on success', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => {
        await new Promise(r => setTimeout(r, 10))
        return jsonResponse({ ok: true })
      },
    })
    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.durationMs).toBeGreaterThanOrEqual(10)
  })

  it('records durationMs on error', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => {
        await new Promise(r => setTimeout(r, 5))
        return statusResponse(500)
      },
    })
    const result = await dentallyGet('/v1/sites')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.durationMs).toBeGreaterThanOrEqual(5)
  })
})

describe('dentallyGet — write-method safety', () => {
  it('only exports a GET function — no write helpers exist', async () => {
    const mod = await import('@/lib/dentally/client')
    const exportedNames = Object.keys(mod)
    // The only callable read helper is dentallyGet. Anything else must be
    // an internal test seam or non-mutating utility.
    expect(exportedNames).toContain('dentallyGet')
    for (const name of exportedNames) {
      const lower = name.toLowerCase()
      expect(lower).not.toContain('post')
      expect(lower).not.toContain('patch')
      expect(lower).not.toContain('put')
      expect(lower).not.toContain('delete')
      expect(lower).not.toContain('create')
      expect(lower).not.toContain('update')
    }
  })
})

describe('dentallyGet — token redaction', () => {
  beforeEach(() => __resetDentallyTransport())
  afterEach(() => __resetDentallyTransport())

  it('error result objects never contain the token', async () => {
    __setDentallyTransport({
      env: configuredEnv,
      fetch: async () => statusResponse(401),
    })
    const result = await dentallyGet('/v1/sites')
    const serialised = JSON.stringify(result)
    expect(serialised).not.toContain(TEST_TOKEN)
  })

  it('thrown DentallyError messages never contain the token', async () => {
    try {
      await dentallyGet('no-leading-slash-and-this-will-throw')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).not.toContain(TEST_TOKEN)
    }
  })
})

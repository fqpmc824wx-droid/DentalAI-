import 'server-only'

/**
 * Dentally read-only HTTP client — SERVER ONLY.
 *
 * Locked product rule: Phase 2 is read-only proof. This client MUST NOT
 * allow writes. Two independent defences enforce that:
 *
 *   1.  The only exported function is `dentallyGet()`. There is no
 *       `dentallyPost/Patch/Put/Delete`. So writes are unreachable from the
 *       outside.
 *
 *   2.  The internal request helper asserts the method is GET. If a future
 *       refactor adds a write method by mistake, the assertion will throw
 *       a `forbidden_method` error before fetch is called.
 *
 * Token handling:
 *   - The token is read from process.env via `readDentallyEnv()` at the
 *     start of each call and kept inside that module's closure.
 *   - This client never receives a raw token string. It asks for an
 *     `Authorization: Bearer` header at the final transport boundary.
 *   - The token is never put in a URL, query string, audit summary, or thrown
 *     error.
 *   - Errors thrown from this module carry only a category + status code +
 *     duration. They never include the response body or the request URL.
 *
 * Test injection:
 *   - The internal `_fetchImpl` and `_envReader` can be swapped via
 *     `__setDentallyTransport()` for unit tests. The real `fetch` and real
 *     `readDentallyEnv` are used in production by default.
 */

import { readDentallyEnv, type DentallyEnv } from './env'
import {
  DentallyError,
  categoriseHttpStatus,
  type DentallyErrorCategory,
} from './errors'
import type { DentallyReadOptions, DentallyReadResult } from './types'

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type EnvReader = () => DentallyEnv

let _fetchImpl: FetchImpl = (input, init) => fetch(input, init)
let _envReader: EnvReader = readDentallyEnv

/**
 * Test seam — replaces the fetch implementation and env reader for unit tests.
 * NOT exported from index.ts. Tests import this directly from './client'.
 *
 * @param overrides.fetch  Custom fetch (e.g. vi.fn() returning a Response).
 * @param overrides.env    Custom env reader (e.g. () => ({ configured: false })).
 */
export function __setDentallyTransport(overrides: {
  fetch?: FetchImpl
  env?: EnvReader
}) {
  if (overrides.fetch !== undefined) _fetchImpl = overrides.fetch
  if (overrides.env !== undefined) _envReader = overrides.env
}

/** Test seam — restores the real fetch + env reader. */
export function __resetDentallyTransport() {
  _fetchImpl = (input, init) => fetch(input, init)
  _envReader = readDentallyEnv
}

/**
 * Public read API. Performs a GET against the configured Dentally base URL.
 *
 * @param path        Path beginning with "/", e.g. "/v1/sites/abc-123".
 * @param options     Optional per-call overrides.
 * @returns           Discriminated union — `{ ok: true, data }` or
 *                    `{ ok: false, category, statusCode? }`.
 *
 * Never throws for HTTP errors — they are returned in the discriminated
 * result. Throws only for programmer errors (e.g. invalid path).
 */
export async function dentallyGet<T = unknown>(
  path: string,
  options: DentallyReadOptions = {},
): Promise<DentallyReadResult<T>> {
  if (!isSafeDentallyPath(path)) {
    throw new DentallyError(
      'unknown',
      'Dentally client: path must be a safe relative /v1/... path',
    )
  }
  return request<T>('GET', path, options)
}

/**
 * Internal request worker. Method is parameterised but ASSERTED to be GET.
 * Any future caller adding a write method will trip this assertion before
 * the network call happens.
 */
async function request<T>(
  method: string,
  path: string,
  options: DentallyReadOptions,
): Promise<DentallyReadResult<T>> {
  // ── Hard method guard (defence-in-depth) ──────────────────────────────
  if (method !== 'GET') {
    return {
      ok: false,
      category: 'forbidden_method',
      durationMs: 0,
    }
  }

  const env = _envReader()
  if (!env.configured) {
    return { ok: false, category: 'not_configured', durationMs: 0 }
  }

  const url = `${env.baseUrl}${path}`
  const effectiveTimeout = options.timeoutMs ?? env.timeoutMs

  // Compose AbortSignal: caller's signal + our internal timeout.
  const internalController = new AbortController()
  const timeoutHandle = setTimeout(() => internalController.abort('timeout'), effectiveTimeout)

  // Chain external signal if provided. AbortSignal.any() is widely supported
  // in Node 20+ / modern fetch, but fall back gracefully.
  let signal: AbortSignal = internalController.signal
  if (options.signal) {
    try {
      // AbortSignal.any wasn't in older Node — check at runtime.
      const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any
      if (typeof anyFn === 'function') {
        signal = anyFn([internalController.signal, options.signal])
      } else {
        // Fallback: propagate caller abort to our controller.
        const onCallerAbort = () => internalController.abort('caller-aborted')
        if (options.signal.aborted) onCallerAbort()
        else options.signal.addEventListener('abort', onCallerAbort, { once: true })
      }
    } catch {
      // If signal composition fails, fall back to internal-only.
    }
  }

  const startedAt = Date.now()
  let response: Response
  try {
    response = await _fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: env.getAuthorizationHeader(),
        Accept: 'application/json',
        'User-Agent': 'DentalAI/phase-2-read',
      },
      signal,
      // Do not send credentials, cookies, or referrer.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
  } catch (err) {
    clearTimeout(timeoutHandle)
    const durationMs = Date.now() - startedAt
    const category = classifyFetchError(err)
    return { ok: false, category, durationMs }
  }
  clearTimeout(timeoutHandle)
  const durationMs = Date.now() - startedAt

  if (!response.ok) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'))
    return {
      ok: false,
      category: categoriseHttpStatus(response.status),
      statusCode: response.status,
      durationMs,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    }
  }

  // Parse JSON safely.
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    return { ok: false, category: 'malformed', statusCode: response.status, durationMs }
  }

  return { ok: true, data: parsed as T, durationMs }
}

/** Classify thrown fetch errors into our category enum. */
function classifyFetchError(err: unknown): DentallyErrorCategory {
  if (err instanceof Error) {
    // Standard AbortError or our internal abort reason
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return 'timeout'
    // Node's DOMException for abort
    const maybeReason = (err as { cause?: { message?: string } }).cause
    if (typeof maybeReason?.message === 'string' && maybeReason.message.toLowerCase().includes('timeout')) {
      return 'timeout'
    }
  }
  // Anything else thrown by fetch is a transport-level failure.
  return 'network_error'
}

/**
 * Only allow internal Dentally REST paths. This prevents future callers from
 * sneaking absolute URLs, protocol-relative URLs, control characters, or
 * unversioned paths through the shared client.
 */
function isSafeDentallyPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  if (!path.startsWith('/v1/')) return false
  if (path.startsWith('//')) return false
  if (/[\u0000-\u001F\u007F\s]/.test(path)) return false
  try {
    // URL parsing is used only as validation. The fetch call still receives
    // the base URL + path string built in request().
    new URL(path, 'https://api.dentally.local')
    return true
  } catch {
    return false
  }
}

/** Parse Retry-After as seconds or HTTP date. Invalid values are ignored. */
function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const seconds = Number.parseInt(trimmed, 10)
  if (Number.isFinite(seconds) && String(seconds) === trimmed && seconds >= 0) {
    return seconds * 1000
  }

  const timestamp = Date.parse(trimmed)
  if (!Number.isFinite(timestamp)) return undefined
  return Math.max(0, timestamp - Date.now())
}

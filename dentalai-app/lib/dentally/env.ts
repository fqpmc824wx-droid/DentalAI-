import 'server-only'

/**
 * Dentally environment reader — SERVER ONLY.
 *
 * The `import 'server-only'` directive at the top causes Next.js 16 to throw
 * a build-time error if this module is ever imported (transitively) from a
 * Client Component. That makes leaking the token through the browser bundle
 * structurally impossible.
 *
 * The reader returns either:
 *   - { configured: true, baseUrl, getAuthorizationHeader, timeoutMs }
 *   - { configured: false }
 *
 * The raw token is never returned as an enumerable object field. It stays
 * inside a closure and can only be converted into an Authorization header at
 * the final transport boundary. That means a stray `console.log(env)` or
 * `JSON.stringify(env)` cannot print the token.
 *
 * The closure is NOT cached or re-exported. Each call re-reads process.env so
 * a rotation can take effect on the next request.
 */

const DEFAULT_TIMEOUT_MS = 8000
const MIN_TIMEOUT_MS = 500
const MAX_TIMEOUT_MS = 60_000

export type DentallyEnv =
  | {
      configured: true
      /** Base URL with no trailing slash. */
      baseUrl: string
      /** Produces the Dentally Authorization header at the transport edge. */
      getAuthorizationHeader: () => string
      /** Request timeout in milliseconds. */
      timeoutMs: number
    }
  | { configured: false }

export function readDentallyEnv(): DentallyEnv {
  const rawBaseUrl = process.env.DENTALLY_API_BASE_URL?.trim()
  const rawToken = process.env.DENTALLY_API_TOKEN?.trim()

  if (!rawBaseUrl || !rawToken) {
    return { configured: false }
  }

  // Strip trailing slash so callers can confidently do `${baseUrl}/path`.
  const baseUrl = rawBaseUrl.replace(/\/+$/, '')

  // Validate base URL shape — reject anything that isn't http(s).
  try {
    const u = new URL(baseUrl)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      // Refuse to use a non-http(s) base. Treat as not configured to fail safe.
      return { configured: false }
    }
  } catch {
    return { configured: false }
  }

  const rawTimeout = process.env.DENTALLY_TIMEOUT_MS?.trim()
  let timeoutMs = DEFAULT_TIMEOUT_MS
  if (rawTimeout) {
    const parsed = Number.parseInt(rawTimeout, 10)
    if (Number.isFinite(parsed) && parsed >= MIN_TIMEOUT_MS && parsed <= MAX_TIMEOUT_MS) {
      timeoutMs = parsed
    }
  }

  return {
    configured: true,
    baseUrl,
    getAuthorizationHeader: () => `Bearer ${rawToken}`,
    timeoutMs,
  }
}

/**
 * Convenience predicate that does NOT return the token. Safe to use for
 * gating UI features without pulling the secret value into scope.
 */
export function isDentallyConfigured(): boolean {
  return readDentallyEnv().configured
}

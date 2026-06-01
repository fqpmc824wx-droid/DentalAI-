/**
 * Dentally error classification — categorises every failure into a small,
 * UI-safe enum.  The raw error body is NEVER stored on the error object,
 * because Dentally responses can include patient names, identifiers, and
 * other PII that must not leak into logs, audit summaries, or UI strings.
 *
 * Categories:
 *   not_configured  — DENTALLY_API_TOKEN / DENTALLY_API_BASE_URL missing
 *   unauthorized    — 401 (token invalid or expired)
 *   forbidden       — 403 (scope or practice access denied)
 *   not_found       — 404 (resource missing)
 *   rate_limited    — 429
 *   server_error    — 5xx
 *   network_error   — fetch threw before status (DNS, TLS, refused, etc.)
 *   timeout         — request exceeded DENTALLY_TIMEOUT_MS
 *   malformed       — body was not parseable JSON when JSON was expected
 *   forbidden_method — internal: caller tried POST/PATCH/PUT/DELETE
 *   unknown         — anything else
 */

export type DentallyErrorCategory =
  | 'not_configured'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server_error'
  | 'network_error'
  | 'timeout'
  | 'malformed'
  | 'forbidden_method'
  | 'unknown'

/**
 * Internal-only error type for the Dentally client.
 * - Always carries a category.
 * - May carry an HTTP status code.
 * - Never carries the response body.
 * - Never carries the request URL with the token.
 */
export class DentallyError extends Error {
  public readonly category: DentallyErrorCategory
  public readonly statusCode?: number
  public readonly durationMs?: number

  constructor(
    category: DentallyErrorCategory,
    message: string,
    opts?: { statusCode?: number; durationMs?: number }
  ) {
    super(message)
    this.name = 'DentallyError'
    this.category = category
    this.statusCode = opts?.statusCode
    this.durationMs = opts?.durationMs
  }
}

/** HTTP status → category mapping (response was received). */
export function categoriseHttpStatus(status: number): DentallyErrorCategory {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limited'
  if (status >= 500 && status < 600) return 'server_error'
  return 'unknown'
}

/**
 * UI-safe message text per category. Never includes specifics like patient
 * names or resource IDs. Suitable for showing to staff in admin surfaces.
 */
export function safeMessageForCategory(category: DentallyErrorCategory): string {
  switch (category) {
    case 'not_configured':   return 'Dentally integration is not configured for this environment.'
    case 'unauthorized':     return 'Dentally token is invalid or expired.'
    case 'forbidden':        return 'Dentally token lacks the required scope or practice access.'
    case 'not_found':        return 'Dentally resource was not found.'
    case 'rate_limited':     return 'Dentally rate limit reached. Try again shortly.'
    case 'server_error':     return 'Dentally is reporting an internal error.'
    case 'network_error':    return 'Could not reach Dentally over the network.'
    case 'timeout':          return 'Dentally did not respond in time.'
    case 'malformed':        return 'Dentally returned an unexpected response shape.'
    case 'forbidden_method': return 'This client only allows read requests to Dentally.'
    case 'unknown':          return 'An unknown error occurred talking to Dentally.'
  }
}

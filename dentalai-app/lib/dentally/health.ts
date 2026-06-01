import 'server-only'

/**
 * Dentally health check — Phase 2.3.
 *
 * Hits a harmless, low-impact read endpoint to confirm:
 *   - token is valid (not 401)
 *   - token has at least one required scope (not 403)
 *   - the API host is reachable
 *
 * Returns a safe status object — no token, no raw response body, no patient
 * data. Suitable for rendering directly in a protected admin UI.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ENDPOINT UNCERTAINTY (read this before pointing at the real API):
 *
 * Dentally's public REST API uses `https://api.dentally.co` as the base.
 * The health probe is `/v1/user`: it is a low-impact, token-scoped read that
 * proves the bearer token works without pulling clinic, patient, diary, or
 * financial data into the health report.
 *
 * If the live API rejects this path, change HEALTH_PROBE_PATH only. No
 * other code should hold a Dentally URL.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import { safeMessageForCategory } from './errors'

const HEALTH_PROBE_PATH = DENTALLY_ENDPOINTS.currentUser

export type DentallyHealthStatus =
  | 'connected'
  | 'degraded'
  | 'unavailable'
  | 'not_configured'

export type DentallyHealthReport = {
  status: DentallyHealthStatus
  checkedAt: string
  durationMs: number
  /** UI-safe message. Never contains the token or raw response body. */
  message: string
  /** Internal category for logs/UI hinting. */
  errorCategory?: DentallyErrorCategory
  /** Probe path used. Useful for admin debugging without leaking secrets. */
  probePath: string
}

/**
 * Map a client read result to a high-level health status.
 *
 *   connected     — request succeeded
 *   degraded      — succeeded slowly OR partial failure (rate-limited)
 *   unavailable   — auth, network, server, timeout failures
 *   not_configured — env not set
 */
function classifyHealth(
  category: DentallyErrorCategory | undefined,
  durationMs: number,
  configuredTimeoutMs: number,
): DentallyHealthStatus {
  if (category === 'not_configured') return 'not_configured'
  if (category === undefined) {
    // ok path — call duration > 75% of timeout counts as degraded
    if (durationMs > configuredTimeoutMs * 0.75) return 'degraded'
    return 'connected'
  }
  if (category === 'rate_limited') return 'degraded'
  return 'unavailable'
}

export async function checkDentallyHealth(): Promise<DentallyHealthReport> {
  // We read env via the client; if it's not configured the client returns
  // category: 'not_configured' without making a network call.
  const result = await dentallyGet<unknown>(HEALTH_PROBE_PATH)
  const checkedAt = new Date().toISOString()
  const durationMs = result.durationMs

  if (result.ok) {
    // Use a generous default for the "degraded" threshold when we don't
    // know the configured timeout (env not read here).
    const status = classifyHealth(undefined, durationMs, 8000)
    return {
      status,
      checkedAt,
      durationMs,
      message: status === 'degraded'
        ? 'Dentally responded but slowly. Investigate latency.'
        : 'Dentally connectivity OK.',
      probePath: HEALTH_PROBE_PATH,
    }
  }

  const status = classifyHealth(result.category, durationMs, 8000)
  return {
    status,
    checkedAt,
    durationMs,
    message: safeMessageForCategory(result.category),
    errorCategory: result.category,
    probePath: HEALTH_PROBE_PATH,
  }
}

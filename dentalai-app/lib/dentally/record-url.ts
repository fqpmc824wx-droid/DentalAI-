/**
 * S094 — Staff-facing Dentally patient record URLs (read-only deep links).
 * No API tokens; app base URL only.
 */

const DEFAULT_APP_BASE = 'https://app.dentally.co'

export function resolveDentallyAppBaseUrl(override?: string): string {
  const fromEnv = override ?? process.env.DENTALLY_APP_BASE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  return DEFAULT_APP_BASE
}

export function buildDentallyPatientRecordUrl(
  dentallyPatientId: string,
  baseUrl: string = resolveDentallyAppBaseUrl(),
): string {
  const base = baseUrl.replace(/\/+$/, '')
  const id = encodeURIComponent(dentallyPatientId)
  return `${base}/patients/${id}`
}

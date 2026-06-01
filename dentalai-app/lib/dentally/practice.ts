import 'server-only'

/**
 * Dentally current-practice read — Phase 2 read-only scaffold.
 *
 * Important distinction:
 *   - /v1/practice returns the current Dentally practice/account context.
 *   - /v1/sites returns the individual clinic/site locations under it.
 *
 * DentalAI clinic rollout maps to Dentally sites, not to a guessed
 * /v1/practices collection.
 */

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import type { DentallyPractice } from './types'

export type DentallyResourceReadResult<T> =
  | { ok: true; data: T; durationMs: number }
  | { ok: false; category: DentallyErrorCategory; statusCode?: number; durationMs: number }

function parsePractice(raw: unknown): DentallyPractice | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const name = typeof r.name === 'string' ? r.name
             : typeof r.trading_name === 'string' ? r.trading_name
             : typeof r.legal_name === 'string' ? r.legal_name
             : null
  if (!name) return null

  const id = typeof r.id === 'string' ? r.id
           : typeof r.id === 'number' ? String(r.id)
           : typeof r.uuid === 'string' ? r.uuid
           : 'current-practice'

  const legalName = typeof r.legal_name === 'string' ? r.legal_name
                  : typeof r.legalName === 'string' ? r.legalName
                  : undefined
  const timezone = typeof r.timezone === 'string' ? r.timezone
                 : typeof r.time_zone === 'string' ? r.time_zone
                 : undefined

  return { id, name, legalName, timezone }
}

export async function readDentallyPractice(): Promise<DentallyResourceReadResult<DentallyPractice>> {
  const result = await dentallyGet<unknown>(DENTALLY_ENDPOINTS.practice)
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const raw = result.data
  const candidate =
    raw && typeof raw === 'object' && 'practice' in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).practice
      : raw

  const practice = parsePractice(candidate)
  if (!practice) {
    return { ok: false, category: 'malformed', durationMs: result.durationMs }
  }

  return { ok: true, data: practice, durationMs: result.durationMs }
}

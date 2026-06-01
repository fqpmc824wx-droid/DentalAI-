import 'server-only'

/**
 * Dentally site reads — Phase 2 read-only scaffold.
 *
 * DentalAI clinic access maps to Dentally sites. The first pilot mapping is
 * GK Hawick, site ID 8e0f35a8-a7b1-4fe7-8c85-780505eeb2ce.
 */

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import type { DentallySite } from './types'

export type SiteReadResult<T> =
  | { ok: true; data: T; durationMs: number }
  | { ok: false; category: DentallyErrorCategory; statusCode?: number; durationMs: number }

function textField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function parseSite(raw: unknown): DentallySite | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = textField(r, 'id', 'uuid', 'site_id') ?? (typeof r.id === 'number' ? String(r.id) : undefined)
  const name = textField(r, 'name', 'practice_name', 'site_name', 'trading_name')
  if (!id || !name) return null

  const postcode = textField(r, 'postcode', 'post_code', 'postal_code')
  const address = textField(r, 'address', 'address_1', 'line_1')
  const active = typeof r.active === 'boolean' ? r.active
               : typeof r.is_active === 'boolean' ? r.is_active
               : undefined

  return { id, name, postcode, address, active }
}

export async function readDentallySites(): Promise<SiteReadResult<DentallySite[]>> {
  const result = await dentallyGet<unknown>(DENTALLY_ENDPOINTS.sites)
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const raw = result.data
  let arr: unknown[] = []
  if (Array.isArray(raw)) {
    arr = raw
  } else if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.sites)) arr = r.sites
    else if (Array.isArray(r.data)) arr = r.data
    else return { ok: false, category: 'malformed', durationMs: result.durationMs }
  } else {
    return { ok: false, category: 'malformed', durationMs: result.durationMs }
  }

  const parsed = arr.map(parseSite).filter((site): site is DentallySite => site !== null)
  return { ok: true, data: parsed, durationMs: result.durationMs }
}

export async function readDentallySite(siteId: string): Promise<SiteReadResult<DentallySite>> {
  if (!siteId || typeof siteId !== 'string') {
    return { ok: false, category: 'unknown', durationMs: 0 }
  }

  const result = await dentallyGet<unknown>(DENTALLY_ENDPOINTS.siteById(siteId))
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const raw = result.data
  const candidate =
    raw && typeof raw === 'object' && 'site' in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).site
      : raw

  const site = parseSite(candidate)
  if (!site) {
    return { ok: false, category: 'malformed', durationMs: result.durationMs }
  }

  return { ok: true, data: site, durationMs: result.durationMs }
}


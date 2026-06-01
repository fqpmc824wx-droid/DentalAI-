import 'server-only'

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import type { DentallyUser } from './types'

export type UserReadResult =
  | { ok: true; data: DentallyUser; durationMs: number }
  | { ok: false; category: DentallyErrorCategory; statusCode?: number; durationMs: number }

function parseUser(raw: unknown): DentallyUser | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const candidate =
    'user' in r && r.user && typeof r.user === 'object'
      ? r.user as Record<string, unknown>
      : r

  const id = typeof candidate.id === 'string' ? candidate.id
           : typeof candidate.id === 'number' ? String(candidate.id)
           : typeof candidate.uuid === 'string' ? candidate.uuid
           : null
  if (!id) return null

  const name = typeof candidate.name === 'string' ? candidate.name
             : typeof candidate.full_name === 'string' ? candidate.full_name
             : undefined
  const email = typeof candidate.email === 'string' ? candidate.email : undefined

  return { id, name, email }
}

export async function readDentallyUser(): Promise<UserReadResult> {
  const result = await dentallyGet<unknown>(DENTALLY_ENDPOINTS.currentUser)
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const user = parseUser(result.data)
  if (!user) {
    return { ok: false, category: 'malformed', durationMs: result.durationMs }
  }

  return { ok: true, data: user, durationMs: result.durationMs }
}


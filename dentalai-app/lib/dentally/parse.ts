/**
 * Small parsing helpers for Dentally read-only payloads.
 *
 * Keep the defensive shape handling here so the feature readers stay simple.
 * These helpers are intentionally pure and server/client neutral; they do
 * not import `server-only`, fetch, env, or Next.js.
 */

export type JsonRecord = Record<string, unknown>

export function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

export function unwrapOne(raw: unknown, wrapper: string): unknown {
  const record = asRecord(raw)
  if (record && wrapper in record) return record[wrapper]
  return raw
}

export function unwrapList(raw: unknown, wrapper: string): unknown[] | null {
  if (Array.isArray(raw)) return raw
  const record = asRecord(raw)
  if (!record) return null
  if (Array.isArray(record[wrapper])) return record[wrapper] as unknown[]
  if (Array.isArray(record.data)) return record.data as unknown[]
  return null
}

export function textField(record: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

export function numberField(record: JsonRecord, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

export function booleanField(record: JsonRecord, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalised = value.trim().toLowerCase()
      if (normalised === 'true') return true
      if (normalised === 'false') return false
    }
  }
  return undefined
}

export function appendQuery(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const serialised = query.toString()
  return serialised ? `${path}?${serialised}` : path
}


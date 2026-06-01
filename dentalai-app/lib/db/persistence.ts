/**
 * Durable persistence boundary — enterprise typed SQLite storage.
 *
 * Feature stores talk to typed repositories (queue, audit, login_attempts, users).
 * This module re-exports the client helpers used by tests and legacy callers.
 */

import {
  getDataDir,
  persistenceEnabled,
  getDb,
  runInTransaction,
  __dbPathForTests,
  __persistenceEnabledForTests,
  __closeForTests,
} from './client'

export {
  getDataDir,
  persistenceEnabled,
  getDb,
  runInTransaction,
  __dbPathForTests,
  __persistenceEnabledForTests,
  __closeForTests,
}

/** @deprecated Legacy JSON collection API — used only in migration tests. */
export function readCollection<T>(name: string): T[] | null {
  if (!persistenceEnabled()) return null
  try {
    const row = getDb()
      .prepare('SELECT data FROM collections WHERE name = ?')
      .get(name) as { data: string } | undefined
    if (!row) return null
    const parsed = JSON.parse(row.data)
    return Array.isArray(parsed) ? (parsed as T[]) : null
  } catch {
    return null
  }
}

/** @deprecated Legacy JSON collection API — used only in migration tests. */
export function writeCollection<T>(name: string, items: T[]): void {
  if (!persistenceEnabled()) return
  getDb()
    .prepare(
      `INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(name, JSON.stringify(items), new Date().toISOString())
}

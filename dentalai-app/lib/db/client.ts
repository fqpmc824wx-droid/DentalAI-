/**
 * Enterprise SQLite client — connection, transactions, and persistence gate.
 *
 * All durable storage flows through typed repositories; this module owns the
 * single database handle, WAL mode, and schema migrations.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type BetterSqlite3 from 'better-sqlite3'
import { runMigrations } from './migrate'

const require = createRequire(import.meta.url)

export type DB = BetterSqlite3.Database

const g = globalThis as typeof globalThis & {
  __dentalaiDb?: { path: string; db: DB }
}

/** Where the database file lives. Explicit env wins; otherwise <project>/.data. */
export function getDataDir(): string {
  const fromEnv = process.env.DENTALAI_DATA_DIR
  if (fromEnv && fromEnv.trim().length > 0) return path.resolve(fromEnv)
  return path.join(process.cwd(), '.data')
}

/**
 * Whether reads/writes touch the database.
 * - Explicit DENTALAI_DATA_DIR → always on (persistence tests + pinned deploys).
 * - Otherwise, during tests → off (suite stays in-memory + isolated).
 * - Otherwise (dev / production runtime) → on.
 */
export function persistenceEnabled(): boolean {
  if (process.env.DENTALAI_DATA_DIR && process.env.DENTALAI_DATA_DIR.trim().length > 0) return true
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false
  return true
}

export function dbPath(): string {
  return path.join(getDataDir(), 'dentalai.db')
}

/** Open (or reuse) the SQLite connection and ensure migrations have run. */
export function getDb(): DB {
  if (!persistenceEnabled()) {
    throw new Error('getDb() called while persistence is disabled')
  }

  const wantPath = dbPath()
  if (g.__dentalaiDb && g.__dentalaiDb.path === wantPath) return g.__dentalaiDb.db

  if (g.__dentalaiDb) {
    try { g.__dentalaiDb.db.close() } catch { /* ignore */ }
    g.__dentalaiDb = undefined
  }

  const dir = getDataDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const Database = require(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'better-sqlite3') as typeof BetterSqlite3
  const db = new Database(wantPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  g.__dentalaiDb = { path: wantPath, db }
  return db
}

/** Run fn inside a SQLite transaction when persistence is on; otherwise run inline. */
export function runInTransaction<T>(fn: () => T): T {
  if (!persistenceEnabled()) return fn()
  return getDb().transaction(fn)()
}

/** Test-only: the database file path that would be used right now. */
export function __dbPathForTests(): string {
  return dbPath()
}

/** Test-only: is persistence currently active. */
export function __persistenceEnabledForTests(): boolean {
  return persistenceEnabled()
}

/** Test-only: close the open connection so a temp data dir can be removed. */
export function __closeForTests(): void {
  if (g.__dentalaiDb) {
    try { g.__dentalaiDb.db.close() } catch { /* ignore */ }
    g.__dentalaiDb = undefined
  }
}

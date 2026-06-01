/**
 * SQLite backup and restore helpers for `.data/dentalai.db`.
 *
 * Uses SQLite online backup via better-sqlite3 `.backup()` — safe with WAL mode.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type BetterSqlite3 from 'better-sqlite3'
import { getDataDir, dbPath } from '@/lib/db/client'

const require = createRequire(import.meta.url)

export type BackupManifest = {
  version: 1
  createdAt: string
  appEnv: string
  sourceDb: string
  backupFile: string
  byteSize: number
  walMode: boolean
}

export function resolveDbFile(dataDir?: string): string {
  if (dataDir) return path.join(path.resolve(dataDir), 'dentalai.db')
  return dbPath()
}

export function defaultBackupDir(dataDir?: string): string {
  const base = dataDir ? path.resolve(dataDir) : getDataDir()
  return path.join(base, 'backups')
}

export function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

/** Create a consistent backup filename. */
export function backupFilename(at = new Date()): string {
  return `dentalai-${timestampSlug(at)}.db`
}

export async function createSqliteBackup(options?: {
  dataDir?: string
  destinationDir?: string
  destinationFile?: string
}): Promise<BackupManifest> {
  const sourceDb = resolveDbFile(options?.dataDir)
  if (!fs.existsSync(sourceDb)) {
    throw new Error(`Database not found: ${sourceDb}`)
  }

  const destDir = options?.destinationDir ?? defaultBackupDir(options?.dataDir)
  fs.mkdirSync(destDir, { recursive: true })

  const backupFile = options?.destinationFile
    ? path.resolve(options.destinationFile)
    : path.join(destDir, backupFilename())

  const Database = require(/* webpackIgnore: true */ 'better-sqlite3') as typeof BetterSqlite3
  const db = new Database(sourceDb, { readonly: true })
  try {
    await db.backup(backupFile)
  } finally {
    db.close()
  }

  const stat = fs.statSync(backupFile)

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    appEnv: process.env.DENTALAI_APP_ENV ?? process.env.NODE_ENV ?? 'development',
    sourceDb,
    backupFile,
    byteSize: stat.size,
    walMode: true,
  }
}

export function restoreSqliteBackup(options: {
  backupFile: string
  dataDir?: string
  /** When true, copy current DB to `.pre-restore-*` before overwrite. */
  keepPrevious?: boolean
}): { restoredTo: string; previousBackup?: string } {
  const backupFile = path.resolve(options.backupFile)
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup not found: ${backupFile}`)
  }

  const targetDir = options.dataDir ? path.resolve(options.dataDir) : getDataDir()
  fs.mkdirSync(targetDir, { recursive: true })

  const targetDb = path.join(targetDir, 'dentalai.db')
  let previousBackup: string | undefined

  if (options.keepPrevious !== false && fs.existsSync(targetDb)) {
    previousBackup = path.join(targetDir, `.pre-restore-${timestampSlug()}.db`)
    fs.copyFileSync(targetDb, previousBackup)
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = targetDb + suffix
      if (fs.existsSync(sidecar)) {
        fs.copyFileSync(sidecar, previousBackup + suffix)
      }
    }
  }

  fs.copyFileSync(backupFile, targetDb)
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = backupFile + suffix
    if (fs.existsSync(sidecar)) {
      fs.copyFileSync(sidecar, targetDb + suffix)
    } else {
      const targetSidecar = targetDb + suffix
      if (fs.existsSync(targetSidecar)) fs.unlinkSync(targetSidecar)
    }
  }

  return { restoredTo: targetDb, previousBackup }
}

export function writeManifest(manifest: BackupManifest, dir?: string): string {
  const manifestDir = dir ?? path.dirname(manifest.backupFile)
  fs.mkdirSync(manifestDir, { recursive: true })
  const manifestPath = manifest.backupFile.replace(/\.db$/, '.manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  return manifestPath
}

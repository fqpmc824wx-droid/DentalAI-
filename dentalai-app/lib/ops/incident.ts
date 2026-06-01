/**
 * Incident-response evidence pack — operational artifact for DR drills.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getHealthReport } from '@/lib/monitoring/health'
import { readRuntimeConfig } from '@/lib/env/runtime'
import { defaultBackupDir, resolveDbFile } from '@/lib/ops/backup'

export type IncidentEvidencePack = {
  version: 1
  generatedAt: string
  purpose: 'incident_response_baseline'
  runtime: ReturnType<typeof readRuntimeConfig>
  health: ReturnType<typeof getHealthReport>
  database: {
    path: string
    exists: boolean
    byteSize: number | null
    backupDir: string
    latestBackup: string | null
  }
  checklist: string[]
}

function latestBackupFile(backupDir: string): string | null {
  if (!fs.existsSync(backupDir)) return null
  const files = fs
    .readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return files[0] ? path.join(backupDir, files[0].name) : null
}

export function buildIncidentEvidencePack(): IncidentEvidencePack {
  const runtime = readRuntimeConfig()
  const health = getHealthReport()
  const dbFile = resolveDbFile()
  const backupDir = defaultBackupDir()
  const exists = fs.existsSync(dbFile)
  const byteSize = exists ? fs.statSync(dbFile).size : null

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'incident_response_baseline',
    runtime,
    health,
    database: {
      path: dbFile,
      exists,
      byteSize,
      backupDir,
      latestBackup: latestBackupFile(backupDir),
    },
    checklist: [
      'Confirm /api/health status and persistence.reachable',
      'Capture latest backup manifest from .data/backups/',
      'Record incident window in append-only audit export',
      'Verify AUTH_SECRET and Dentally token rotation if compromise suspected',
      'Run db:restore drill on isolated copy before production restore',
    ],
  }
}

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import {
  backupFilename,
  createSqliteBackup,
  restoreSqliteBackup,
  writeManifest,
} from '@/lib/ops/backup'
import { buildIncidentEvidencePack } from '@/lib/ops/incident'

const OLD_ENV = { ...process.env }
const tempDirs: string[] = []

afterEach(() => {
  process.env = { ...OLD_ENV }
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function makeTempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentalai-backup-'))
  tempDirs.push(dir)
  process.env.DENTALAI_DATA_DIR = dir
  return dir
}

describe('backup and restore', () => {
  it('creates a backup manifest with byte size', async () => {
    const dataDir = makeTempDataDir()
    const dbFile = path.join(dataDir, 'dentalai.db')

    const db = new Database(dbFile)
    db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY, note TEXT)')
    db.prepare('INSERT INTO probe (note) VALUES (?)').run('baseline')
    db.close()

    const manifest = await createSqliteBackup({ dataDir })
    expect(manifest.byteSize).toBeGreaterThan(0)
    expect(fs.existsSync(manifest.backupFile)).toBe(true)

    const manifestPath = writeManifest(manifest)
    expect(fs.existsSync(manifestPath)).toBe(true)
  })

  it('restores backup over existing database', async () => {
    const dataDir = makeTempDataDir()
    const dbFile = path.join(dataDir, 'dentalai.db')

    const db = new Database(dbFile)
    db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY, note TEXT)')
    db.prepare('INSERT INTO probe (note) VALUES (?)').run('before-backup')
    db.close()

    const manifest = await createSqliteBackup({ dataDir })

    const live = new Database(dbFile)
    live.exec('DELETE FROM probe')
    live.prepare('INSERT INTO probe (note) VALUES (?)').run('mutated')
    live.close()

    restoreSqliteBackup({ backupFile: manifest.backupFile, dataDir })

    const restored = new Database(dbFile, { readonly: true })
    const row = restored.prepare('SELECT note FROM probe LIMIT 1').get() as { note: string }
    restored.close()
    expect(row.note).toBe('before-backup')
  })

  it('uses deterministic backup filename helper', () => {
    const at = new Date('2026-06-01T12:00:00.000Z')
    expect(backupFilename(at)).toMatch(/^dentalai-2026-06-01T12-00-00-000Z\.db$/)
  })
})

describe('incident evidence pack', () => {
  it('builds a JSON-safe pack without secrets', () => {
    process.env.DENTALAI_APP_ENV = 'staging'
    process.env.AUTH_SECRET = 'hidden-auth-secret'
    const pack = buildIncidentEvidencePack()
    const json = JSON.stringify(pack)
    expect(pack.purpose).toBe('incident_response_baseline')
    expect(pack.checklist.length).toBeGreaterThan(0)
    expect(json).not.toContain('hidden-auth-secret')
  })
})

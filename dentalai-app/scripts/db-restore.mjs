#!/usr/bin/env node
/**
 * Restore SQLite backup over `.data/dentalai.db`.
 *
 * Usage: node scripts/db-restore.mjs --from BACKUP.db [--data-dir PATH] [--no-keep-previous]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

function getDataDir(explicit) {
  if (explicit?.trim()) return path.resolve(explicit)
  const fromEnv = process.env.DENTALAI_DATA_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(appRoot, '.data')
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-')
}

function parseArgs(argv) {
  const opts = { keepPrevious: true }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) opts.from = argv[++i]
    if (argv[i] === '--data-dir' && argv[i + 1]) opts.dataDir = argv[++i]
    if (argv[i] === '--no-keep-previous') opts.keepPrevious = false
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
if (!opts.from) {
  console.error(JSON.stringify({ ok: false, error: 'Missing required --from BACKUP.db' }))
  process.exit(1)
}

const backupFile = path.resolve(opts.from)
if (!fs.existsSync(backupFile)) {
  console.error(JSON.stringify({ ok: false, error: `Backup not found: ${backupFile}` }))
  process.exit(1)
}

const dataDir = getDataDir(opts.dataDir)
fs.mkdirSync(dataDir, { recursive: true })
const targetDb = path.join(dataDir, 'dentalai.db')

let previousBackup
if (opts.keepPrevious && fs.existsSync(targetDb)) {
  previousBackup = path.join(dataDir, `.pre-restore-${timestampSlug()}.db`)
  fs.copyFileSync(targetDb, previousBackup)
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = targetDb + suffix
    if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, previousBackup + suffix)
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

console.log(JSON.stringify({ ok: true, restoredTo: targetDb, previousBackup: previousBackup ?? null }, null, 2))

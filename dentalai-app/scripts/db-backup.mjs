#!/usr/bin/env node
/**
 * Backup `.data/dentalai.db` to `.data/backups/dentalai-<timestamp>.db`.
 *
 * Usage: node scripts/db-backup.mjs [--data-dir PATH] [--out FILE]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
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
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--data-dir' && argv[i + 1]) opts.dataDir = argv[++i]
    if (argv[i] === '--out' && argv[i + 1]) opts.out = argv[++i]
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
const dataDir = getDataDir(opts.dataDir)
const sourceDb = path.join(dataDir, 'dentalai.db')

if (!fs.existsSync(sourceDb)) {
  console.error(JSON.stringify({ ok: false, error: `Database not found: ${sourceDb}` }))
  process.exit(1)
}

const backupDir = path.join(dataDir, 'backups')
fs.mkdirSync(backupDir, { recursive: true })
const backupFile = opts.out
  ? path.resolve(opts.out)
  : path.join(backupDir, `dentalai-${timestampSlug()}.db`)

const Database = require('better-sqlite3')
const db = new Database(sourceDb, { readonly: true })

try {
  await db.backup(backupFile)
} finally {
  db.close()
}

const manifest = {
  version: 1,
  createdAt: new Date().toISOString(),
  appEnv: process.env.DENTALAI_APP_ENV ?? process.env.NODE_ENV ?? 'development',
  sourceDb,
  backupFile,
  byteSize: fs.statSync(backupFile).size,
  walMode: true,
}

const manifestPath = backupFile.replace(/\.db$/, '.manifest.json')
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ ok: true, manifest, manifestPath }, null, 2))

#!/usr/bin/env node
/**
 * Emit incident-response evidence JSON (no secrets).
 *
 * Usage: node scripts/incident-evidence.mjs [--out FILE]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

function getDataDir() {
  const fromEnv = process.env.DENTALAI_DATA_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(appRoot, '.data')
}

function readAppEnv() {
  const explicit = process.env.DENTALAI_APP_ENV?.trim().toLowerCase()
  if (explicit === 'development' || explicit === 'staging' || explicit === 'production' || explicit === 'test') {
    return explicit
  }
  if (process.env.NODE_ENV === 'test') return 'test'
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

function latestBackup(backupDir) {
  if (!fs.existsSync(backupDir)) return null
  return fs
    .readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({ file: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.file ?? null
}

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) opts.out = argv[++i]
  }
  return opts
}

const dataDir = getDataDir()
const dbPath = path.join(dataDir, 'dentalai.db')
const backupDir = path.join(dataDir, 'backups')
const exists = fs.existsSync(dbPath)

const pack = {
  version: 1,
  generatedAt: new Date().toISOString(),
  purpose: 'incident_response_baseline',
  runtime: {
    appEnv: readAppEnv(),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  database: {
    path: dbPath,
    exists,
    byteSize: exists ? fs.statSync(dbPath).size : null,
    backupDir,
    latestBackup: latestBackup(backupDir),
  },
  checklist: [
    'Confirm /api/health status and persistence.reachable',
    'Capture latest backup manifest from .data/backups/',
    'Record incident window in append-only audit export',
    'Verify AUTH_SECRET and Dentally token rotation if compromise suspected',
    'Run db:restore drill on isolated copy before production restore',
  ],
}

const opts = parseArgs(process.argv.slice(2))
const json = JSON.stringify(pack, null, 2) + '\n'
if (opts.out) {
  fs.writeFileSync(path.resolve(opts.out), json)
  console.log(JSON.stringify({ ok: true, written: path.resolve(opts.out) }, null, 2))
} else {
  console.log(json)
}

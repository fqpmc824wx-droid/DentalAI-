#!/usr/bin/env node
/**
 * Emit Dentally token rotation evidence template (no token values).
 *
 * S029 requires rotation outside chat. Run after rotating the pilot read-only
 * token in Dentally and updating secret storage:
 *
 *   DENTALLY_ROTATION_AT=2026-06-01T12:00:00Z \
 *   DENTALLY_ROTATION_BY="Practice Manager Name" \
 *   node scripts/dentally-rotation-evidence.mjs
 *
 * Usage: node scripts/dentally-rotation-evidence.mjs [--out FILE]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLocalEnv } from './load-local-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

loadLocalEnv(appRoot)

function getDataDir() {
  const fromEnv = process.env.DENTALAI_DATA_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(appRoot, '.data')
}

function parseArgs(argv) {
  const outIdx = argv.indexOf('--out')
  return {
    outFile: outIdx >= 0 ? argv[outIdx + 1] : null,
  }
}

function readAppEnv() {
  const explicit = process.env.DENTALAI_APP_ENV?.trim().toLowerCase()
  if (['development', 'staging', 'production', 'test'].includes(explicit ?? '')) {
    return explicit
  }
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

const { outFile } = parseArgs(process.argv.slice(2))
const rotationAt = process.env.DENTALLY_ROTATION_AT?.trim() || null
const rotationBy = process.env.DENTALLY_ROTATION_BY?.trim() || null

const evidence = {
  kind: 'dentally_token_rotation_evidence',
  generatedAt: new Date().toISOString(),
  appEnv: readAppEnv(),
  rotationRecorded: Boolean(rotationAt && rotationBy),
  rotationAt,
  rotationBy,
  tokenConfigured: Boolean(
    process.env.DENTALLY_API_BASE_URL?.trim() && process.env.DENTALLY_API_TOKEN?.trim(),
  ),
  notes: rotationAt && rotationBy
    ? 'Rotation metadata recorded without token value. Re-run integration health page (S030) after deploy.'
    : 'Set DENTALLY_ROTATION_AT and DENTALLY_ROTATION_BY after rotating the pilot token outside chat.',
  exclusions: [
    'Never paste or print DENTALLY_API_TOKEN',
    'Never include patient-identifiable payloads',
  ],
}

const defaultOut = path.join(getDataDir(), 'evidence', 'dentally-rotation-evidence.json')
const target = path.resolve(outFile ?? defaultOut)
const json = `${JSON.stringify(evidence, null, 2)}\n`
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, json, 'utf8')
console.log(
  JSON.stringify(
    {
      ok: evidence.rotationRecorded,
      written: target,
      rotationRecorded: evidence.rotationRecorded,
      tokenConfigured: evidence.tokenConfigured,
    },
    null,
    2,
  ),
)

process.exit(evidence.rotationRecorded ? 0 : 2)

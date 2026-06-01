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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

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
  tokenConfigured: Boolean(process.env.DENTALLY_API_BASE_URL?.trim()),
  notes: rotationAt && rotationBy
    ? 'Rotation metadata recorded without token value. Re-run integration health page (S030) after deploy.'
    : 'Set DENTALLY_ROTATION_AT and DENTALLY_ROTATION_BY after rotating the pilot token outside chat.',
  exclusions: [
    'Never paste or print DENTALLY_API_TOKEN',
    'Never include patient-identifiable payloads',
  ],
}

const json = JSON.stringify(evidence, null, 2)
if (outFile) {
  const target = path.resolve(outFile)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, json, 'utf8')
  console.log(`Wrote ${target}`)
} else {
  console.log(json)
}

process.exit(evidence.rotationRecorded ? 0 : 2)

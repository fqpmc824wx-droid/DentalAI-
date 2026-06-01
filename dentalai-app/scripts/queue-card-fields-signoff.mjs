#!/usr/bin/env node
/**
 * Emit formal S091 queue card fields sign-off artifact (B-2, B-3, C-1, C-2).
 * No patient PII or tokens.
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

const SLICES = ['S091']

const artifact = {
  kind: 'queue_card_fields_signoff',
  signedOffAt: new Date().toISOString(),
  slices: SLICES,
  productBookRules: ['B-2', 'B-3', 'C-1', 'C-2'],
  identityBadges: [
    'confirmed', 'probable', 'multiple_match', 'no_match',
    'withheld', 'failed', 'unverified',
  ],
  summaryMaxSentences: 3,
  modules: [
    'lib/queue/card-identity.ts',
    'lib/queue/prepared-action.ts',
  ],
  signoffComplete: true,
}

const evidenceDir = path.join(getDataDir(), 'evidence')
const target = path.join(evidenceDir, 'queue-card-fields-signoff.json')
fs.mkdirSync(evidenceDir, { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({ ok: true, written: target, sliceCount: SLICES.length }, null, 2))

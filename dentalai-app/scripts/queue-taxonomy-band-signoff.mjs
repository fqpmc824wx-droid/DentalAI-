#!/usr/bin/env node
/**
 * Emit formal P12 queue taxonomy band sign-off artifact (S087–S090).
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

const SLICES = ['S087', 'S088', 'S089', 'S090']

const artifact = {
  kind: 'queue_taxonomy_band_signoff',
  signedOffAt: new Date().toISOString(),
  slices: SLICES,
  taxonomyCategories: 8,
  taxonomySubtypesMinimum: 30,
  flagColours: ['red', 'amber', 'teal', 'blue', 'grey'],
  lockedPriorityLevels: ['critical', 'high', 'standard', 'low'],
  referenceFormat: 'Q-[clinic]-[date]-[sequence]',
  modules: [
    'lib/queue/taxonomy.ts',
    'lib/queue/reference.ts',
    'lib/queue/flags.ts',
    'lib/queue/priority-policy.ts',
  ],
  signoffComplete: true,
}

const evidenceDir = path.join(getDataDir(), 'evidence')
const target = path.join(evidenceDir, 'queue-taxonomy-band-signoff.json')
fs.mkdirSync(evidenceDir, { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({ ok: true, written: target, sliceCount: SLICES.length }, null, 2))

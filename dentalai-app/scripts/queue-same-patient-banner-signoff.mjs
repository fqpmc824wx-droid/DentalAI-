#!/usr/bin/env node
/** S105 same-patient banner sign-off (E-1). */

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

const artifact = {
  kind: 'queue_same_patient_banner_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S105'],
  productBookRules: ['E-1'],
  modules: [
    'lib/queue/same-patient-banner.ts',
    'components/queue/SamePatientBanner.tsx',
  ],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-same-patient-banner-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: true, written: target }, null, 2))

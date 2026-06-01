#!/usr/bin/env node
/** S094 Dentally link panel sign-off artifact (B-5). */

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
  kind: 'queue_dentally_link_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S094'],
  productBookRules: ['B-5'],
  modules: [
    'lib/queue/dentally-link-panel.ts',
    'lib/dentally/record-url.ts',
    'components/queue/DentallyLinkPanel.tsx',
  ],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-dentally-link-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: true, written: target }, null, 2))

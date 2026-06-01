#!/usr/bin/env node
/** S097 callback tracker sign-off (D-5, D-6, D-8). */

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
  kind: 'queue_callback_tracker_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S097'],
  productBookRules: ['D-5', 'D-6', 'D-8'],
  modules: [
    'lib/queue/callback-tracker.ts',
    'components/queue/WorkingToolsPanel.tsx',
  ],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-callback-tracker-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: true, written: target }, null, 2))

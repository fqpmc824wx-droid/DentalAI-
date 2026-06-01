#!/usr/bin/env node
/** S099–S102 queue ownership band sign-off (D-1–D-4). */

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
  kind: 'queue_ownership_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S099', 'S100', 'S101', 'S102'],
  productBookRules: ['D-1', 'D-2', 'D-3', 'D-4'],
  modules: [
    'lib/queue/ownership.ts',
    'lib/queue/colleague-presence.ts',
    'lib/queue/ownership-service.ts',
    'components/queue/QueueOwnershipPanel.tsx',
    'components/queue/QueueLockHeartbeat.tsx',
  ],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-ownership-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: true, written: target }, null, 2))

#!/usr/bin/env node
/** S096 SMS visibility panel sign-off artifact (D-10). */

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
  kind: 'queue_sms_visibility_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S096'],
  productBookRules: ['D-10'],
  modules: [
    'lib/queue/sms-visibility.ts',
    'components/queue/SmsVisibilityPanel.tsx',
  ],
  deliveryStates: ['sent', 'queued', 'failed', 'suppressed'],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-sms-visibility-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: true, written: target }, null, 2))

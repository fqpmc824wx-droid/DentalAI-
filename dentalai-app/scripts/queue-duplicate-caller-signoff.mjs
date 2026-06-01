#!/usr/bin/env node
/** S106 duplicate caller sign-off (E-2). */

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
  kind: 'queue_duplicate_caller_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S106'],
  productBookRules: ['E-2'],
  modules: [
    'lib/queue/duplicate-caller.ts',
    'components/queue/DuplicateCallerAlert.tsx',
  ],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-duplicate-caller-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: true, written: target }, null, 2))

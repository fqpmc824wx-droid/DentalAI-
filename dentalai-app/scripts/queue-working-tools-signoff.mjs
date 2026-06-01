#!/usr/bin/env node
/** S095 working tools panel sign-off artifact (B-6). */

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
  kind: 'queue_working_tools_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S095'],
  productBookRules: ['B-6'],
  modules: [
    'lib/queue/working-tools.ts',
    'components/queue/WorkingToolsPanel.tsx',
    'lib/queue/actions.ts',
  ],
  features: [
    'autosaving_scratchpad',
    'holding_sms_status',
    'callback_time_suggestion',
    'callback_attempt_tracker',
    'patient_called_back_action',
    'outcome_selector',
    'notes',
    'assignee_lock_state',
    'audit_trail_hint',
  ],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-working-tools-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: true, written: target }, null, 2))

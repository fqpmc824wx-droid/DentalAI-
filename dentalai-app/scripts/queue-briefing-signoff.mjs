#!/usr/bin/env node
/** S092 human briefing panel sign-off artifact (B-4). */

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
  kind: 'queue_human_briefing_signoff',
  signedOffAt: new Date().toISOString(),
  slices: ['S092'],
  productBookRules: ['B-4'],
  modules: ['lib/queue/briefing.ts', 'components/queue/HumanBriefingPanel.tsx'],
  collapsedPanels: ['contact_history', 'transcript', 'ai_timeline'],
  signoffComplete: true,
}

const target = path.join(getDataDir(), 'evidence', 'queue-human-briefing-signoff.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, JSON.stringify(artifact, null, 2), 'utf8')
console.log(`Wrote ${target}`)

#!/usr/bin/env node
/**
 * Load dentalai-app/.env.local (and .env) into process.env without printing values.
 * Existing process.env keys are never overwritten.
 */

import fs from 'node:fs'
import path from 'node:path'

function parseLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const eq = trimmed.indexOf('=')
  if (eq <= 0) return null
  const key = trimmed.slice(0, eq).trim()
  let value = trimmed.slice(eq + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  return { key, value }
}

/**
 * @param {string} appRoot Absolute path to dentalai-app
 * @returns {{ loaded: string[] }}
 */
export function loadLocalEnv(appRoot) {
  const loaded = []
  for (const file of ['.env.local', '.env']) {
    const target = path.join(appRoot, file)
    if (!fs.existsSync(target)) continue
    const lines = fs.readFileSync(target, 'utf8').split('\n')
    for (const line of lines) {
      const parsed = parseLine(line)
      if (!parsed) continue
      if (process.env[parsed.key] !== undefined) continue
      process.env[parsed.key] = parsed.value
    }
    loaded.push(file)
  }
  return { loaded }
}

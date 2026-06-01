/**
 * P07 · S029–S031 — Dentally read-proof gate (code-ready evidence).
 *
 * S029 rotation sign-off requires external credential action; rotation evidence
 * script: scripts/dentally-rotation-evidence.mjs
 */

import { describe, expect, it } from 'vitest'
import { DENTALLY_ENDPOINTS } from '@/lib/dentally/endpoints'
import * as dentallyClient from '@/lib/dentally/client'

import fs from 'node:fs'
import path from 'node:path'

describe('S029 token rotation evidence (code-ready)', () => {
  it('ships rotation evidence script without embedding token values', () => {
    const scriptPath = path.join(process.cwd(), 'scripts/dentally-rotation-evidence.mjs')
    const source = fs.readFileSync(scriptPath, 'utf8')
    expect(source).toContain('DENTALLY_ROTATION_AT')
    expect(source).toContain('Never paste or print DENTALLY_API_TOKEN')
    expect(source).not.toMatch(/DENTALLY_API_TOKEN\s*=\s*['"][^'"]+['"]/)
  })
})

describe('S030 integration readiness surface', () => {
  it('exports getDentallyReadinessReport for role-gated integrations page', async () => {
    const mod = await import('@/lib/dentally/readiness')
    expect(typeof mod.getDentallyReadinessReport).toBe('function')
  })

  it('readiness report type excludes token fields', () => {
    const sampleKeys = [
      'status',
      'checkedAt',
      'health',
      'sites',
      'clinicMappings',
      'warnings',
    ]
    expect(sampleKeys).not.toContain('token')
    expect(sampleKeys).not.toContain('authorization')
  })
})

describe('S031 GET-only structural proof', () => {
  it('exports dentallyGet only — no write helpers', () => {
    const exports = Object.keys(dentallyClient)
    expect(exports).toContain('dentallyGet')
    expect(exports.some(k => /post|put|patch|delete|write/i.test(k))).toBe(false)
  })

  it('centralises read-only endpoint paths', () => {
    expect(DENTALLY_ENDPOINTS.currentUser).toBe('/v1/user')
    expect(DENTALLY_ENDPOINTS.practice).toBe('/v1/practice')
    expect(DENTALLY_ENDPOINTS.sites).toBe('/v1/sites')
    expect(DENTALLY_ENDPOINTS.patients).toBe('/v1/patients')
    expect(DENTALLY_ENDPOINTS.appointments).toBe('/v1/appointments')
  })
})

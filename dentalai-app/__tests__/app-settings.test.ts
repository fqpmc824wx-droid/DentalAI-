/**
 * P06 · S023 — app_settings durable schema + repository.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  getDb,
  __dbPathForTests,
  __persistenceEnabledForTests,
  __closeForTests,
} from '@/lib/db/client'
import {
  repoDeleteSetting,
  repoGetSetting,
  repoListSettings,
  repoUpsertSetting,
} from '@/lib/db/repositories/settings'

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentalai-settings-'))
  process.env.DENTALAI_DATA_DIR = tmpDir
})

afterAll(() => {
  __closeForTests()
  delete process.env.DENTALAI_DATA_DIR
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch { /* ignore */ }
})

describe('app_settings schema (S023)', () => {
  it('creates app_settings via migration v6', () => {
    expect(__persistenceEnabledForTests()).toBe(true)
    const db = getDb()
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'",
    ).get()
    expect(row).toBeTruthy()
    expect(fs.existsSync(__dbPathForTests())).toBe(true)

    const migrations = db.prepare(
      'SELECT version FROM schema_migrations WHERE version = 6',
    ).get()
    expect(migrations).toBeTruthy()
  })

  it('upserts clinic-scoped settings and lists by clinic', () => {
    const now = new Date().toISOString()
    repoUpsertSetting({
      clinicId: 'clinic-1',
      key: 'opening_hours_mode',
      value: 'standard',
      updatedAt: now,
      updatedBy: 'user-2',
    })
    repoUpsertSetting({
      clinicId: 'clinic-1',
      key: 'sms_suppression',
      value: 'false',
      updatedAt: now,
    })
    repoUpsertSetting({
      clinicId: 'clinic-2',
      key: 'opening_hours_mode',
      value: 'extended',
      updatedAt: now,
    })

    const clinic1 = repoListSettings('clinic-1')
    expect(clinic1).toHaveLength(2)
    expect(clinic1.map(s => s.key).sort()).toEqual(['opening_hours_mode', 'sms_suppression'])

    const fetched = repoGetSetting('clinic-1', 'opening_hours_mode')
    expect(fetched?.value).toBe('standard')
    expect(fetched?.updatedBy).toBe('user-2')

    expect(repoGetSetting('clinic-2', 'opening_hours_mode')?.value).toBe('extended')
  })

  it('updates on conflict and deletes by clinic+key', () => {
    const now = new Date().toISOString()
    repoUpsertSetting({
      clinicId: 'clinic-1',
      key: 'pilot_flag',
      value: 'off',
      updatedAt: now,
    })
    repoUpsertSetting({
      clinicId: 'clinic-1',
      key: 'pilot_flag',
      value: 'on',
      updatedAt: now,
      updatedBy: 'user-3',
    })
    expect(repoGetSetting('clinic-1', 'pilot_flag')?.value).toBe('on')

    expect(repoDeleteSetting('clinic-1', 'pilot_flag')).toBe(true)
    expect(repoGetSetting('clinic-1', 'pilot_flag')).toBeUndefined()
  })
})

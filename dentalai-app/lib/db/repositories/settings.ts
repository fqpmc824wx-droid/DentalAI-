import { getDb, persistenceEnabled } from '@/lib/db/client'

export type AppSetting = {
  clinicId: string
  key: string
  value: string
  updatedAt: string
  updatedBy?: string
}

type SettingRow = {
  clinic_id: string
  key: string
  value: string
  updated_at: string
  updated_by: string | null
}

function rowToSetting(row: SettingRow): AppSetting {
  return {
    clinicId: row.clinic_id,
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
  }
}

export function repoGetSetting(clinicId: string, key: string): AppSetting | undefined {
  if (!persistenceEnabled()) return undefined
  const row = getDb().prepare(
    'SELECT * FROM app_settings WHERE clinic_id = ? AND key = ?',
  ).get(clinicId, key) as SettingRow | undefined
  return row ? rowToSetting(row) : undefined
}

export function repoListSettings(clinicId: string): AppSetting[] {
  if (!persistenceEnabled()) return []
  const rows = getDb().prepare(
    'SELECT * FROM app_settings WHERE clinic_id = ? ORDER BY key',
  ).all(clinicId) as SettingRow[]
  return rows.map(rowToSetting)
}

export function repoUpsertSetting(setting: AppSetting): void {
  if (!persistenceEnabled()) return
  getDb().prepare(`
    INSERT INTO app_settings (clinic_id, key, value, updated_at, updated_by)
    VALUES (@clinicId, @key, @value, @updatedAt, @updatedBy)
    ON CONFLICT(clinic_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run({
    clinicId: setting.clinicId,
    key: setting.key,
    value: setting.value,
    updatedAt: setting.updatedAt,
    updatedBy: setting.updatedBy ?? null,
  })
}

export function repoDeleteSetting(clinicId: string, key: string): boolean {
  if (!persistenceEnabled()) return false
  const result = getDb().prepare(
    'DELETE FROM app_settings WHERE clinic_id = ? AND key = ?',
  ).run(clinicId, key)
  return result.changes > 0
}

import { runtimeSummary } from '@/lib/env/runtime'
import { findPublicSecretLeaks } from '@/lib/env/secrets'
import { persistenceEnabled, dbPath, getDataDir, getDb } from '@/lib/db/client'

export type HealthReport = {
  status: 'ok' | 'degraded' | 'unavailable'
  runtime: ReturnType<typeof runtimeSummary>
  persistence: {
    enabled: boolean
    reachable: boolean
    dataDir: string
    databaseFile?: string
  }
  checks: {
    authSecretConfigured: boolean
    secretHygiene: boolean
  }
  timestamp: string
}

export function getHealthReport(): HealthReport {
  const enabled = persistenceEnabled()
  let reachable = false
  let databaseFile: string | undefined

  if (enabled) {
    databaseFile = dbPath()
    try {
      getDb().prepare('SELECT 1').get()
      reachable = true
    } catch {
      reachable = false
    }
  }

  const authSecretConfigured = !!(
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  )
  const secretHygiene = findPublicSecretLeaks().length === 0

  let status: HealthReport['status'] = 'ok'
  if (!authSecretConfigured || !secretHygiene) status = 'degraded'
  if (enabled && !reachable) status = 'unavailable'

  return {
    status,
    runtime: runtimeSummary(),
    persistence: {
      enabled,
      reachable,
      dataDir: getDataDir(),
      databaseFile,
    },
    checks: {
      authSecretConfigured,
      secretHygiene,
    },
    timestamp: new Date().toISOString(),
  }
}

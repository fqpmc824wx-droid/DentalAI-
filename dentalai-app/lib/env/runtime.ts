/**
 * Runtime environment separation — dev / staging / production / test.
 *
 * DENTALAI_APP_ENV is the explicit deployment label. When unset, we derive from
 * NODE_ENV and Vitest so local dev, CI, and production behave predictably.
 */

export type AppEnv = 'development' | 'staging' | 'production' | 'test'

const APP_ENV_VALUES: AppEnv[] = ['development', 'staging', 'production', 'test']

export function readAppEnv(): AppEnv {
  const explicit = process.env.DENTALAI_APP_ENV?.trim().toLowerCase()
  if (explicit && APP_ENV_VALUES.includes(explicit as AppEnv)) {
    return explicit as AppEnv
  }
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return 'test'
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

export type RuntimeConfig = {
  appEnv: AppEnv
  nodeEnv: string
  /** Demo seed password (`demo`) is only acceptable outside production. */
  allowDemoSeedPassword: boolean
  /** Fail boot when AUTH_SECRET is missing or weak. */
  requireStrongAuthSecret: boolean
  /** Structured health endpoint is enabled (always on except in tests). */
  monitoringEnabled: boolean
  /** AUTH_TRUST_HOST should be false in production unless explicitly overridden. */
  trustHostDefault: boolean
}

export function readRuntimeConfig(): RuntimeConfig {
  const appEnv = readAppEnv()

  return {
    appEnv,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    allowDemoSeedPassword: appEnv !== 'production' && appEnv !== 'staging',
    requireStrongAuthSecret: appEnv === 'production' || appEnv === 'staging',
    monitoringEnabled: appEnv !== 'test',
    trustHostDefault: appEnv === 'development' || appEnv === 'test',
  }
}

/** Safe summary for health checks — no secrets. */
export function runtimeSummary() {
  const cfg = readRuntimeConfig()
  return {
    appEnv: cfg.appEnv,
    nodeEnv: cfg.nodeEnv,
    monitoringEnabled: cfg.monitoringEnabled,
  }
}

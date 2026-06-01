/**
 * Environment validation — fails fast at startup if required vars are missing.
 *
 * Imported at the top of lib/auth.ts so it runs before any auth config is read.
 *
 * NextAuth v5 reads either AUTH_SECRET or the legacy NEXTAUTH_SECRET, so we
 * accept either form. Same for AUTH_URL / NEXTAUTH_URL.
 *
 * Dentally vars (Phase 2):
 *   DENTALLY_API_BASE_URL  — required only when DENTALLY_API_TOKEN is set
 *   DENTALLY_API_TOKEN     — optional; absence means Dentally health = not_configured
 *   DENTALLY_TIMEOUT_MS    — optional, default 8000
 *
 * Deployment (S019):
 *   DENTALAI_APP_ENV       — development | staging | production (optional; derived)
 *   DENTALAI_DATA_DIR      — pin SQLite directory for staging/production
 *
 * The token is read server-side ONLY (see lib/dentally/env.ts which uses
 * `import 'server-only'`). It is never assembled into URLs, never logged,
 * and never sent to a Client Component.
 */

import { readRuntimeConfig } from '@/lib/env/runtime'
import { findPublicSecretLeaks, validateAuthSecretStrength } from '@/lib/env/secrets'

function hasOneOf(...keys: string[]): boolean {
  return keys.some(k => !!process.env[k])
}

function validateEnv() {
  const runtime = readRuntimeConfig()
  const missing: string[] = []
  const hygiene: string[] = []

  if (!hasOneOf('AUTH_SECRET', 'NEXTAUTH_SECRET')) {
    missing.push('AUTH_SECRET (or NEXTAUTH_SECRET)')
  }

  // Dentally: token is optional, but if present, base URL must be too.
  if (process.env.DENTALLY_API_TOKEN && !process.env.DENTALLY_API_BASE_URL) {
    missing.push('DENTALLY_API_BASE_URL (required when DENTALLY_API_TOKEN is set)')
  }

  hygiene.push(...validateAuthSecretStrength(runtime.requireStrongAuthSecret))
  hygiene.push(...findPublicSecretLeaks().map(key => `${key} must not expose server secrets to the browser`))

  if (runtime.appEnv === 'production' && process.env.AUTH_TRUST_HOST === 'true') {
    console.warn(
      '[dentalai/env] AUTH_TRUST_HOST=true in production — restrict trusted hosts at the edge when deployed.',
    )
  }

  const problems = [...missing, ...hygiene]
  if (problems.length > 0) {
    throw new Error(
      `Environment validation failed:\n` +
      problems.map(p => `  - ${p}`).join('\n') +
      `\nCopy .env.example to .env.local and fill in the values.\n` +
      `Generate a secret with: openssl rand -base64 32`,
    )
  }
}

// Only validate in server context (not during Next.js edge/client bundling)
if (typeof window === 'undefined') {
  validateEnv()
}

export { readRuntimeConfig, readAppEnv } from '@/lib/env/runtime'
export type { AppEnv, RuntimeConfig } from '@/lib/env/runtime'

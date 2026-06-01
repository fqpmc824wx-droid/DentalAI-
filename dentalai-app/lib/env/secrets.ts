/**
 * Secret hygiene — boot-time checks that secrets are present and not weak
 * in staging/production. Never logs secret values.
 */

const WEAK_AUTH_SECRETS = new Set([
  'changeme',
  'demo',
  'development',
  'secret',
  'test',
  'your-secret-here',
])

const MIN_AUTH_SECRET_LENGTH = 32

function authSecretValue(): string | undefined {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
}

export function validateAuthSecretStrength(requireStrong: boolean): string[] {
  if (!requireStrong) return []

  const secret = authSecretValue()
  const issues: string[] = []

  if (!secret) {
    issues.push('AUTH_SECRET (or NEXTAUTH_SECRET) is required in staging/production')
    return issues
  }

  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    issues.push(`AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters in staging/production`)
  }

  if (WEAK_AUTH_SECRETS.has(secret.toLowerCase())) {
    issues.push('AUTH_SECRET must not use a known weak placeholder in staging/production')
  }

  return issues
}

/** Block NEXT_PUBLIC_* vars that would expose server secrets in the browser bundle. */
export function findPublicSecretLeaks(): string[] {
  const blockedPrefixes = ['NEXT_PUBLIC_AUTH_', 'NEXT_PUBLIC_DENTALLY_']
  const leaks: string[] = []

  for (const [key, value] of Object.entries(process.env)) {
    if (!value?.trim()) continue
    for (const prefix of blockedPrefixes) {
      if (key.startsWith(prefix)) {
        leaks.push(key)
      }
    }
  }

  return leaks
}

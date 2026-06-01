import { readAppEnv } from '../env/runtime'

/**
 * Baseline security headers for every HTML/API response.
 * CSP is intentionally conservative for a self-hosted Next.js app.
 */

export function buildContentSecurityPolicy(appEnv: ReturnType<typeof readAppEnv>): string {
  const scriptSrc =
    appEnv === 'development'
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'"

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export function buildSecurityHeaders(appEnv: ReturnType<typeof readAppEnv>): Record<string, string> {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy(appEnv),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-DNS-Prefetch-Control': 'off',
  }
}

/** Next.js `headers()` config — array of { key, value } pairs. */
export function nextSecurityHeadersConfig(): { key: string; value: string }[] {
  const headers = buildSecurityHeaders(readAppEnv())
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

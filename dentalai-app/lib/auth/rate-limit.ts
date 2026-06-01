/**
 * Login attempt rate limiter — row-level SQLite storage.
 *
 * 5 failed attempts per email per 15-minute window, then locked until the window expires.
 * Resets on successful login. Survives process restart when persistence is enabled.
 */

import { persistenceEnabled } from '@/lib/db/client'
import {
  repoDeleteLoginAttempt,
  repoLoadLoginAttempts,
  repoUpsertLoginAttempt,
  type RateBucket,
} from '@/lib/db/repositories/login-attempts'

export type { RateBucket }
export { repoLoadLoginAttempts as loadLoginAttemptsFromDb }

export const WINDOW_MS = 15 * 60 * 1000
export const MAX_ATTEMPTS = 5

const globalStore = globalThis as typeof globalThis & {
  __loginAttempts?: Map<string, RateBucket>
}

function load(): Map<string, RateBucket> {
  if (globalStore.__loginAttempts) return globalStore.__loginAttempts

  if (persistenceEnabled()) {
    globalStore.__loginAttempts = repoLoadLoginAttempts()
  } else {
    globalStore.__loginAttempts = new Map()
  }

  return globalStore.__loginAttempts
}

function persistBucket(bucket: RateBucket): void {
  if (persistenceEnabled()) {
    repoUpsertLoginAttempt(bucket)
  }
}

function deleteBucket(email: string): void {
  if (persistenceEnabled()) {
    repoDeleteLoginAttempt(email)
  }
}

/** Test-only: drop the process cache so the next access reloads from storage. */
export function __resetRateLimitForTests(): void {
  delete globalStore.__loginAttempts
}

export function checkRateLimit(email: string): { allowed: boolean; remaining: number } {
  const key = email.toLowerCase().trim()
  const now = Date.now()
  const buckets = load()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    const fresh = { email: key, count: 0, windowStart: now }
    buckets.set(key, fresh)
    persistBucket(fresh)
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - bucket.count }
}

export function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase().trim()
  const now = Date.now()
  const buckets = load()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    const fresh = { email: key, count: 1, windowStart: now }
    buckets.set(key, fresh)
    persistBucket(fresh)
  } else {
    bucket.count += 1
    buckets.set(key, bucket)
    persistBucket(bucket)
  }
}

export function resetRateLimit(email: string): void {
  const key = email.toLowerCase().trim()
  const buckets = load()
  if (buckets.delete(key)) deleteBucket(key)
}

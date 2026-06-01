import { getDb, persistenceEnabled } from '@/lib/db/client'

export type RateBucket = { email: string; count: number; windowStart: number }

type AttemptRow = { email: string; count: number; window_start: number }

function rowToBucket(row: AttemptRow): RateBucket {
  return { email: row.email, count: row.count, windowStart: row.window_start }
}

export function repoLoadLoginAttempts(): Map<string, RateBucket> {
  if (!persistenceEnabled()) return new Map()
  const rows = getDb().prepare('SELECT * FROM login_attempts').all() as AttemptRow[]
  const map = new Map<string, RateBucket>()
  for (const row of rows) map.set(row.email, rowToBucket(row))
  return map
}

export function repoUpsertLoginAttempt(bucket: RateBucket): void {
  if (!persistenceEnabled()) return
  getDb().prepare(`
    INSERT INTO login_attempts (email, count, window_start) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET count = excluded.count, window_start = excluded.window_start
  `).run(bucket.email, bucket.count, bucket.windowStart)
}

export function repoDeleteLoginAttempt(email: string): boolean {
  if (!persistenceEnabled()) return false
  const result = getDb().prepare('DELETE FROM login_attempts WHERE email = ?').run(email)
  return result.changes > 0
}

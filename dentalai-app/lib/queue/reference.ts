/**
 * S088 — Queue reference and routing (S3-B · B-1).
 *
 * Format: Q-[clinic]-[date]-[sequence]
 * Plain-English type/subtype, priority, clinic, created timestamp, elapsed time
 * are carried on the queue item record — not embedded in the reference code.
 */

export type QueueReferenceParts = {
  clinicCode: string
  dateYmd: string
  sequence: number
}

const REF_PATTERN = /^Q-([a-z0-9-]+)-(\d{8})-(\d+)$/i

export function formatQueueReference(parts: QueueReferenceParts): string {
  const clinic = parts.clinicCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const seq = String(Math.max(1, Math.floor(parts.sequence))).padStart(4, '0')
  return `Q-${clinic}-${parts.dateYmd}-${seq}`
}

export function parseQueueReference(code: string): QueueReferenceParts | null {
  const match = code.trim().match(REF_PATTERN)
  if (!match) return null
  return {
    clinicCode: match[1],
    dateYmd: match[2],
    sequence: Number.parseInt(match[3], 10),
  }
}

export function nextQueueSequence(existingCodes: string[], clinicCode: string, dateYmd: string): number {
  const prefix = `Q-${clinicCode.toLowerCase()}-${dateYmd}-`
  let max = 0
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue
    const parsed = parseQueueReference(code)
    if (parsed) max = Math.max(max, parsed.sequence)
  }
  return max + 1
}

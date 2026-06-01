/**
 * S091 — Prepared action, summary, and instruction rules (S3-B · B-3, S3-C · C-1, C-2).
 */

import type { QueueFlagId } from './flags'

export type PreparedAction = {
  flags: QueueFlagId[]
  summary: string
  instruction: string
}

const TRANSCRIPT_MARKERS = [
  /\[transcript\]/i,
  /\bcaller said:/i,
  /\bai said:/i,
  /\bsystem log:/i,
  /\btimestamp:/i,
]

function countSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/(?<=[.!?])\s+/).filter(Boolean).length
}

/** C-1 — plain English, max three sentences, never a transcript or system log. */
export function validateSummary(text: string): {
  ok: boolean
  sentenceCount: number
  errors: string[]
} {
  const errors: string[] = []
  const trimmed = text.trim()
  if (!trimmed) errors.push('Summary is required')
  const sentenceCount = countSentences(trimmed)
  if (sentenceCount > 3) errors.push('Summary must be at most three sentences')
  for (const marker of TRANSCRIPT_MARKERS) {
    if (marker.test(trimmed)) errors.push('Summary must not read like a transcript or system log')
  }
  return { ok: errors.length === 0, sentenceCount, errors }
}

/** C-2 — one actionable line directly under the summary. */
export function validateInstruction(text: string): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const trimmed = text.trim()
  if (!trimmed) errors.push('Instruction is required')
  if (trimmed.includes('\n')) errors.push('Instruction must be a single line')
  if (trimmed.length > 240) errors.push('Instruction must stay concise')
  return { ok: errors.length === 0, errors }
}

export function assertPreparedAction(action: PreparedAction): boolean {
  return validateSummary(action.summary).ok && validateInstruction(action.instruction).ok
}

/** B-3 — assemble flags, patient-centred summary, and staff instruction. */
export function buildPreparedAction(input: {
  flags: QueueFlagId[]
  summary: string
  instruction: string
}): PreparedAction {
  const summaryCheck = validateSummary(input.summary)
  const instructionCheck = validateInstruction(input.instruction)
  if (!summaryCheck.ok || !instructionCheck.ok) {
    const messages = [...summaryCheck.errors, ...instructionCheck.errors]
    throw new Error(`Invalid prepared action: ${messages.join('; ')}`)
  }
  return {
    flags: [...new Set(input.flags)],
    summary: input.summary.trim(),
    instruction: input.instruction.trim(),
  }
}

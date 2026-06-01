/**
 * S103 — Close rule (S3-D · D-11).
 *
 * Close stays disabled until an allowed outcome is selected and required notes are entered.
 * Terminal items remain immutable for outcome changes.
 */

import type { QueueItem } from './types'
import { isTerminalQueueStatus } from './types'

export type CloseEligibilityInput = {
  outcome?: string
  notes?: string
}

export type CloseEligibility = {
  canClose: boolean
  requiresOutcome: boolean
  requiresNotes: boolean
  minNotesLength: number
  errors: string[]
  immutable: boolean
}

const MIN_NOTES_LENGTH = 5

function itemRequiresOutcome(type: QueueItem['type']): boolean {
  return type === 'callback' || type === 'emergency' || type === 'fta_followup' || type === 'recall'
}

export function evaluateCloseEligibility(
  item: QueueItem,
  input: CloseEligibilityInput = {},
): CloseEligibility {
  if (isTerminalQueueStatus(item.status)) {
    return {
      canClose: false,
      requiresOutcome: false,
      requiresNotes: false,
      minNotesLength: MIN_NOTES_LENGTH,
      errors: ['This item is already closed — outcomes cannot be changed'],
      immutable: true,
    }
  }

  const requiresOutcome = itemRequiresOutcome(item.type)
  const requiresNotes =
    item.type === 'emergency' || requiresOutcome

  const errors: string[] = []
  const outcome = input.outcome?.trim() ?? ''
  const notes = input.notes?.trim() ?? ''

  if (requiresOutcome && !outcome) {
    errors.push('Select an allowed outcome before closing')
  }

  if (requiresNotes && notes.length < MIN_NOTES_LENGTH) {
    errors.push(`Enter required notes (minimum ${MIN_NOTES_LENGTH} characters)`)
  }

  if (item.type === 'booking_request') {
    errors.push('Booking requests close via approve, reject, or modify — not generic close')
  }

  return {
    canClose: errors.length === 0,
    requiresOutcome,
    requiresNotes,
    minNotesLength: MIN_NOTES_LENGTH,
    errors,
    immutable: false,
  }
}

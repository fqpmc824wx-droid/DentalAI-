/**
 * Queue action permission matrix.
 *
 * Two orthogonal checks — both must pass:
 *   1. canRolePerformAction(role, action)   — is this role allowed to do this at all?
 *   2. isActionValidForType(type, action)   — does this action make sense for this item type?
 *
 * Booking approve/modify also require ruleDecision !== 'block' (see assertBookingMutationPermitted).
 * Emergency items MUST use emergency_outcome — generic resolve is blocked.
 */

import type { Role } from '@/types'
import type { QueueItemType } from './types'
import type { RuleDecision } from '@/lib/rules/types'

export type QueueAction =
  | 'acknowledge'
  | 'approve_request'
  | 'reject_request'
  | 'modify_request'
  | 'callback'
  | 'callback_unable'
  | 'escalate'
  | 'resolve'
  | 'emergency_outcome'

// ── Role → allowed actions ────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, Set<QueueAction>> = {
  receptionist: new Set([
    'acknowledge',
    'approve_request',
    'reject_request',
    'modify_request',
    'callback',
    'callback_unable',
    'emergency_outcome',   // front-line — must be able to log emergency outcomes
  ]),
  practice_manager: new Set([
    'acknowledge',
    'approve_request',
    'reject_request',
    'modify_request',
    'callback',
    'callback_unable',
    'escalate',
    'resolve',
    'emergency_outcome',
  ]),
  group_owner: new Set([
    'acknowledge',
    'approve_request',
    'reject_request',
    'modify_request',
    'callback',
    'callback_unable',
    'escalate',
    'resolve',
    'emergency_outcome',
  ]),
  super_admin: new Set([
    'acknowledge',
    'approve_request',
    'reject_request',
    'modify_request',
    'callback',
    'callback_unable',
    'escalate',
    'resolve',
    'emergency_outcome',
  ]),
}

// ── Item type → valid actions ─────────────────────────────────────────────────
// Emergency items MUST use emergency_outcome — generic resolve is blocked.
// Booking requests MUST use approve/reject/modify — generic resolve is blocked.

const TYPE_ACTION_ALLOWLIST: Record<QueueItemType, Set<QueueAction>> = {
  booking_request:  new Set(['acknowledge', 'approve_request', 'reject_request', 'modify_request', 'escalate']),
  emergency:        new Set(['acknowledge', 'emergency_outcome', 'escalate']),
  callback:         new Set(['acknowledge', 'callback', 'callback_unable', 'resolve', 'escalate']),
  identity_review:  new Set(['acknowledge', 'resolve', 'escalate']),
  payment_recovery: new Set(['acknowledge', 'callback', 'callback_unable', 'resolve', 'escalate']),
  fta_followup:     new Set(['acknowledge', 'callback', 'callback_unable', 'resolve', 'escalate']),
  recall:           new Set(['acknowledge', 'callback', 'callback_unable', 'resolve', 'escalate']),
  cancellation:     new Set(['acknowledge', 'resolve', 'escalate']),
  running_late:     new Set(['acknowledge', 'resolve']),
  complaint:        new Set(['acknowledge', 'escalate', 'resolve']),
}

// ── Public API ────────────────────────────────────────────────────────────────

export function canRolePerformAction(role: Role, action: QueueAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false
}

export function isActionValidForType(type: QueueItemType, action: QueueAction): boolean {
  return TYPE_ACTION_ALLOWLIST[type]?.has(action) ?? false
}

export class PermissionDeniedError extends Error {
  public readonly reason: 'role' | 'type'
  constructor(action: QueueAction, reason: 'role' | 'type', detail: string) {
    super(`Action "${action}" denied (${reason}): ${detail}`)
    this.name = 'PermissionDeniedError'
    this.reason = reason
  }
}

export function assertActionPermitted(
  role: Role,
  itemType: QueueItemType,
  action: QueueAction,
): void {
  if (!canRolePerformAction(role, action)) {
    throw new PermissionDeniedError(action, 'role', `role "${role}" cannot perform "${action}"`)
  }
  if (!isActionValidForType(itemType, action)) {
    throw new PermissionDeniedError(action, 'type', `"${action}" is not valid for item type "${itemType}"`)
  }
}

/** Rules-engine Block disables approve/modify on booking requests. Reject stays available. */
export function isBookingApprovalBlockedByRules(
  itemType: QueueItemType,
  ruleDecision: RuleDecision | undefined,
  action: QueueAction,
): boolean {
  if (itemType !== 'booking_request') return false
  if (ruleDecision !== 'block') return false
  return action === 'approve_request' || action === 'modify_request'
}

export function assertBookingMutationPermitted(
  role: Role,
  itemType: QueueItemType,
  ruleDecision: RuleDecision | undefined,
  action: 'approve_request' | 'reject_request' | 'modify_request',
): void {
  assertActionPermitted(role, itemType, action)
  if (isBookingApprovalBlockedByRules(itemType, ruleDecision, action)) {
    throw new PermissionDeniedError(
      action,
      'type',
      'rules engine blocked approval on this booking request',
    )
  }
}

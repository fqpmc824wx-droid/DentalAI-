/**
 * S101 — Pass to colleague panel (S3-D · D-3).
 */

import { listUsers } from '@/lib/users/store'
import type { QueueItem } from './types'
import { resolveLockMode } from './ownership'

export type ColleaguePresenceStatus = 'available' | 'on_call' | 'handling_task'

export type ClinicColleagueOption = {
  userId: string
  name: string
  role: string
  status: ColleaguePresenceStatus
  statusLabel: string
  currentItemTitle?: string
  canReceive: boolean
}

export type PassToColleaguePanel = {
  visible: boolean
  colleagues: ClinicColleagueOption[]
  minReasonLength: number
}

const MIN_REASON_LENGTH = 5

function mockPresence(userId: string, items: QueueItem[]): ColleaguePresenceStatus {
  const holding = items.find(
    i => i.assignedTo === userId && resolveLockMode(i) === 'hard_lock',
  )
  if (holding) return 'handling_task'
  const code = userId.charCodeAt(userId.length - 1) % 5
  if (code === 0) return 'on_call'
  return 'available'
}

function statusLabel(status: ColleaguePresenceStatus): string {
  switch (status) {
    case 'available':
      return 'Available'
    case 'on_call':
      return 'On a call'
    case 'handling_task':
      return 'Handling a task'
  }
}

export function buildPassToColleaguePanel(input: {
  item: QueueItem
  actorUserId: string
  clinicId: string
  allClinicItems: QueueItem[]
}): PassToColleaguePanel {
  const mode = resolveLockMode(input.item)
  const holderIsActor = input.item.assignedTo === input.actorUserId
  const visible =
    !holderIsActor
      ? false
      : mode === 'hard_lock' || mode === 'soft_claim'

  if (!visible) {
    return { visible: false, colleagues: [], minReasonLength: MIN_REASON_LENGTH }
  }

  const users = listUsers([input.clinicId]).filter(
    u => u.id !== input.actorUserId && u.status === 'active',
  )

  const colleagues: ClinicColleagueOption[] = users.map(u => {
    const status = mockPresence(u.id, input.allClinicItems)
    const current = input.allClinicItems.find(
      i => i.assignedTo === u.id && resolveLockMode(i) !== 'none',
    )
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      status,
      statusLabel: statusLabel(status),
      currentItemTitle: current?.title,
      canReceive: status !== 'handling_task',
    }
  })

  return {
    visible: true,
    colleagues,
    minReasonLength: MIN_REASON_LENGTH,
  }
}

export function validatePassReason(reason: string): { ok: boolean; error?: string } {
  const trimmed = reason.trim()
  if (trimmed.length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      error: `Pass reason must be at least ${MIN_REASON_LENGTH} characters`,
    }
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: 'Pass reason is too long (max 2000 characters)' }
  }
  return { ok: true }
}

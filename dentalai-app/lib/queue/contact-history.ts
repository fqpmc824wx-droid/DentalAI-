/**
 * S109 — Patient contact history panel (S3-E · E-3).
 *
 * Collapsed context: last call/outcome, last appointment, campaign contact,
 * prior anxiety or complaint, FTA count, holding SMS sent today.
 */

import type { MockPatient } from '@/lib/mock/patients'
import type { QueueItem } from './types'
import { isTerminalQueueStatus } from './types'

export type ContactHistoryEntry = {
  label: string
  value: string
  tone?: 'default' | 'warn' | 'ok'
}

export type ContactHistoryPanel = {
  show: boolean
  entries: ContactHistoryEntry[]
  collapsedByDefault: boolean
}

function findLastResolvedCall(input: {
  patientId?: string
  callerPhone: string
  allItems: QueueItem[]
}): QueueItem | undefined {
  const matches = input.allItems
    .filter(i => {
      const byPatient = input.patientId && i.patientId === input.patientId
      const byPhone = i.callerPhone === input.callerPhone
      return (byPatient || byPhone) && isTerminalQueueStatus(i.status)
    })
    .sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt))
  return matches[0]
}

export function buildContactHistoryPanel(input: {
  item: QueueItem
  patient?: MockPatient | null
  allItems: QueueItem[]
  nowMs?: number
}): ContactHistoryPanel {
  const patient = input.patient
  if (!patient && !input.item.patientId) {
    return { show: false, entries: [], collapsedByDefault: true }
  }

  const entries: ContactHistoryEntry[] = []
  const lastCall = findLastResolvedCall({
    patientId: input.item.patientId,
    callerPhone: input.item.callerPhone,
    allItems: input.allItems,
  })

  if (lastCall) {
    entries.push({
      label: 'Last call',
      value: `${lastCall.title} — ${lastCall.status.replace(/_/g, ' ')}`,
    })
  } else {
    entries.push({ label: 'Last call', value: 'No prior closed contact on file' })
  }

  if (patient?.lastAppointment) {
    entries.push({
      label: 'Last appointment',
      value: `${patient.lastAppointment} · routine care`,
    })
  }

  if (patient?.isLapsed) {
    entries.push({
      label: 'Campaign contact',
      value: 'Recall outreach within last 30 days',
      tone: 'warn',
    })
  } else {
    entries.push({ label: 'Campaign contact', value: 'None in last 30 days' })
  }

  if (patient?.notes?.toLowerCase().includes('anxiety')) {
    entries.push({ label: 'Prior anxiety', value: 'Noted on patient record', tone: 'warn' })
  }
  if (patient?.notes?.toLowerCase().includes('fta')) {
    entries.push({ label: 'Prior complaint / FTA', value: patient.notes, tone: 'warn' })
  }

  entries.push({
    label: 'FTA count',
    value: patient?.isFTA ? '1 on record' : '0',
    tone: patient?.isFTA ? 'warn' : 'ok',
  })

  const holdingSmsToday =
    input.item.source === 'ai_call' &&
    input.item.callerState !== 'withheld' &&
    input.item.confidence >= 40
  entries.push({
    label: 'Holding SMS today',
    value: holdingSmsToday ? 'Sent or queued for this item' : 'Not sent — verify identity first',
    tone: holdingSmsToday ? 'ok' : 'warn',
  })

  return {
    show: entries.length > 0,
    entries,
    collapsedByDefault: true,
  }
}

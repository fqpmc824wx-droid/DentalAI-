/**
 * S105 — Same-patient banner (S3-E · E-1).
 *
 * When a patient has other open requests, show count and expandable links.
 * Staff decide whether to close as Duplicate — never auto-merge.
 */

import type { QueueItem } from './types'
import { isTerminalQueueStatus } from './types'

export type SamePatientRelatedItem = {
  id: string
  title: string
  type: QueueItem['type']
  status: QueueItem['status']
  createdAt: string
  href: string
}

export type SamePatientBanner = {
  show: boolean
  count: number
  message: string
  relatedItems: SamePatientRelatedItem[]
  guidance: string
}

export function findSamePatientOpenItems(input: {
  currentItem: QueueItem
  allItems: QueueItem[]
}): QueueItem[] {
  const patientId = input.currentItem.patientId
  if (!patientId) return []

  return input.allItems.filter(
    i =>
      i.id !== input.currentItem.id &&
      i.patientId === patientId &&
      i.clinicId === input.currentItem.clinicId &&
      !isTerminalQueueStatus(i.status),
  )
}

export function buildSamePatientBanner(input: {
  currentItem: QueueItem
  allItems: QueueItem[]
}): SamePatientBanner {
  const related = findSamePatientOpenItems(input)

  if (related.length === 0) {
    return {
      show: false,
      count: 0,
      message: '',
      relatedItems: [],
      guidance: '',
    }
  }

  const count = related.length
  return {
    show: true,
    count,
    message: `This patient has ${count} other open request${count === 1 ? '' : 's'}.`,
    relatedItems: related
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(i => ({
        id: i.id,
        title: i.title,
        type: i.type,
        status: i.status,
        createdAt: i.createdAt,
        href: `/queue/${i.id}`,
      })),
    guidance:
      'Review linked items before acting. Close any duplicate as Duplicate — items are never auto-merged.',
  }
}

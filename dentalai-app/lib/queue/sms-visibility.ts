/**
 * S096 — SMS visibility panel (S3-D · D-10).
 *
 * Show sent, suppressed, or failed status; exact content; recipient;
 * timestamp; delivery state; suppression reason; manual retry on failure.
 */

import type { QueueItem } from './types'

export type SmsDeliveryState = 'sent' | 'queued' | 'failed' | 'suppressed' | 'none'

export type SmsVisibilityRecord = {
  id: string
  deliveryState: SmsDeliveryState
  content: string
  recipient: string
  sentAt?: string
  suppressionReason?: string
  failureReason?: string
  canRetry: boolean
  kind: 'holding_sms' | 'staff_follow_up'
}

export type SmsVisibilityPanel = {
  visible: boolean
  records: SmsVisibilityRecord[]
  hasFailure: boolean
  hasSuppression: boolean
}

const HOLDING_SMS_TEMPLATE =
  'Thanks for calling. We are preparing your request and a team member will be in touch shortly.'

const EMERGENCY_HOLDING_SMS =
  'Thank you for calling. We have noted your request and a member of our team will contact you shortly.'

function buildHoldingSms(item: QueueItem): SmsVisibilityRecord | null {
  if (item.source !== 'ai_call') return null

  if (item.callerState === 'withheld' || item.confidence < 40) {
    return {
      id: `${item.id}-holding`,
      deliveryState: 'suppressed',
      content: HOLDING_SMS_TEMPLATE,
      recipient: item.callerPhone || 'unknown',
      suppressionReason: 'Identity not verified — holding SMS withheld until staff review.',
      canRetry: false,
      kind: 'holding_sms',
    }
  }

  if (item.type === 'emergency') {
    return {
      id: `${item.id}-holding`,
      deliveryState: 'sent',
      content: EMERGENCY_HOLDING_SMS,
      recipient: item.callerPhone,
      sentAt: item.createdAt,
      canRetry: false,
      kind: 'holding_sms',
    }
  }

  if (item.callerState === 'no_match' && item.confidence < 55) {
    return {
      id: `${item.id}-holding`,
      deliveryState: 'failed',
      content: HOLDING_SMS_TEMPLATE,
      recipient: item.callerPhone,
      sentAt: item.createdAt,
      failureReason: 'Carrier rejected — invalid or incomplete number.',
      canRetry: true,
      kind: 'holding_sms',
    }
  }

  return {
    id: `${item.id}-holding`,
    deliveryState: 'queued',
    content: HOLDING_SMS_TEMPLATE,
    recipient: item.callerPhone,
    canRetry: false,
    kind: 'holding_sms',
  }
}

export function buildSmsVisibilityPanel(input: { item: QueueItem }): SmsVisibilityPanel {
  const holding = buildHoldingSms(input.item)
  const records = holding ? [holding] : []

  return {
    visible: records.length > 0,
    records,
    hasFailure: records.some(r => r.deliveryState === 'failed'),
    hasSuppression: records.some(r => r.deliveryState === 'suppressed'),
  }
}

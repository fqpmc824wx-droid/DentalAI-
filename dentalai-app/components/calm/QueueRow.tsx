import Link from 'next/link'
import type { ReactNode } from 'react'
import { StatusPill, type PillIntent } from './StatusPill'
import { ConfidenceBar } from './ConfidenceBar'

/**
 * QueueRow — fixed-column grid for queue list & dashboard.
 *
 * Columns (desktop):
 *   time | type pill | title + summary + reason | confidence bar | status pill
 *
 * Mobile collapses to two-row stack but preserves alignment via grid-template-areas.
 *
 * <QueueRow
 *   href="/queue/q-001"
 *   time="14:32"
 *   typeLabel="Booking"
 *   title="Routine checkup — Sarah Williams"
 *   summary="Wants a Tuesday afternoon slot, mentioned wisdom tooth."
 *   reason="Patient has outstanding balance — flag before booking"
 *   confidence={87}
 *   status={{ intent: 'ai', label: 'Nod to approve' }}
 *   resolved={false}
 * />
 */
export function QueueRow({
  href,
  time,
  typeLabel,
  typeIntent = 'neutral',
  title,
  summary,
  reason,
  confidence,
  status,
  resolved = false,
}: {
  href: string
  time: string
  typeLabel: string
  typeIntent?: PillIntent
  title: ReactNode
  summary?: ReactNode
  reason?: ReactNode
  confidence?: number
  status: { intent: PillIntent; label: string }
  resolved?: boolean
}) {
  const cls = ['cm-qrow']
  if (resolved) cls.push('resolved')
  return (
    <Link href={href} className={cls.join(' ')}>
      <div className="col-time">{time}</div>
      <div className="col-type">
        <StatusPill intent={typeIntent} size="sm">{typeLabel}</StatusPill>
      </div>
      <div className="col-main">
        <h3>{title}</h3>
        {summary && <p className="summary">{summary}</p>}
        {reason && <p className="reason">{reason}</p>}
      </div>
      <div className="col-confidence">
        {typeof confidence === 'number' && <ConfidenceBar value={confidence} inline />}
      </div>
      <div className="col-status">
        <StatusPill intent={status.intent}>{status.label}</StatusPill>
      </div>
    </Link>
  )
}

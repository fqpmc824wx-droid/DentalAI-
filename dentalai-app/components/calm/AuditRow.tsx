import type { ReactNode } from 'react'
import { StatusPill, type PillIntent } from './StatusPill'

/**
 * AuditRow — date+time | action+summary+actor | status pill.
 *
 * Stable fixed-column grid that matches QueueRow rhythm.
 */
export function AuditRow({
  date,
  time,
  action,
  summary,
  actor,
  status,
}: {
  date: string
  time: string
  action: ReactNode
  summary?: ReactNode
  actor?: ReactNode
  status: { intent: PillIntent; label: string }
}) {
  return (
    <div className="cm-audit-row">
      <div className="when">
        <div className="date">{date}</div>
        <div className="time">{time}</div>
      </div>
      <div className="main">
        <h4>{action}</h4>
        {summary && <p className="summary">{summary}</p>}
        {actor && <p className="actor">{actor}</p>}
      </div>
      <div className="status">
        <StatusPill intent={status.intent} size="sm">{status.label}</StatusPill>
      </div>
    </div>
  )
}

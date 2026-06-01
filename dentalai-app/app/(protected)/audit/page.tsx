import { requireSession } from '@/lib/access'
import { getAuditEvents } from '@/lib/audit/store'
import type { AuditStatus } from '@/lib/audit/types'
import {
  PageShell,
  PageHeader,
  AuditRow,
  Banner,
  EmptyState,
  GlyphInbox,
  PageFoot,
  type PillIntent,
} from '@/components/calm'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const STATUS_INTENT: Record<AuditStatus, PillIntent> = {
  success: 'allow',
  failure: 'block',
  pending: 'neutral',
}

export default async function AuditPage() {
  const actor = await requireSession()
  const events = getAuditEvents({ clinicIds: actor.clinicIds, limit: 100 })
  const isMulti = actor.clinicIds.length > 1

  return (
    <PageShell>
      <PageHeader
        title={<>The <em>audit log</em>.</>}
        sub={`Every action logged · actor, clinic, timestamp, outcome${isMulti ? ` · ${actor.clinicIds.length} clinics` : ''}`}
      />

      <Banner tone="info">
        Append-only audit log in typed SQLite — survives restart, no event cap. Enterprise schema with row-level storage.
      </Banner>

      {events.length === 0 ? (
        <EmptyState
          glyph={<GlyphInbox />}
          title="No events yet"
          message="Events appear as staff take actions."
        />
      ) : (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingBottom: 12,
            marginBottom: 4,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {events.length} events
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--muted)',
            }}>
              Newest first · {isMulti ? 'across assigned clinics' : 'clinic-scoped'}
            </span>
          </div>

          <div>
            {events.map(event => (
              <AuditRow
                key={event.id}
                date={formatDate(event.timestamp)}
                time={formatTime(event.timestamp)}
                action={event.action}
                summary={event.summary}
                actor={`${event.actor.name} · ${event.actor.role.replace('_', ' ')}${isMulti ? ` · ${event.clinicId}` : ''}`}
                status={{ intent: STATUS_INTENT[event.status], label: event.status }}
              />
            ))}
          </div>
        </>
      )}

      <PageFoot
        status={`Append-only · PII-safe · ${isMulti ? `${actor.clinicIds.length} clinics` : 'clinic-scoped'}`}
      />
    </PageShell>
  )
}

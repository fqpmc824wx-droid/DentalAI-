import Link from 'next/link'
import { requireSession } from '@/lib/access'
import { getClinic } from '@/lib/mock/clinics'
import { ROLE_LABELS } from '@/lib/constants'
import { getQueueItemsForClinics, getQueueCountsForClinics } from '@/lib/queue/store'
import { runQueueOwnershipSweep } from '@/lib/queue/ownership-service'
import { buildHandoverBriefing } from '@/lib/queue/shift-summary'
import ShiftHandoverPanel from '@/components/queue/ShiftHandoverPanel'
import { getAuditEvents } from '@/lib/audit/store'
import { isTerminalQueueStatus, type QueueItem, type QueueItemType } from '@/lib/queue/types'
import type { AuditEvent } from '@/lib/audit/types'
import {
  PageShell,
  PageHeader,
  SectionH,
  SectionCard,
  QueueRow,
  EmptyState,
  GlyphCalm,
  PageFoot,
  StatusPill,
  ConfidenceBar,
  type PillIntent,
} from '@/components/calm'

// ── Display helpers ──────────────────────────────────────────────────────

const TIME_LABELS: Record<string, { greet: string }> = {
  morning:   { greet: 'Morning' },
  afternoon: { greet: 'Afternoon' },
  evening:   { greet: 'Evening' },
  night:     { greet: 'Hi' },
}

function timeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours()
  if (h < 5)  return 'night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  if (h < 22) return 'evening'
  return 'night'
}

function formatDateLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatRowClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function relTime(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 60 / 24)}d ago`
}

const TYPE_LABEL: Record<QueueItemType, string> = {
  booking_request:  'Booking',
  emergency:        'Emergency',
  callback:         'Callback',
  identity_review:  'Identity',
  payment_recovery: 'Payment',
  fta_followup:     'FTA',
  recall:           'Recall',
  cancellation:     'Cancellation',
  running_late:     'Running late',
  complaint:        'Complaint',
}

const TYPE_INTENT: Record<QueueItemType, PillIntent> = {
  booking_request:  'ai',
  emergency:        'urgent',
  callback:         'info',
  identity_review:  'review',
  payment_recovery: 'review',
  fta_followup:     'review',
  recall:           'neutral',
  cancellation:     'neutral',
  running_late:     'review',
  complaint:        'review',
}

function statusBadge(item: QueueItem): { intent: PillIntent; label: string } {
  if (item.priority === 'urgent')     return { intent: 'urgent', label: 'Your call' }
  if (item.type === 'emergency')      return { intent: 'urgent', label: 'Emergency' }
  if (item.ruleDecision === 'allow')  return { intent: 'ai',     label: 'Nod to approve' }
  if (item.ruleDecision === 'review') return { intent: 'review', label: 'Review' }
  if (item.ruleDecision === 'block')  return { intent: 'block',  label: 'Blocked' }
  return { intent: 'info', label: 'Open' }
}

function actionLabel(evt: AuditEvent): string {
  switch (evt.action) {
    case 'booking.request_approved':         return 'approved a request'
    case 'booking.request_rejected':         return 'rejected a request'
    case 'booking.request_modified':         return 'modified and approved a request'
    case 'queue.task_acknowledged':          return 'acknowledged a task'
    case 'queue.task_resolved':              return 'resolved a task'
    case 'queue.task_escalated':             return 'escalated a task'
    case 'queue.emergency_outcome_recorded': return 'recorded an emergency outcome'
    case 'queue.task_callback_attempted':    return 'made a callback'
    case 'queue.task_unable_to_reach':       return 'tried to reach the patient'
    case 'auth.login':                       return 'signed in'
    case 'auth.logout':                      return 'signed out'
    case 'auth.mfa_verified':                return 'passed MFA verification'
    case 'auth.mfa_failed':                  return 'failed MFA verification'
    case 'auth.mfa_required':                return 'needs MFA verification'
    case 'access.denied':                    return 'attempted a blocked action'
    case 'access.reason_logged':             return 'documented cross-estate access'
    default: return evt.action
  }
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const actor = await requireSession()
  const firstName = actor.name.split(' ')[0]
  const clinic = getClinic(actor.clinicId)
  const isMultiClinic = actor.clinicIds.length > 1

  runQueueOwnershipSweep(actor.clinicIds)
  const allItems = getQueueItemsForClinics(actor.clinicIds)
  const handover = buildHandoverBriefing({ items: allItems })
  const counts = getQueueCountsForClinics(actor.clinicIds)
  const recentAudit = getAuditEvents({ clinicIds: actor.clinicIds, limit: 12 })

  const urgent = allItems.find(i => i.priority === 'urgent' && i.status === 'pending')
  const queueRows = allItems
    .filter(i => i.status === 'pending' && i.id !== urgent?.id)
    .slice(0, 5)
  const doneItems = allItems
    .filter(i => isTerminalQueueStatus(i.status))
    .sort((a, b) => new Date(b.resolvedAt ?? b.createdAt).getTime() - new Date(a.resolvedAt ?? a.createdAt).getTime())
    .slice(0, 6)

  // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
  const now = Date.now()
  const clockNow = new Date()
  const tod = timeOfDay()
  const todayApproved = recentAudit.filter(e =>
    e.action === 'booking.request_approved' &&
    new Date(e.timestamp).toDateString() === new Date().toDateString()
  ).length
  const todayHandled = recentAudit.filter(e =>
    ['queue.task_resolved', 'queue.task_callback_attempted', 'queue.emergency_outcome_recorded',
     'booking.request_approved', 'booking.request_rejected'].includes(e.action) &&
    new Date(e.timestamp).toDateString() === new Date().toDateString()
  ).length

  const clinicLabel = isMultiClinic ? `${actor.clinicIds.length} clinics` : (clinic?.name ?? '—')

  return (
    <PageShell>
      <div style={{ marginBottom: 20 }}>
        <ShiftHandoverPanel briefing={handover} />
      </div>

      <PageHeader
        meta={<>{formatDateLabel()} · {formatClock(clockNow)} · {clinicLabel}</>}
        title={
          <>
            {TIME_LABELS[tod].greet}, {firstName}.{' '}
            {urgent
              ? <em>One thing can&rsquo;t wait.</em>
              : counts.pending > 0
                ? <em>{counts.pending} {counts.pending === 1 ? 'thing waits' : 'things wait'} for you.</em>
                : <em>All clear.</em>}
          </>
        }
        sub={
          <>
            I&rsquo;ve prepared <strong>{counts.pending} {counts.pending === 1 ? 'task' : 'tasks'}</strong> for your review.
            {' '}<strong>{todayHandled}</strong> handled today already
            {todayApproved > 0 && <> &mdash; {todayApproved} approved by you</>}.
            {' '}I haven&rsquo;t written anything to Dentally without your say-so.
          </>
        }
      />

      {urgent && <FocusCard item={urgent} />}

      {queueRows.length > 0 && (
        <>
          <SectionH label="Your queue" meta={`${queueRows.length} ${queueRows.length === 1 ? 'item' : 'items'}`} />
          <div>
            {queueRows.map(item => (
              <QueueRow
                key={item.id}
                href={`/queue/${item.id}`}
                time={formatRowClock(item.createdAt)}
                typeLabel={TYPE_LABEL[item.type]}
                typeIntent={TYPE_INTENT[item.type]}
                title={item.title}
                summary={item.summary}
                reason={item.ruleReasons?.[0]}
                confidence={item.confidence}
                status={statusBadge(item)}
              />
            ))}
          </div>
        </>
      )}

      {!urgent && queueRows.length === 0 && (
        <div style={{ marginTop: 32 }}>
          <EmptyState
            glyph={<GlyphCalm />}
            title="Nothing waiting on you."
            message="Beautiful. Take a breath."
          />
        </div>
      )}

      {doneItems.length > 0 && (
        <>
          <SectionH label="Done today" meta={`${doneItems.length}`} />
          <div className="feed">
            {doneItems.map(item => (
              <div key={item.id} className="feed-item">
                <span className="when">{formatRowClock(item.resolvedAt ?? item.createdAt)}</span>
                <span className="what">
                  {item.status === 'approved' && <em>Approved </em>}
                  {item.status === 'rejected' && <em>Rejected </em>}
                  {item.status === 'resolved' && <em>Resolved </em>}
                  {TYPE_LABEL[item.type]?.toLowerCase() ?? item.type} &mdash; {item.title.toLowerCase()}
                </span>
                <span className="by">{item.resolvedBy ? 'You' : 'Me'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {recentAudit.length > 0 && (
        <>
          <SectionH
            label="Activity"
            meta={<Link href="/audit" style={{ textDecoration: 'underline' }}>Full audit →</Link>}
          />
          <div className="feed">
            {recentAudit.slice(0, 5).map(evt => (
              <div key={evt.id} className="feed-item">
                <span className="when">{relTime(evt.timestamp, now)}</span>
                <span className="what">
                  <em>{evt.actor.name}</em> {actionLabel(evt)}
                </span>
                <span className="by">{evt.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionH label="The scoreboard" meta={ROLE_LABELS[actor.role]} />
      <div className="glance">
        <div className="g">
          <div className="n">{todayHandled}</div>
          <div className="l">Done today</div>
        </div>
        <div className="g">
          <div className="n">{counts.pending}</div>
          <div className="l">Your call</div>
        </div>
        <div className={`g ${counts.urgent > 0 ? 'warn' : ''}`}>
          <div className="n">{counts.urgent}</div>
          <div className="l">On fire</div>
        </div>
        <div className="g ok">
          <div className="n">{counts.resolved}</div>
          <div className="l">Resolved</div>
        </div>
      </div>

      <p className="context-line">
        Nothing slipped through the cracks today. I haven&rsquo;t touched Dentally without your say-so. Not now, not ever.
      </p>

      <PageFoot
        status={`${isMultiClinic ? `All ${actor.clinicIds.length} clinics calm` : `${clinic?.name ?? 'Clinic'} calm`} · demo data · saved locally`}
        rightLink={{ href: '/queue', label: 'Open the queue →' }}
      />
    </PageShell>
  )
}

// ── Focus card (the hero ask) ───────────────────────────────────────────

function FocusCard({ item }: { item: QueueItem }) {
  const isEmergency = item.type === 'emergency'
  return (
    <SectionCard
      tone="default"
      accent={isEmergency ? 'urgent' : 'primary'}
    >
      <div style={{ marginBottom: 14 }}>
        <StatusPill intent={isEmergency ? 'urgent' : 'ai'} size="sm" dot>
          {isEmergency ? "Can't wait · Emergency" : "Can't wait · Urgent"}
        </StatusPill>
      </div>

      <h2 style={{
        fontFamily: 'var(--font-serif)',
        fontWeight: 400,
        fontSize: 26,
        letterSpacing: '0',
        lineHeight: 1.2,
        margin: '0 0 16px',
        color: 'var(--ink)',
        textWrap: 'pretty',
      }}>
        {item.title}
      </h2>

      {item.summary && (
        <p style={{
          fontStyle: 'italic',
          fontSize: 17,
          color: 'var(--ink-2)',
          borderLeft: '2px solid var(--primary-soft)',
          paddingLeft: 16,
          margin: '0 0 18px',
          lineHeight: 1.5,
        }}>
          &ldquo;{item.summary}&rdquo;
        </p>
      )}

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px 22px',
        paddingTop: 16,
        borderTop: '1px solid var(--line)',
        marginBottom: 18,
        alignItems: 'flex-end',
      }}>
        <Meta label="Caller" value={item.callerPhone} mono />
        <Meta label="Identity" value={item.callerState.replace(/_/g, ' ')} />
        {item.patientId && <Meta label="Patient" value={item.patientId} mono />}
        <div style={{ marginLeft: 'auto', minWidth: 180 }}>
          <ConfidenceBar value={item.confidence} />
        </div>
      </div>

      <div style={{
        padding: '14px 16px',
        background: 'var(--primary-tint)',
        borderRadius: 10,
        fontSize: 14,
        color: 'var(--ink-2)',
        lineHeight: 1.55,
        marginBottom: 16,
      }}>
        <span className="ai-sign" style={{ marginRight: 6 }}>
          <span className="pulse" /> I prepared
        </span>
        {item.ruleReasons?.[0] ?? 'A booking request is ready for your review.'}
        {' '}<strong style={{ color: 'var(--primary)' }}>I haven&rsquo;t done anything yet.</strong> Over to you.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href={`/queue/${item.id}`} className="btn primary">Open this →</Link>
        <Link href="/queue" className="btn ghost">See the queue</Link>
      </div>
    </SectionCard>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--muted)',
        marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontSize: 14,
        color: 'var(--ink)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      }}>{value}</div>
    </div>
  )
}

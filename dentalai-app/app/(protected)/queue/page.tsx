import { requireSession } from '@/lib/access'
import { getQueueItemsForClinics, getQueueCountsForClinics } from '@/lib/queue/store'
import { isTerminalQueueStatus, type QueueItem, type QueueItemType } from '@/lib/queue/types'
import {
  PageShell,
  PageHeader,
  QueueRow,
  FilterPills,
  EmptyState,
  GlyphCalm,
  GlyphInbox,
  PageFoot,
  type PillIntent,
} from '@/components/calm'

function formatRowClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
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
  if (item.status === 'approved')     return { intent: 'allow',  label: 'Approved' }
  if (item.status === 'rejected')     return { intent: 'block',  label: 'Rejected' }
  if (item.status === 'resolved')     return { intent: 'neutral', label: 'Resolved' }
  if (item.status === 'escalated')    return { intent: 'review', label: 'Escalated' }
  if (item.priority === 'urgent')     return { intent: 'urgent', label: 'Your call' }
  if (item.type === 'emergency')      return { intent: 'urgent', label: 'Emergency' }
  if (item.ruleDecision === 'allow')  return { intent: 'ai',     label: 'Nod to approve' }
  if (item.ruleDecision === 'review') return { intent: 'review', label: 'Review' }
  if (item.ruleDecision === 'block')  return { intent: 'block',  label: 'Blocked' }
  return { intent: 'info', label: 'Open' }
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const actor = await requireSession()
  const params = await searchParams
  const filter = params.filter ?? 'all'

  const allItems = getQueueItemsForClinics(actor.clinicIds)
  const counts = getQueueCountsForClinics(actor.clinicIds)

  const filtered =
    filter === 'urgent'   ? allItems.filter(i => i.priority === 'urgent' && i.status === 'pending') :
    filter === 'pending'  ? allItems.filter(i => i.status === 'pending') :
    filter === 'resolved' ? allItems.filter(i => isTerminalQueueStatus(i.status)) :
    allItems

  const filterOptions = [
    { id: 'all',      label: 'All',      count: allItems.length },
    { id: 'urgent',   label: 'Urgent',   count: counts.urgent },
    { id: 'pending',  label: 'Pending',  count: counts.pending },
    { id: 'resolved', label: 'Resolved', count: counts.resolved },
  ]

  return (
    <PageShell>
      <PageHeader
        title={<>The <em>queue</em>.</>}
        sub={
          counts.pending > 0
            ? `${counts.pending} pending · ${counts.urgent} urgent · open an item to review and act.`
            : 'Nothing pending right now. Open an item to see history.'
        }
      />

      <FilterPills
        options={filterOptions}
        activeId={filter}
        hrefFor={id => `/queue?filter=${id}`}
      />

      {filtered.length === 0 ? (
        <EmptyState
          glyph={filter === 'urgent' ? <GlyphCalm /> : <GlyphInbox />}
          title={
            filter === 'all'      ? 'Queue is empty' :
            filter === 'urgent'   ? 'No emergencies' :
            filter === 'pending'  ? 'Nothing pending' :
                                    'Nothing resolved yet today'
          }
          message={
            filter === 'urgent'
              ? 'Quiet on the urgent line. That’s the good kind of quiet.'
              : 'Nothing waiting on you.'
          }
        />
      ) : (
        <div>
          {filtered.map(item => (
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
              resolved={isTerminalQueueStatus(item.status)}
            />
          ))}
        </div>
      )}

      <PageFoot
        status="Demo data · saved to a local database · survives restart"
        rightLink={{ href: '/dashboard', label: '← Today' }}
      />
    </PageShell>
  )
}

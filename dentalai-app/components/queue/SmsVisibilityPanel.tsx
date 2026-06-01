'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SmsVisibilityPanel as PanelData } from '@/lib/queue/sms-visibility'
import { SectionCard, Banner } from '@/components/calm'

const STATE_LABELS: Record<string, string> = {
  sent: 'Sent',
  queued: 'Queued',
  failed: 'Failed',
  suppressed: 'Suppressed',
}

export default function SmsVisibilityPanel({
  panel,
  onRetry,
}: {
  panel: PanelData
  onRetry?: (smsId: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!panel.visible) return null

  function handleRetry(smsId: string) {
    if (!onRetry) return
    startTransition(async () => {
      const result = await onRetry(smsId)
      if (result.ok) router.refresh()
    })
  }

  return (
    <SectionCard label="SMS visibility">
      {panel.hasSuppression && (
        <Banner tone="warn">One or more SMS messages were suppressed — review before contacting the patient.</Banner>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: panel.hasSuppression ? 14 : 0 }}>
        {panel.records.map(record => (
          <div
            key={record.id}
            style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}
          >
            <p style={{ fontSize: 13, margin: '0 0 6px' }}>
              <strong>{STATE_LABELS[record.deliveryState] ?? record.deliveryState}</strong>
              {' · '}
              {record.kind === 'holding_sms' ? 'Holding SMS' : 'Staff follow-up'}
              {record.sentAt ? ` · ${record.sentAt}` : ''}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
              To: <span style={{ fontFamily: 'var(--font-mono)' }}>{record.recipient}</span>
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 6px', color: 'var(--ink-2)' }}>
              “{record.content}”
            </p>
            {record.suppressionReason && (
              <p style={{ fontSize: 13, color: 'var(--orange)', margin: '0 0 6px' }}>
                Suppression: {record.suppressionReason}
              </p>
            )}
            {record.failureReason && (
              <p style={{ fontSize: 13, color: 'var(--red)', margin: '0 0 6px' }}>
                Failure: {record.failureReason}
              </p>
            )}
            {record.canRetry && onRetry && (
              <button
                type="button"
                onClick={() => handleRetry(record.id)}
                disabled={isPending}
                className="btn"
              >
                Retry send
              </button>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PassToColleaguePanel } from '@/lib/queue/colleague-presence'
import type { QueueLockView } from '@/lib/queue/ownership'
import type { QueueItem } from '@/lib/queue/types'
import {
  softClaimQueueItem,
  passQueueItemToColleague,
  releaseQueueItem,
} from '@/lib/queue/actions'
import { SectionCard, Banner } from '@/components/calm'

export default function QueueOwnershipPanel({
  item,
  lockView,
  passPanel,
  readOnly,
}: {
  item: QueueItem
  lockView: QueueLockView
  passPanel: PassToColleaguePanel
  readOnly: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [passTarget, setPassTarget] = useState('')
  const [passReason, setPassReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.ok) router.refresh()
      else setError(result.error ?? 'Action failed')
    })
  }

  const showSoftClaim =
    lockView.uiState === 'unlocked' && !readOnly

  const showTimer =
    lockView.showInactiveTimer &&
    lockView.uiState === 'locked_by_self' &&
    typeof lockView.inactiveMinutesElapsed === 'number'

  return (
    <SectionCard label="Ownership">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lockView.inProgressLabel && (
          <Banner tone="info">{lockView.inProgressLabel}</Banner>
        )}

        {lockView.uiState === 'soft_claim_by_self' && (
          <p style={{ fontSize: 13, margin: 0, color: 'var(--ink-2)' }}>
            Soft-claimed — inactivity timer starts when you open this item.
          </p>
        )}

        {readOnly && lockView.uiState === 'locked_by_other' && (
          <Banner tone="warn">
            {lockView.assigneeName ?? 'Another staff member'} is working this item. View only until the lock releases.
          </Banner>
        )}

        {showTimer && (
          <p style={{ fontSize: 13, margin: 0, color: 'var(--orange)' }}>
            Active for {lockView.inactiveMinutesElapsed} min — lock releases after 10 minutes without activity.
          </p>
        )}

        {lockView.draftNotes && (
          <Banner tone="default">
            Draft notes preserved from a previous session: {lockView.draftNotes}
          </Banner>
        )}

        {showSoftClaim && (
          <button
            type="button"
            className="btn"
            disabled={isPending}
            onClick={() => run(() => softClaimQueueItem(item.id))}
          >
            I&apos;ll handle this
          </button>
        )}

        {lockView.uiState === 'locked_by_self' && !readOnly && (
          <button
            type="button"
            className="btn ghost"
            disabled={isPending}
            onClick={() => run(() => releaseQueueItem(item.id))}
          >
            Release lock
          </button>
        )}

        {passPanel.visible && !readOnly && (
          <div>
            <p className="field-label">Pass to colleague</p>
            <select
              className="cm-input"
              value={passTarget}
              onChange={e => setPassTarget(e.target.value)}
            >
              <option value="">Select colleague…</option>
              {passPanel.colleagues.map(c => (
                <option key={c.userId} value={c.userId} disabled={!c.canReceive}>
                  {c.name} — {c.statusLabel}
                  {c.currentItemTitle ? ` (${c.currentItemTitle})` : ''}
                </option>
              ))}
            </select>
            <textarea
              className="cm-textarea"
              rows={2}
              value={passReason}
              onChange={e => setPassReason(e.target.value)}
              placeholder={`Reason (min ${passPanel.minReasonLength} characters)…`}
              style={{ marginTop: 8 }}
            />
            <button
              type="button"
              className="btn"
              style={{ marginTop: 8 }}
              disabled={isPending || !passTarget}
              onClick={() =>
                run(() => passQueueItemToColleague(item.id, passTarget, passReason))
              }
            >
              Pass item
            </button>
          </div>
        )}

        {error && <Banner tone="warn">⚠ {error}</Banner>}
      </div>
    </SectionCard>
  )
}

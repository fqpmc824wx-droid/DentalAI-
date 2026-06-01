'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WorkingToolsPanel as PanelData } from '@/lib/queue/working-tools'
import type { QueueItem } from '@/lib/queue/types'
import type { SessionActor } from '@/lib/access-control'
import {
  claimQueueItem,
  releaseQueueItem,
  logCallbackAttempt,
  saveQueueWorkingNotes,
} from '@/lib/queue/actions'
import { evaluateCloseEligibility } from '@/lib/queue/close-rule'
import { SectionCard, Banner } from '@/components/calm'

function formatLockExpiry(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  }).format(date)
}

export default function WorkingToolsPanel({
  panel,
  item,
}: {
  panel: PanelData
  item: QueueItem
  actor: SessionActor
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [scratchpad, setScratchpad] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem(panel.scratchpadStorageKey) ?? ''
    } catch {
      return ''
    }
  })
  const [notes, setNotes] = useState(item.notes ?? '')
  const [attemptOutcome, setAttemptOutcome] = useState('')
  const [outcome, setOutcome] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(panel.scratchpadStorageKey, scratchpad)
    } catch {
      /* localStorage unavailable */
    }
  }, [scratchpad, panel.scratchpadStorageKey])

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setActionError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        router.refresh()
      } else {
        setActionError(result.error ?? 'Action failed')
      }
    })
  }

  function handleSaveNotes() {
    run(() => saveQueueWorkingNotes(item.id, notes))
    setSavedHint('Notes saved')
    setTimeout(() => setSavedHint(null), 2000)
  }

  function handleClaim() {
    run(() => claimQueueItem(item.id))
  }

  function handleRelease() {
    run(() => releaseQueueItem(item.id))
  }

  const closeCheck = evaluateCloseEligibility(item, { outcome, notes })

  function handleLogAttempt() {
    if (!attemptOutcome) {
      setActionError('Select an attempt outcome before logging')
      return
    }
    run(() => logCallbackAttempt(item.id, attemptOutcome, notes || undefined))
    setAttemptOutcome('')
  }

  function handlePatientCalledBack() {
    run(() => logCallbackAttempt(item.id, 'patient_called_back', notes || undefined))
  }

  const lockExpiry = formatLockExpiry(panel.lockExpiresAt)
  const sms = panel.holdingSms

  return (
    <SectionCard label="Working tools">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Scratchpad
          </div>
          <textarea
            value={scratchpad}
            onChange={e => setScratchpad(e.target.value)}
            placeholder="Autosaves locally while you work this item…"
            rows={3}
            className="cm-textarea"
          />
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>
            Autosaves on this device — not shared with other staff.
          </p>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Holding SMS
          </div>
          {sms.status === 'none' ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>No holding SMS for this item.</p>
          ) : (
            <>
              <p style={{ fontSize: 13, margin: '0 0 6px' }}>
                Status:{' '}
                <strong>{sms.status}</strong>
                {sms.sentAt ? ` · sent ${sms.sentAt}` : ''}
              </p>
              {sms.recipient && (
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
                  To: <span style={{ fontFamily: 'var(--font-mono)' }}>{sms.recipient}</span>
                </p>
              )}
              {sms.content && (
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 6px', color: 'var(--ink-2)' }}>
                  “{sms.content}”
                </p>
              )}
              {sms.suppressionReason && (
                <Banner tone="warn">{sms.suppressionReason}</Banner>
              )}
            </>
          )}
        </div>

        {(item.type === 'callback' || item.type === 'fta_followup' || item.type === 'recall') && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Callback tracker
            </div>
            <p style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--ink-2)' }}>
              Suggested time: {panel.suggestedCallbackTime}
              {!panel.withinCallbackWindow && (
                <span style={{ color: 'var(--warn)', marginLeft: 6 }}>(outside callback hours)</span>
              )}
            </p>
            {panel.callbackAttempts.length > 0 && (
              <ol style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                {panel.callbackAttempts.map((attempt) => (
                  <li key={attempt.id}>
                    {attempt.outcome.replace(/_/g, ' ')} — {attempt.byName}
                    {attempt.at ? ` · ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(attempt.at))}` : ''}
                  </li>
                ))}
              </ol>
            )}
            {panel.managerReviewRequired && (
              <Banner tone="warn">Three unsuccessful attempts — manager review required.</Banner>
            )}
            {panel.allowsUnableAfterThree && (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>
                Unable to reach after 3 attempts closure is now available.
              </p>
            )}
            <p className="field-label" style={{ marginTop: 12 }}>Log attempt outcome <span className="req">*</span></p>
            <select
              value={attemptOutcome}
              onChange={e => setAttemptOutcome(e.target.value)}
              className="cm-input"
            >
              <option value="">Select attempt outcome…</option>
              {panel.attemptOutcomes.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={handleLogAttempt} disabled={isPending || !attemptOutcome} className="btn primary">
                Log callback attempt
              </button>
            </div>
            {panel.managerReviewRequired && panel.fourthAttemptAllowed && (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>
                A fourth manual attempt remains available if manager approves.
              </p>
            )}
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Lock & assignee
          </div>
          {panel.lockState === 'unlocked' && (
            <>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px' }}>Unclaimed — use Ownership above or claim here.</p>
              <button type="button" onClick={handleClaim} disabled={isPending} className="btn">
                I&apos;ll handle this
              </button>
            </>
          )}
          {panel.lockState === 'locked_by_self' && (
            <>
              <p style={{ fontSize: 13, margin: '0 0 8px' }}>
                Locked by you{lockExpiry ? ` until ${lockExpiry}` : ''}
              </p>
              <button type="button" onClick={handleRelease} disabled={isPending} className="btn ghost">
                Release lock
              </button>
            </>
          )}
          {panel.lockState === 'locked_by_other' && (
            <Banner tone="warn">
              Locked by {panel.lockHeldByName}
              {lockExpiry ? ` until ${lockExpiry}` : ''} — coordinate before acting.
            </Banner>
          )}
        </div>

        {panel.requiredOutcome && (
          <div>
            <p className="field-label">Outcome {panel.showPatientCalledBack ? <span className="req">*</span> : null}</p>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              className="cm-input"
            >
              <option value="">Select outcome…</option>
              {panel.outcomeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <p className="field-label">Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Outcome notes visible in the audit trail…"
            rows={3}
            className="cm-textarea"
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <button type="button" onClick={handleSaveNotes} disabled={isPending} className="btn">
              Save notes
            </button>
            {savedHint && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{savedHint}</span>}
          </div>
        </div>

        {panel.showPatientCalledBack && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={handlePatientCalledBack}
              disabled={isPending}
              className="btn primary"
            >
              Patient called back
            </button>
          </div>
        )}

        {panel.requiredOutcome && !closeCheck.canClose && !closeCheck.immutable && (
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
            Close actions unlock once you select an outcome{closeCheck.requiresNotes ? ' and add required notes' : ''}.
          </p>
        )}

        {actionError && <Banner tone="warn">⚠ {actionError}</Banner>}

        <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          {panel.auditTrailHint}{' '}
          <Link href="/audit" style={{ color: 'var(--primary)' }}>View audit log</Link>
        </p>
      </div>
    </SectionCard>
  )
}

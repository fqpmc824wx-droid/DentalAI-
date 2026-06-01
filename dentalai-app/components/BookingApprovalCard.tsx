'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isTerminalQueueStatus, type QueueItem } from '@/lib/queue/types'
import type { AppointmentType } from '@/lib/rules/types'
import type { MockPatient } from '@/lib/mock/patients'
import type { SessionActor } from '@/lib/access-control'
import {
  approveQueueItem,
  rejectQueueItem,
  recordEmergencyOutcome,
  escalateQueueItem,
  recordCallbackAttempt,
  modifyAndApproveQueueItem,
} from '@/lib/queue/actions'
import { canRolePerformAction, isActionValidForType, isBookingApprovalBlockedByRules } from '@/lib/queue/permissions'
import {
  PageShell,
  PageHeader,
  SectionCard,
  Banner,
  Modal,
  ActionFooter,
  DataGrid,
  RuleDecisionPanel,
  PageFoot,
  type DataGridItem,
} from '@/components/calm'

const EMERGENCY_OUTCOMES = [
  { value: 'contacted',            label: 'Patient contacted & handled' },
  { value: 'unable_to_reach',      label: 'Unable to reach patient' },
  { value: 'transferred',          label: 'Transferred to clinical team' },
  { value: 'escalated_to_manager', label: 'Escalated to practice manager' },
  { value: 'false_positive',       label: 'False positive — no action needed' },
] as const

const APPT_OPTIONS = [
  { id: 'new_patient_consult',   label: 'New patient consultation' },
  { id: 'routine_checkup',       label: 'Routine checkup' },
  { id: 'hygiene',               label: 'Hygiene appointment' },
  { id: 'emergency',             label: 'Emergency slot' },
  { id: 'implant_consult',       label: 'Implant consultation' },
  { id: 'invisalign_consult',    label: 'Invisalign consultation' },
  { id: 'whitening_consult',     label: 'Whitening consultation' },
] as const

function formatRowClock(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  }).format(date)
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  }).formatToParts(date)

  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''

  return `${weekday} ${day} ${month}`.trim()
}

export default function BookingApprovalCard({
  item,
  apptType,
  patient,
  actor,
}: {
  item: QueueItem
  apptType: AppointmentType | null
  patient: MockPatient | null
  actor: SessionActor
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [showModifyModal, setShowModifyModal] = useState(false)
  const [emergencyOutcome, setEmergencyOutcome] = useState<string>('')
  const [emergencyNotes, setEmergencyNotes] = useState('')
  const [modifyType, setModifyType] = useState<string>(item.appointmentTypeId ?? 'routine_checkup')
  const [modifyNotes, setModifyNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const isResolved = isTerminalQueueStatus(item.status)
  const isEmergency = item.type === 'emergency'
  const isBookingRequest = item.type === 'booking_request'
  const isCallback = item.type === 'callback'

  const rulesBlockApproval = isBookingApprovalBlockedByRules(item.type, item.ruleDecision, 'approve_request')

  const canApprove         = canRolePerformAction(actor.role, 'approve_request')   && isActionValidForType(item.type, 'approve_request') && !rulesBlockApproval
  const canReject          = canRolePerformAction(actor.role, 'reject_request')    && isActionValidForType(item.type, 'reject_request')
  const canModify          = canRolePerformAction(actor.role, 'modify_request')    && isActionValidForType(item.type, 'modify_request') && !isBookingApprovalBlockedByRules(item.type, item.ruleDecision, 'modify_request')
  const canEscalate        = canRolePerformAction(actor.role, 'escalate')          && isActionValidForType(item.type, 'escalate')
  const canRecordEmergency = canRolePerformAction(actor.role, 'emergency_outcome') && isActionValidForType(item.type, 'emergency_outcome')

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setActionError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.ok) router.push('/queue')
      else setActionError(result.error ?? 'Action failed')
    })
  }

  function handleApprove()    { runAction(() => approveQueueItem(item.id)) }
  function handleReject()     { runAction(() => rejectQueueItem(item.id)) }
  function handleEscalate()   { runAction(() => escalateQueueItem(item.id, 'Escalated from detail view')) }
  function handleCallbackOk() { runAction(() => recordCallbackAttempt(item.id, 'reached')) }
  function handleCallbackNo() { runAction(() => recordCallbackAttempt(item.id, 'unable_to_reach')) }

  function handleEmergencySubmit() {
    if (!emergencyOutcome) { setActionError('Pick an outcome'); return }
    if (emergencyNotes.trim().length < 5) { setActionError('Add a few notes before submitting (5+ characters)'); return }
    runAction(() => recordEmergencyOutcome(item.id, emergencyOutcome, emergencyNotes))
  }

  function handleModifySubmit() {
    if (modifyNotes.trim().length === 0 && modifyType === item.appointmentTypeId) {
      setActionError('Change the appointment type or add a note explaining the modification')
      return
    }
    runAction(() => modifyAndApproveQueueItem(item.id, {
      appointmentTypeId: modifyType,
      notes: modifyNotes.trim() || undefined,
    }))
  }

  // Build DataGrid items
  const patientItems: DataGridItem[] = patient ? [
    { label: 'Name',      value: `${patient.firstName} ${patient.lastName}`, strong: true },
    { label: 'DOB',       value: patient.dob },
    { label: 'Phone',     value: patient.phone, mono: true },
    { label: 'Plan',      value: patient.isPrivate ? 'Private' : `NHS · ${patient.nhsNumber ?? '—'}` },
    { label: 'Balance',   value: patient.outstandingBalance > 0 ? `£${patient.outstandingBalance} owed` : '£0 — clean', tone: patient.outstandingBalance > 0 ? 'warn' : 'ok' },
    { label: 'Last seen', value: `${patient.lastAppointment ?? 'Never'}${patient.isLapsed ? ' · lapsed' : ''}`, tone: patient.isLapsed ? 'warn' : undefined },
  ] : []

  const apptItems: DataGridItem[] = apptType ? [
    { label: 'Type',     value: apptType.name, strong: true },
    { label: 'Duration', value: `${apptType.durationMins} min` },
    { label: 'Provider', value: apptType.requiresProvider },
    { label: 'NHS',      value: apptType.isNHSCompatible ? 'Compatible' : 'Private only' },
  ] : []

  const hasStickyActions = !isResolved && (
    (isBookingRequest && (canApprove || canReject || canEscalate)) ||
    (isEmergency && canRecordEmergency) ||
    isCallback
  )

  return (
    <PageShell hasStickyActions={hasStickyActions}>
      <Link href="/queue" style={{
        fontSize: 13, color: 'var(--muted)',
        display: 'inline-block', marginBottom: 18,
      }}>
        ← Back to queue
      </Link>

      <PageHeader
        meta={
          <>
            {isEmergency && <span style={{ color: 'var(--orange)', fontWeight: 600 }}>Emergency · </span>}
            {formatDateLabel(item.createdAt)} · {formatRowClock(item.createdAt)} · {item.callerPhone}
          </>
        }
        title={item.title}
      />

      {isResolved && (
        <div style={{ marginBottom: 20 }}>
          <Banner tone={
            item.status === 'approved' ? 'info' :
            item.status === 'rejected' ? 'danger' :
            'default'
          }>
            {item.status === 'approved' && '✓ Request approved — audit log records who approved and when.'}
            {item.status === 'rejected' && '✕ Request rejected — audit log records who rejected and when.'}
            {item.status === 'resolved' && '✓ Resolved — outcome logged.'}
          </Banner>
        </div>
      )}

      {isEmergency && !isResolved && (
        <div style={{ marginBottom: 20 }}>
          <Banner tone="warn">
            ⚠ Emergency — this item must be resolved with a recorded outcome. Generic close is blocked.
          </Banner>
        </div>
      )}

      {/* HIERARCHY:
          1. Rule decision (allow/review/block — the AI's call)
          2. Patient (who)
          3. Appointment (what)
          4. AI prepared summary (why)
          5. Actions (sticky on mobile)
      */}

      {item.ruleDecision && (
        <div style={{ marginBottom: 20 }}>
          <RuleDecisionPanel
            decision={item.ruleDecision}
            confidence={item.confidence}
            reasons={item.ruleReasons ?? []}
          />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <SectionCard label="Patient">
          {patient ? (
            <DataGrid items={patientItems} />
          ) : (
            <p style={{ fontSize: 14, color: 'var(--orange)', margin: 0 }}>
              ⚠ No matched patient · <span style={{ fontFamily: 'var(--font-mono)' }}>{item.callerPhone}</span> · capture details before booking.
            </p>
          )}
        </SectionCard>
      </div>

      {apptType && (
        <div style={{ marginBottom: 16 }}>
          <SectionCard label="Appointment">
            <DataGrid items={apptItems} />
          </SectionCard>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <SectionCard tone="tint" label={
          <span className="ai-sign" style={{ marginRight: 0 }}>
            <span className="pulse" /> I prepared
          </span>
        }>
          <p style={{
            fontSize: 15,
            color: 'var(--ink-2)',
            lineHeight: 1.6,
            margin: 0,
          }}>
            {item.summary}
          </p>
        </SectionCard>
      </div>

      {item.notes && (
        <div style={{ marginBottom: 20 }}>
          <SectionCard label="Outcome notes">
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--ink-2)',
              margin: 0,
              lineHeight: 1.6,
            }}>
              {item.notes}
            </p>
          </SectionCard>
        </div>
      )}

      {actionError && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn">⚠ {actionError}</Banner>
        </div>
      )}

      {!isResolved && isBookingRequest && rulesBlockApproval && (
        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 16 }}>
          Rules engine blocked approval on this request. You can reject or escalate — approve and modify are disabled.
        </p>
      )}

      {!isResolved && hasStickyActions && (
        <ActionFooter
          label="Over to you"
          helper={isBookingRequest ? 'Approval is logged · audit trail captures who approved and when.' : undefined}
        >
          {isEmergency && canRecordEmergency && (
            <>
              <button onClick={() => setShowEmergencyModal(true)} disabled={isPending} className="btn danger">
                Record emergency outcome
              </button>
              {canEscalate && (
                <button onClick={handleEscalate} disabled={isPending} className="btn ghost">
                  ↑ Escalate
                </button>
              )}
            </>
          )}

          {isBookingRequest && (
            <>
              {canApprove && (
                <button onClick={handleApprove} disabled={isPending} className="btn primary">
                  Approve request <span className="kbd">↵</span>
                </button>
              )}
              {canModify && (
                <button onClick={() => setShowModifyModal(true)} disabled={isPending} className="btn">
                  Modify & approve
                </button>
              )}
              {canReject && (
                <button onClick={handleReject} disabled={isPending} className="btn">
                  Reject
                </button>
              )}
              {canEscalate && (
                <button onClick={handleEscalate} disabled={isPending} className="btn ghost">
                  ↑ Escalate
                </button>
              )}
            </>
          )}

          {isCallback && (
            <>
              <button onClick={handleCallbackOk} disabled={isPending} className="btn primary">
                ✓ Patient reached
              </button>
              <button onClick={handleCallbackNo} disabled={isPending} className="btn">
                Unable to reach
              </button>
              {canEscalate && (
                <button onClick={handleEscalate} disabled={isPending} className="btn ghost">
                  ↑ Escalate
                </button>
              )}
            </>
          )}
        </ActionFooter>
      )}

      <PageFoot
        status={<>Item <span style={{ fontFamily: 'var(--font-mono)' }}>{item.id}</span> · {item.clinicId} · audit-logged</>}
        rightLink={{ href: '/queue', label: '← Back to queue' }}
      />

      {/* Emergency outcome modal */}
      <Modal
        open={showEmergencyModal}
        onClose={() => { setShowEmergencyModal(false); setActionError(null) }}
        title="Record emergency outcome"
        subtitle="Mandatory. The outcome and your notes are logged in the audit trail."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="field-label">Outcome</p>
          {EMERGENCY_OUTCOMES.map(opt => (
            <label key={opt.value} className={`cm-radio${emergencyOutcome === opt.value ? ' checked' : ''}`}>
              <input
                type="radio"
                name="emergency-outcome"
                value={opt.value}
                checked={emergencyOutcome === opt.value}
                onChange={() => setEmergencyOutcome(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div>
          <p className="field-label">Notes <span className="req">*</span></p>
          <textarea
            value={emergencyNotes}
            onChange={e => setEmergencyNotes(e.target.value)}
            placeholder="What happened? What action was taken?"
            rows={3}
            className="cm-textarea"
          />
        </div>

        {actionError && <Banner tone="warn">⚠ {actionError}</Banner>}

        <div className="actions">
          <button onClick={handleEmergencySubmit} disabled={isPending} className="btn danger">
            {isPending ? 'Saving…' : 'Submit outcome'}
          </button>
          <button onClick={() => { setShowEmergencyModal(false); setActionError(null) }} disabled={isPending} className="btn">
            Cancel
          </button>
        </div>
      </Modal>

      {/* Modify & approve modal */}
      <Modal
        open={showModifyModal}
        onClose={() => { setShowModifyModal(false); setActionError(null) }}
        title="Modify and approve"
        subtitle="Change the appointment type or add a note. The change and your approval are logged together."
      >
        <div>
          <p className="field-label">Appointment type</p>
          <select
            value={modifyType}
            onChange={e => setModifyType(e.target.value)}
            className="cm-input"
          >
            {APPT_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="field-label">Note <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></p>
          <textarea
            value={modifyNotes}
            onChange={e => setModifyNotes(e.target.value)}
            placeholder="Why are you modifying this?"
            rows={3}
            className="cm-textarea"
          />
        </div>

        {actionError && <Banner tone="warn">⚠ {actionError}</Banner>}

        <div className="actions">
          <button onClick={handleModifySubmit} disabled={isPending} className="btn primary">
            {isPending ? 'Saving…' : 'Modify & approve'}
          </button>
          <button onClick={() => { setShowModifyModal(false); setActionError(null) }} disabled={isPending} className="btn">
            Cancel
          </button>
        </div>
      </Modal>
    </PageShell>
  )
}

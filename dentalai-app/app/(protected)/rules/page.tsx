import { requireSession } from '@/lib/access'
import { APPOINTMENT_TYPES, getClinicRules } from '@/lib/rules/config'
import { evaluateBookingRequest } from '@/lib/rules/engine'
import { lookupCallerByPhone } from '@/lib/mock/patients'
import {
  PageShell,
  PageHeader,
  SectionH,
  SectionCard,
  StatusPill,
  RuleDecisionPanel,
  PageFoot,
} from '@/components/calm'

const SCENARIOS = [
  { label: 'Healthy patient · routine checkup',  callerPhone: '07700900001', apptType: 'routine_checkup' as const },
  { label: 'FTA patient · hygiene booking',       callerPhone: '07700900002', apptType: 'hygiene' as const },
  { label: 'Lapsed patient · routine checkup',    callerPhone: '07700900005', apptType: 'routine_checkup' as const },
  { label: 'NHS patient · implant consult',       callerPhone: '07700900001', apptType: 'implant_consult' as const },
  { label: 'Withheld caller · any booking',       callerPhone: 'withheld',    apptType: 'routine_checkup' as const },
  { label: 'Family number caller',                callerPhone: '02071234567', apptType: 'hygiene' as const },
  { label: 'Unknown caller · new patient',        callerPhone: '07999999999', apptType: 'new_patient_consult' as const },
  { label: 'FTA + outstanding balance',           callerPhone: '07700900002', apptType: 'routine_checkup' as const },
]

export default async function RulesPage() {
  const actor = await requireSession()
  const clinicId = actor.clinicId
  const rules = getClinicRules(clinicId)

  const activeRules: [string, boolean | number | undefined][] = [
    ['Block on unpaid balance',     rules?.blockOnUnpaidBalance],
    ['Block on repeated FTA',       rules?.blockOnRepeatedFTA],
    ['Block lapsed → routine',      rules?.blockOnLapsedNeedsFullAssessment],
    ['Review uncertain identity',   rules?.reviewOnUncertainIdentity],
    ['Review complex treatment',    rules?.reviewOnComplexTreatment],
    ['Review first NHS booking',    rules?.reviewOnFirstNHSBooking],
    ['Emergency cap / provider',    rules?.emergencyDailyCapPerProvider],
    ['Out-of-hours emergency',      rules?.outOfHoursAcceptsEmergency],
  ]

  return (
    <PageShell wide>
      <PageHeader
        title={<>Booking <em>rules</em>.</>}
        sub="Pure decision logic — allow, review, or block. Per-clinic configuration."
      />

      <SectionCard label={`Active rules · ${clinicId}`}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 10,
        }}>
          {activeRules.map(([label, value]) => (
            <div key={label} style={{
              padding: '10px 14px',
              background: 'var(--surface-2)',
              borderRadius: 8,
              border: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
            }}>
              <span style={{ color: 'var(--ink-2)' }}>{label}</span>
              <span style={{
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: typeof value === 'boolean'
                  ? (value ? 'var(--green)' : 'var(--muted)')
                  : 'var(--blue)',
              }}>
                {typeof value === 'boolean' ? (value ? 'ON' : 'OFF') : String(value)}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionH label="Live evaluation" meta={`${SCENARIOS.length} scenarios`} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SCENARIOS.map((scenario, idx) => {
          const lookup = lookupCallerByPhone(scenario.callerPhone)
          const patient = lookup.matches.length === 1 ? lookup.matches[0] : null
          const evaluation = evaluateBookingRequest(
            { callerState: lookup.state, patient, appointmentTypeId: scenario.apptType },
            clinicId,
          )

          return (
            <div key={idx}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--muted)',
                }}>
                  {scenario.callerPhone === 'withheld' ? '(withheld)' : scenario.callerPhone}
                </span>
                <h3 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 17,
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--ink)',
                }}>
                  {scenario.label}
                </h3>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {evaluation.appointmentType?.name}
                  {patient && ` · ${patient.firstName} ${patient.lastName}`}
                </span>
              </div>
              <RuleDecisionPanel
                decision={evaluation.decision}
                confidence={
                  evaluation.decision === 'allow' ? 95 :
                  evaluation.decision === 'review' ? 70 :
                  40
                }
                reasons={evaluation.reasons}
                triggered={evaluation.triggered}
              />
            </div>
          )
        })}
      </div>

      <SectionH label="Appointment types" meta={`${APPOINTMENT_TYPES.length} configured`} />

      <SectionCard>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {APPOINTMENT_TYPES.map(t => (
            <div key={t.id} style={{
              padding: 14,
              background: 'var(--surface-2)',
              borderRadius: 8,
              border: '1px solid var(--line)',
            }}>
              <p style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--ink)',
                marginBottom: 4,
              }}>
                {t.name}
              </p>
              <p style={{
                fontSize: 11,
                color: 'var(--faint)',
                fontFamily: 'var(--font-mono)',
                marginBottom: 8,
              }}>{t.id}</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <StatusPill intent="neutral" size="sm">{t.durationMins} min</StatusPill>
                <StatusPill intent="neutral" size="sm">{t.requiresProvider}</StatusPill>
                {t.isNHSCompatible && <StatusPill intent="info" size="sm">NHS OK</StatusPill>}
                {t.isPrivateOnly && <StatusPill intent="ai" size="sm">Private only</StatusPill>}
                {t.emergencySafe && <StatusPill intent="urgent" size="sm">Emergency</StatusPill>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <PageFoot status="Pure deterministic engine · no AI, no Dentally writes" />
    </PageShell>
  )
}

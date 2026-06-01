import { requireSession } from '@/lib/access'
import { lookupCallerByPhone, MOCK_PATIENTS } from '@/lib/mock/patients'
import type { CallerMatchState } from '@/lib/mock/patients'
import {
  PageShell,
  PageHeader,
  SectionH,
  SectionCard,
  StatusPill,
  ConfidenceBar,
  PageFoot,
  type PillIntent,
} from '@/components/calm'

const TEST_SCENARIOS = [
  { label: 'Single confirmed match',  phone: '07700900006', description: 'Clean patient, no flags' },
  { label: 'Confirmed · flagged',     phone: '07700900002', description: 'Confirmed but has FTA + balance — requires review' },
  { label: 'Shared family landline',  phone: '02071234567', description: 'Two family members share this number' },
  { label: 'Cross-clinic ambiguity',  phone: '07700900001', description: 'Same number exists in two clinics — uncertain' },
  { label: 'No match in system',      phone: '07999999999', description: 'New patient or unregistered number' },
  { label: 'Withheld number',         phone: 'withheld',    description: 'Caller chose to withhold their number' },
  { label: 'Lapsed patient',          phone: '07700900005', description: '18+ months since last visit — needs full assessment' },
]

const STATE_INTENT: Record<CallerMatchState, PillIntent> = {
  confirmed:     'allow',
  multiple:      'review',
  family_number: 'info',
  uncertain:     'review',
  no_match:      'block',
  withheld:      'urgent',
}

export default async function IdentityPage() {
  const actor = await requireSession()

  return (
    <PageShell>
      <PageHeader
        title={<>Caller <em>identity</em>.</>}
        sub="How the system classifies incoming callers before any patient data is revealed. Admin reference."
      />

      <div>
        {TEST_SCENARIOS.map(scenario => {
          const result = lookupCallerByPhone(scenario.phone)
          const intent = STATE_INTENT[result.state] ?? 'neutral'

          return (
            <div key={scenario.phone} className="cm-qrow" style={{ cursor: 'default' }}>
              <div className="col-time">
                {scenario.phone === 'withheld' ? '(withheld)' : scenario.phone}
              </div>
              <div className="col-type">
                <StatusPill intent={intent} size="sm">
                  {result.state.replace(/_/g, ' ')}
                </StatusPill>
              </div>
              <div className="col-main">
                <h3>{scenario.label}</h3>
                <p className="summary">{result.reason}</p>
                {result.matches.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.matches.map(p => (
                      <div key={p.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--ink-2)',
                      }}>
                        <span>{p.id}</span>
                        <span style={{ display: 'flex', gap: 8, color: 'var(--muted)' }}>
                          {p.clinicId !== actor.clinicId && <span style={{ color: 'var(--orange)' }}>⚠ other clinic</span>}
                          {p.isFTA && <span style={{ color: 'var(--orange)' }}>FTA</span>}
                          {p.isLapsed && <span style={{ color: 'var(--purple)' }}>lapsed</span>}
                          {p.outstandingBalance > 0 && <span style={{ color: 'var(--red)' }}>£{p.outstandingBalance}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {result.requiresHumanReview && (
                  <p style={{
                    fontSize: 12,
                    color: 'var(--orange)',
                    marginTop: 8,
                    fontFamily: 'var(--font-mono)',
                    fontStyle: 'italic',
                  }}>
                    Human review required
                  </p>
                )}
              </div>
              <div className="col-confidence">
                <ConfidenceBar value={result.confidence} inline label="Match" />
              </div>
              <div className="col-status">
                <StatusPill intent={intent}>
                  {result.state.replace(/_/g, ' ')}
                </StatusPill>
              </div>
            </div>
          )
        })}
      </div>

      <SectionH label="Patient reference" meta={`${MOCK_PATIENTS.length} records · admin only`} />

      <SectionCard>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--muted)',
          display: 'grid',
          gridTemplateColumns: '90px 130px 80px 1fr',
          gap: 16,
          paddingBottom: 10,
          borderBottom: '1px solid var(--line)',
          marginBottom: 10,
        }}>
          <span>ID</span>
          <span>Phone</span>
          <span>Clinic</span>
          <span style={{ textAlign: 'right' }}>Flags</span>
        </div>
        {MOCK_PATIENTS.map(p => (
          <div key={p.id} style={{
            display: 'grid',
            gridTemplateColumns: '90px 130px 80px 1fr',
            gap: 16,
            padding: '8px 0',
            borderBottom: '1px solid var(--line)',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-2)',
            alignItems: 'center',
          }}>
            <span>{p.id}</span>
            <span>{p.phone}</span>
            <span>{p.clinicId}</span>
            <span style={{
              color: 'var(--muted)',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
            }}>
              {p.isPrivate ? 'Private' : 'NHS'}
              {p.isFTA && <span style={{ color: 'var(--orange)' }}>· FTA</span>}
              {p.isLapsed && <span style={{ color: 'var(--purple)' }}>· lapsed</span>}
              {p.outstandingBalance > 0 && <span style={{ color: 'var(--red)' }}>· £{p.outstandingBalance}</span>}
            </span>
          </div>
        ))}
      </SectionCard>

      <PageFoot status="Pure lookup · no PII revealed unless identity is safe" />
    </PageShell>
  )
}

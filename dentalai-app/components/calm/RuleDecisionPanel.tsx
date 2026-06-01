import type { ReactNode } from 'react'
import { StatusPill, decisionIntent } from './StatusPill'
import { ConfidenceBar } from './ConfidenceBar'

/**
 * RuleDecisionPanel — unified rules-engine output display.
 *
 * Shows decision label + confidence bar + reasons (with decision-tinted
 * left rail) + triggered rule codes.
 *
 * <RuleDecisionPanel
 *   decision="review"
 *   confidence={72}
 *   reasons={[
 *     'Patient has outstanding balance of £85 — flag before booking',
 *     'Same number across two clinics — verify identity',
 *   ]}
 *   triggered={['BALANCE_OUTSTANDING', 'IDENTITY_UNCERTAIN']}
 * />
 */
export function RuleDecisionPanel({
  decision,
  confidence,
  reasons,
  triggered,
  label = 'Rules engine',
}: {
  decision: 'allow' | 'review' | 'block'
  confidence: number
  reasons: ReactNode[]
  triggered?: string[]
  label?: string
}) {
  const cls = ['cm-decision', decision]
  return (
    <div className={cls.join(' ')}>
      <div className="head">
        <span className="label">{label}</span>
        <StatusPill intent={decisionIntent(decision)}>{decision}</StatusPill>
        <div className="confidence-wrap">
          <ConfidenceBar value={confidence} />
        </div>
      </div>

      <div className="reasons">
        {reasons.map((r, i) => (
          <div key={i} className="reason">{r}</div>
        ))}
      </div>

      {triggered && triggered.length > 0 && (
        <div className="triggered">
          {triggered.map(t => (
            <span key={t} className="trig">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

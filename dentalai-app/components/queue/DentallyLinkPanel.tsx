'use client'

import type { DentallyLinkPanel as PanelData } from '@/lib/queue/dentally-link-panel'
import { SectionCard, Banner } from '@/components/calm'

export default function DentallyLinkPanel({ panel }: { panel: PanelData }) {
  if (!panel.visible) return null

  const hasQualityWarning = panel.recordQualityIssues.length > 0
  const action = panel.primaryAction

  return (
    <SectionCard label="Dentally & data quality">
      {panel.integrationNote && (
        <Banner tone="warn">{panel.integrationNote}</Banner>
      )}

      {hasQualityWarning && (
        <div style={{ marginTop: panel.integrationNote ? 14 : 0 }}>
          <Banner tone="warn">
            Record quality warning — review before acting on this item.
          </Banner>
        </div>
      )}

      <div style={{ marginTop: hasQualityWarning || panel.integrationNote ? 14 : 0 }}>
        {action?.kind === 'open_record' && (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn primary"
            style={{ display: 'inline-block', marginBottom: 12, textDecoration: 'none' }}
          >
            {action.label} ↗
          </a>
        )}

        {action?.kind === 'create_record' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {action.reason}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              Create the patient in Dentally, then return here to continue.
            </p>
          </>
        )}

        {panel.contract && (
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
            {panel.contract.upcomingAppointmentCount > 0 && (
              <li>{panel.contract.upcomingAppointmentCount} upcoming appointment(s)</li>
            )}
            {panel.contract.unbookedTreatmentCount > 0 && (
              <li>{panel.contract.unbookedTreatmentCount} unbooked treatment slot(s)</li>
            )}
            {panel.contract.hasOutstandingBalance && <li>Outstanding balance on account</li>}
            {panel.contract.warnings.map(w => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {panel.recordQualityIssues.length > 0 && (
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
            {panel.recordQualityIssues.map(issue => (
              <li key={issue.code} style={{ marginBottom: 6 }}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}

        {panel.recordQualityIssues.length === 0 && panel.linkState === 'linked' && (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            No record quality issues detected from available context.
          </p>
        )}
      </div>
    </SectionCard>
  )
}

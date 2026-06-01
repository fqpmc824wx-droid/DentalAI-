import type { HandoverBriefing } from '@/lib/queue/shift-summary'
import { Banner, SectionCard } from '@/components/calm'

export default function ShiftHandoverPanel({ briefing }: { briefing: HandoverBriefing }) {
  if (briefing.openItems === 0) return null

  return (
    <SectionCard label="Handover briefing">
      <Banner tone={briefing.highOrCritical > 0 ? 'warn' : 'info'}>
        {briefing.banner}
      </Banner>
      <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
        <li>{briefing.openItems} open items in your clinics</li>
        <li>{briefing.highOrCritical} high or critical</li>
        <li>{briefing.overnightCount} carried over (&gt;12h)</li>
        <li>{briefing.callbackCount} callbacks / follow-ups</li>
      </ul>
      {briefing.carriedOverTitles.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 0' }}>
          Priority: {briefing.carriedOverTitles.join(' · ')}
        </p>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
        Team handover view — helps the next shift pick up work, not individual performance tracking.
      </p>
    </SectionCard>
  )
}

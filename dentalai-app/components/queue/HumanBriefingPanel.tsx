'use client'

import { useState } from 'react'
import type { HumanBriefingPanel as BriefingData } from '@/lib/queue/briefing'
import { SectionCard, Banner } from '@/components/calm'

function CollapseSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

export default function HumanBriefingPanel({ briefing }: { briefing: BriefingData }) {
  return (
    <SectionCard label="Human briefing">
      {briefing.toneWarning !== 'none' && briefing.toneMessage && (
        <Banner tone="warn">{briefing.toneMessage}</Banner>
      )}

      <div style={{ marginTop: briefing.toneWarning !== 'none' ? 14 : 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Suggested opening script
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, color: 'var(--text)' }}>
          {briefing.suggestedOpeningScript}
        </p>
        {briefing.scriptEditableByClinic && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>
            Clinic managers can customise this script in clinic settings (coming in a later slice).
          </p>
        )}
      </div>

      <CollapseSection title="Contact history" defaultOpen={!briefing.defaultCollapsed}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
          {briefing.contactHistory.map((entry, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--muted)' }}>{entry.channel}</span> — {entry.summary}
            </li>
          ))}
        </ul>
      </CollapseSection>

      <CollapseSection title="Call transcript" defaultOpen={false}>
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          {briefing.transcript.map((line, i) => (
            <p key={i} style={{ margin: '0 0 8px' }}>
              <strong style={{ textTransform: 'capitalize' }}>{line.speaker}</strong>: {line.text}
            </p>
          ))}
        </div>
      </CollapseSection>

      <CollapseSection title="AI call timeline" defaultOpen={false}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
          {briefing.aiTimeline.map((entry, i) => (
            <li key={i}>{entry.label}</li>
          ))}
        </ul>
      </CollapseSection>
    </SectionCard>
  )
}

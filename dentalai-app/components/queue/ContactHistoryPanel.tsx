'use client'

import { useState } from 'react'
import type { ContactHistoryPanel as PanelData } from '@/lib/queue/contact-history'
import { SectionCard } from '@/components/calm'

export default function ContactHistoryPanel({ panel }: { panel: PanelData }) {
  const [open, setOpen] = useState(!panel.collapsedByDefault)

  if (!panel.show) return null

  return (
    <SectionCard label="Contact history">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="btn ghost"
        style={{ marginBottom: open ? 12 : 0 }}
      >
        {open ? 'Collapse' : 'Expand'} patient context ({panel.entries.length} items)
      </button>
      {open && (
        <dl style={{ margin: 0, display: 'grid', gap: 10 }}>
          {panel.entries.map(entry => (
            <div key={entry.label}>
              <dt style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {entry.label}
              </dt>
              <dd style={{
                fontSize: 13,
                margin: '4px 0 0',
                color: entry.tone === 'warn' ? 'var(--warn)' : entry.tone === 'ok' ? 'var(--ok)' : 'var(--ink-2)',
              }}>
                {entry.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  )
}

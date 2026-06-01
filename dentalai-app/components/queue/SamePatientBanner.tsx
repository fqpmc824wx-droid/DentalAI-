'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SamePatientBanner as BannerData } from '@/lib/queue/same-patient-banner'
import { Banner } from '@/components/calm'

export default function SamePatientBanner({ banner }: { banner: BannerData }) {
  const [expanded, setExpanded] = useState(false)

  if (!banner.show) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <Banner tone="warn">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <strong>{banner.message}</strong>
              <p style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.45 }}>{banner.guidance}</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="btn ghost"
              style={{ flexShrink: 0 }}
            >
              {expanded ? 'Hide' : 'Show'} linked items ({banner.count})
            </button>
          </div>
          {expanded && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
              {banner.relatedItems.map(related => (
                <li key={related.id}>
                  <Link href={related.href} style={{ color: 'var(--primary)' }}>
                    {related.title}
                  </Link>
                  {' '}
                  <span style={{ color: 'var(--muted)' }}>
                    ({related.type.replace(/_/g, ' ')} · {related.status})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Banner>
    </div>
  )
}

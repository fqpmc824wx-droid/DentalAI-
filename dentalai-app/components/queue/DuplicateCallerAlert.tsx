'use client'

import type { DuplicateCallerAlert as AlertData } from '@/lib/queue/duplicate-caller'
import { Banner } from '@/components/calm'

export default function DuplicateCallerAlert({ alert }: { alert: AlertData }) {
  if (!alert.show) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <Banner tone={alert.managerAlertRequired ? 'danger' : 'warn'}>
        <strong>Duplicate caller</strong>
        <p style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.45 }}>{alert.message}</p>
        {alert.managerAlertRequired && (
          <p style={{ fontSize: 12, margin: '8px 0 0', fontWeight: 600 }}>
            Notify practice manager — three or more same-day calls.
          </p>
        )}
      </Banner>
    </div>
  )
}

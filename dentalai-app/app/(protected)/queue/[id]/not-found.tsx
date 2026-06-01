import Link from 'next/link'
import { PageShell, PageHeader, PageFoot } from '@/components/calm'

export default function QueueItemNotFound() {
  return (
    <PageShell>
      <Link href="/queue" style={{
        fontSize: 13,
        color: 'var(--muted)',
        display: 'inline-block',
        marginBottom: 18,
      }}>
        ← Back to queue
      </Link>

      <PageHeader
        meta="404 · item not found"
        title="Item not found."
        sub="This queue item doesn’t exist, has already been removed, or is outside your clinic scope."
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/queue" className="btn primary" style={{ justifyContent: 'center' }}>
          Back to queue
        </Link>
        <Link href="/dashboard" className="btn ghost" style={{ justifyContent: 'center' }}>
          Dashboard
        </Link>
      </div>

      <PageFoot
        status="Item not found · mock data"
        rightLink={{ href: '/queue', label: '← Queue' }}
      />
    </PageShell>
  )
}

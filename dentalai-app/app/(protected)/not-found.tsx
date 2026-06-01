import Link from 'next/link'
import { PageShell, PageHeader, PageFoot } from '@/components/calm'

export default function ProtectedNotFound() {
  return (
    <PageShell>
      <PageHeader
        meta="404 · not found"
        title="Nothing here."
        sub="That page or item doesn’t exist, has been removed, or is outside your access scope."
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Link href="/dashboard" className="btn primary" style={{ justifyContent: 'center' }}>
          Back to dashboard
        </Link>
        <Link href="/queue" className="btn ghost" style={{ justifyContent: 'center' }}>
          Open the queue
        </Link>
      </div>

      <PageFoot status="Page not found · mock data" />
    </PageShell>
  )
}

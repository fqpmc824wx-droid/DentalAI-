'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { PageShell, PageHeader, Banner, PageFoot } from '@/components/calm'

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ProtectedError]', error)
  }, [error])

  return (
    <PageShell>
      <PageHeader
        meta="Error · something went wrong"
        title="That didn’t work."
        sub={
          <>
            An unexpected error occurred on this page. It&rsquo;s been logged.
            {error.digest && (
              <> Reference: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{error.digest}</code>.</>
            )}
          </>
        }
      />

      <div style={{ marginBottom: 24 }}>
        <Banner tone="warn">{error.message || 'An unexpected error occurred'}</Banner>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={reset} className="btn primary" style={{ justifyContent: 'center' }}>
          Try again
        </button>
        <Link href="/dashboard" className="btn ghost" style={{ justifyContent: 'center' }}>
          Back to dashboard
        </Link>
      </div>

      <PageFoot
        status="Error logged · demo data · saved locally"
        rightLink={{ href: '/audit', label: 'View audit trail →' }}
      />
    </PageShell>
  )
}

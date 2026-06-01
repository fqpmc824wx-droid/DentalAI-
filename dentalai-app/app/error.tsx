'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production this would feed an error-reporting sink (Sentry, etc.)
    console.error('[RootError]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Something went wrong
        </p>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 36,
          letterSpacing: '0', color: 'var(--ink)', margin: '0 0 12px',
        }}>
          An unexpected error occurred.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 28px', lineHeight: 1.6 }}>
          The error has been logged.
          {error.digest && (
            <> Reference: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{error.digest}</code>.</>
          )}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={reset}
            className="btn primary"
            style={{ justifyContent: 'center' }}
          >
            Try again
          </button>
          <Link href="/" className="btn ghost" style={{ justifyContent: 'center' }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}

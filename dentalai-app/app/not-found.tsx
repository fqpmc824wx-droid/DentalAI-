import Link from 'next/link'

export default function RootNotFound() {
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
          404 · Not found
        </p>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 36,
          letterSpacing: '0', color: 'var(--ink)', margin: '0 0 12px',
        }}>
          Nothing here.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 28px', lineHeight: 1.6 }}>
          That page doesn&rsquo;t exist or has moved.
        </p>
        <Link href="/" className="btn primary" style={{ justifyContent: 'center' }}>
          Go home
        </Link>
      </div>
    </div>
  )
}

export default function ProtectedLoading() {
  return (
    <div className="cm-page animate-in" aria-busy="true" aria-label="Loading">
      <header className="cm-page-header">
        <div style={{ height: 12, width: 220, background: 'var(--line-2)', borderRadius: 4, marginBottom: 14 }} />
        <div style={{ height: 36, width: '60%', background: 'var(--line-2)', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 14, width: '80%', background: 'var(--line)', borderRadius: 4 }} />
      </header>

      <div className="cm-card" style={{ marginBottom: 24 }}>
        <div style={{ height: 14, width: 120, background: 'var(--line-2)', borderRadius: 4, marginBottom: 16 }} />
        <div style={{ height: 20, width: '70%', background: 'var(--line-2)', borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 14, width: '50%', background: 'var(--line)', borderRadius: 4 }} />
      </div>

      {[1, 2, 3].map(i => (
        <div key={i} className="cm-qrow" style={{ cursor: 'default' }}>
          <div className="col-time">
            <div style={{ height: 13, width: 40, background: 'var(--line-2)', borderRadius: 3 }} />
          </div>
          <div className="col-type">
            <div style={{ height: 18, width: 70, background: 'var(--line-2)', borderRadius: 999 }} />
          </div>
          <div className="col-main">
            <div style={{ height: 17, width: '60%', background: 'var(--line-2)', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 12, width: '80%', background: 'var(--line)', borderRadius: 3 }} />
          </div>
          <div className="col-confidence">
            <div style={{ height: 4, width: '100%', background: 'var(--line)', borderRadius: 999 }} />
          </div>
          <div className="col-status">
            <div style={{ height: 22, width: 60, background: 'var(--line-2)', borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

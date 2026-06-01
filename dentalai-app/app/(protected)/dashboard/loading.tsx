export default function DashboardLoading() {
  return (
    <div className="cm-page animate-in" aria-busy="true" aria-label="Loading dashboard">
      <header className="cm-page-header">
        <div style={{ height: 11, width: 280, background: 'var(--line-2)', borderRadius: 3, marginBottom: 14 }} />
        <div style={{ height: 38, width: '55%', background: 'var(--line-2)', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 14, width: '75%', background: 'var(--line)', borderRadius: 4 }} />
      </header>

      <div className="cm-card accent" style={{ marginTop: 16, marginBottom: 32 }}>
        <div style={{ height: 11, width: 160, background: 'var(--line-2)', borderRadius: 3, marginBottom: 18 }} />
        <div style={{ height: 24, width: '65%', background: 'var(--line-2)', borderRadius: 5, marginBottom: 14 }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div style={{ height: 10, width: 50, background: 'var(--line-2)', borderRadius: 3, marginBottom: 6 }} />
              <div style={{ height: 14, width: 80, background: 'var(--line)', borderRadius: 3 }} />
            </div>
          ))}
        </div>
        <div style={{ height: 40, width: 150, background: 'var(--line-2)', borderRadius: 8 }} />
      </div>

      <div className="cm-section-h">
        <div style={{ height: 11, width: 80, background: 'var(--line-2)', borderRadius: 3 }} />
        <span className="rule" />
        <div style={{ height: 11, width: 40, background: 'var(--line)', borderRadius: 3 }} />
      </div>

      {[1, 2, 3].map(i => (
        <div key={i} className="cm-qrow" style={{ cursor: 'default' }}>
          <div className="col-time">
            <div style={{ height: 13, width: 36, background: 'var(--line-2)', borderRadius: 3 }} />
          </div>
          <div className="col-type">
            <div style={{ height: 18, width: 70, background: 'var(--line-2)', borderRadius: 999 }} />
          </div>
          <div className="col-main">
            <div style={{ height: 17, width: '55%', background: 'var(--line-2)', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 12, width: '75%', background: 'var(--line)', borderRadius: 3 }} />
          </div>
          <div className="col-confidence">
            <div style={{ height: 4, width: '100%', background: 'var(--line)', borderRadius: 999 }} />
          </div>
          <div className="col-status">
            <div style={{ height: 22, width: 58, background: 'var(--line-2)', borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

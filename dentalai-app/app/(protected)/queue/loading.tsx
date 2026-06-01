export default function QueueLoading() {
  return (
    <div className="cm-page animate-in" aria-busy="true" aria-label="Loading queue">
      <header className="cm-page-header">
        <div style={{ height: 38, width: '45%', background: 'var(--line-2)', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 14, width: '60%', background: 'var(--line)', borderRadius: 4 }} />
      </header>

      {/* Filter pills skeleton */}
      <div className="cm-filters">
        {[100, 80, 90, 70].map((w, i) => (
          <div key={i} style={{ height: 32, width: w, background: 'var(--line-2)', borderRadius: 999 }} />
        ))}
      </div>

      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="cm-qrow" style={{ cursor: 'default' }}>
          <div className="col-time">
            <div style={{ height: 13, width: 36, background: 'var(--line-2)', borderRadius: 3 }} />
          </div>
          <div className="col-type">
            <div style={{ height: 18, width: 70, background: 'var(--line-2)', borderRadius: 999 }} />
          </div>
          <div className="col-main">
            <div style={{ height: 17, width: `${45 + i * 8}%`, background: 'var(--line-2)', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 12, width: `${60 + i * 5}%`, background: 'var(--line)', borderRadius: 3 }} />
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

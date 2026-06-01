/**
 * ConfidenceBar — visual horizontal bar showing 0–100% confidence.
 *
 * Replaces inline text like "96% confidence" with a scannable bar.
 *
 * <ConfidenceBar value={87} />          // full block: label above bar
 * <ConfidenceBar value={87} inline />   // inline: label beside bar
 */
export function ConfidenceBar({
  value,
  inline = false,
  label = 'Confidence',
}: {
  value: number
  inline?: boolean
  label?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const tone = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low'
  const cls = ['cm-confidence', tone]
  if (inline) cls.push('inline')

  return (
    <div className={cls.join(' ')} role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${pct}%`}>
      <div className="label">
        <span>{label}</span>
        <span className="pct">{pct}%</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

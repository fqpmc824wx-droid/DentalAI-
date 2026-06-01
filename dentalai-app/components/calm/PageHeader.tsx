import type { ReactNode } from 'react'

/**
 * PageHeader — meta line + serif title + body sub.
 *
 * <PageHeader
 *   meta="Today · 14 Mar · Smile Dental"
 *   title={<>The <em>queue</em>.</>}
 *   sub="3 pending · 1 urgent · open an item to review and act."
 * />
 */
export function PageHeader({
  meta,
  title,
  sub,
}: {
  meta?: ReactNode
  title: ReactNode
  sub?: ReactNode
}) {
  return (
    <header className="cm-page-header">
      {meta && <p className="meta">{meta}</p>}
      <h1>{title}</h1>
      {sub && <p className="sub">{sub}</p>}
    </header>
  )
}

/**
 * SectionH — small-caps section divider used between page sections.
 *
 * <SectionH label="Your queue" meta="3 items" />
 */
export function SectionH({
  label,
  meta,
}: {
  label: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="cm-section-h">
      <span className="label">{label}</span>
      <span className="rule" aria-hidden />
      {meta && <span className="meta">{meta}</span>}
    </div>
  )
}

import type { ReactNode } from 'react'

/**
 * PageShell — the consistent container for every protected page.
 *
 * Wraps content in a max-width column with disciplined padding rhythm.
 * Adds `has-sticky-actions` class when the page hosts a sticky mobile
 * action footer so the body padding-bottom doesn't collide with it.
 */
export function PageShell({
  children,
  wide = false,
  hasStickyActions = false,
}: {
  children: ReactNode
  /** When true, max-width grows to 1040px (for grid-heavy admin pages). */
  wide?: boolean
  /** When true, adds bottom padding so sticky mobile footer doesn't overlap content. */
  hasStickyActions?: boolean
}) {
  const cls = ['cm-page', 'animate-in']
  if (wide) cls.push('wide')
  if (hasStickyActions) cls.push('has-sticky-actions')
  return <div className={cls.join(' ')}>{children}</div>
}

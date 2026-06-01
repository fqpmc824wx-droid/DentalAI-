import type { ReactNode } from 'react'

/**
 * PageFoot — the muted status bar at the bottom of every page.
 *
 * Always shows a dot + status text + optional right-aligned link.
 *
 * <PageFoot
 *   status="Mock data · resets on restart"
 *   rightLink={{ href: '/audit', label: 'View audit →' }}
 * />
 */
export function PageFoot({
  status,
  rightLink,
  children,
}: {
  status?: ReactNode
  rightLink?: { href: string; label: ReactNode }
  /** Optional extra children placed before the spacer. */
  children?: ReactNode
}) {
  return (
    <footer className="cm-page-foot">
      <span className="dot" aria-hidden />
      {status && <span>{status}</span>}
      {children}
      <span className="spacer" />
      {rightLink && <a href={rightLink.href}>{rightLink.label}</a>}
    </footer>
  )
}

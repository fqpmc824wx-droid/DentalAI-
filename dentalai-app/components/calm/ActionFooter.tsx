import type { ReactNode } from 'react'

/**
 * ActionFooter — desktop: inline card. Mobile: sticky bottom bar.
 *
 * Use this for the primary decision row of any page (approve/reject/escalate,
 * record outcome, etc.). On mobile it sticks to the bottom of the viewport,
 * keeping approval actions within thumb reach.
 *
 * <ActionFooter label="Over to you" helper="Audit logs who approved and when.">
 *   <button className="btn primary">Approve request</button>
 *   <button className="btn">Reject</button>
 * </ActionFooter>
 *
 * IMPORTANT: pair this with `<PageShell hasStickyActions>` so the page bottom
 * padding accounts for the sticky footer height on mobile.
 */
export function ActionFooter({
  children,
  label,
  helper,
}: {
  children: ReactNode
  label?: ReactNode
  helper?: ReactNode
}) {
  return (
    <div className="cm-action-footer" role="group" aria-label={typeof label === 'string' ? label : 'Actions'}>
      {label && <span className="label">{label}</span>}
      {children}
      {helper && <p className="helper">{helper}</p>}
    </div>
  )
}

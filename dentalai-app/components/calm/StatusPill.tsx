import type { ReactNode } from 'react'

export type PillIntent =
  | 'allow'
  | 'review'
  | 'block'
  | 'urgent'
  | 'ai'
  | 'info'
  | 'neutral'

/**
 * StatusPill — one component for every status/decision/tag in the app.
 *
 * Intent maps to the locked decision colour language:
 *   - allow  = teal-green calm positive
 *   - review = amber warning
 *   - block  = red strong warning
 *   - urgent = orange (your-call type tasks)
 *   - ai     = primary teal (AI prepared)
 *   - info   = blue (informational state)
 *   - neutral = muted grey (everything else)
 *
 * <StatusPill intent="allow">Approved</StatusPill>
 * <StatusPill intent="review" size="sm">Review</StatusPill>
 * <StatusPill intent="urgent" solid>Emergency</StatusPill>
 */
export function StatusPill({
  children,
  intent = 'neutral',
  size,
  solid = false,
  dot = false,
}: {
  children: ReactNode
  intent?: PillIntent
  size?: 'sm'
  /** Inverted solid variant — ink background, bg foreground. */
  solid?: boolean
  /** Show a tiny dot before the label. */
  dot?: boolean
}) {
  const cls = ['cm-pill', intent]
  if (size === 'sm') cls.push('sm')
  if (solid) cls.push('solid')
  return (
    <span className={cls.join(' ')}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  )
}

/** Maps a rule decision string to the intent colour. */
export function decisionIntent(decision?: 'allow' | 'review' | 'block' | string): PillIntent {
  if (decision === 'allow') return 'allow'
  if (decision === 'review') return 'review'
  if (decision === 'block') return 'block'
  return 'neutral'
}

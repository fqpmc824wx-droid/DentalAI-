import type { ReactNode } from 'react'

/**
 * EmptyState — premium empty state.
 *
 * Use when a list has nothing to show. Reads as intentional design,
 * not "your data is missing." Optional glyph for character.
 *
 * <EmptyState
 *   title="Nothing pending"
 *   message="Beautiful. Take a breath."
 *   glyph={<CheckIcon />}
 * />
 */
export function EmptyState({
  title,
  message,
  glyph,
}: {
  title: ReactNode
  message?: ReactNode
  glyph?: ReactNode
}) {
  return (
    <div className="cm-empty">
      {glyph && <div className="glyph">{glyph}</div>}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
    </div>
  )
}

/* Tiny inline SVG glyphs — no icon library dependency */
export function GlyphCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  )
}
export function GlyphInbox() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11h4l1 2h4l1-2h4M3 11l2-7h10l2 7v6H3v-6z" />
    </svg>
  )
}
export function GlyphCalm() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M7 11.5c.7 1.2 1.8 2 3 2s2.3-.8 3-2" />
      <circle cx="7.5" cy="8" r=".6" fill="currentColor" />
      <circle cx="12.5" cy="8" r=".6" fill="currentColor" />
    </svg>
  )
}

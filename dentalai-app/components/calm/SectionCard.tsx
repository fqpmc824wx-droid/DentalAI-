import type { ReactNode } from 'react'

export type SectionCardTone = 'default' | 'tint' | 'warn' | 'danger' | 'success'
export type SectionCardAccent = 'primary' | 'review' | 'block' | 'urgent' | null

/**
 * SectionCard — the workhorse card used on every page.
 *
 * Tones: default | tint | warn | danger | success
 * Accent: null | primary | review | block | urgent (left rail)
 *
 * <SectionCard label="Patient">{...}</SectionCard>
 * <SectionCard tone="tint" accent="primary">{...}</SectionCard>
 */
export function SectionCard({
  children,
  label,
  tone = 'default',
  accent = null,
  className,
}: {
  children: ReactNode
  label?: ReactNode
  tone?: SectionCardTone
  accent?: SectionCardAccent
  className?: string
}) {
  const cls = ['cm-card']
  if (tone !== 'default') cls.push(tone)
  if (accent) {
    cls.push('accent')
    if (accent !== 'primary') cls.push(accent)
  }
  if (className) cls.push(className)
  return (
    <section className={cls.join(' ')}>
      {label && <p className="cm-card-label">{label}</p>}
      {children}
    </section>
  )
}

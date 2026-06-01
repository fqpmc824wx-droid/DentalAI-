import type { ReactNode } from 'react'

export type BannerTone = 'default' | 'info' | 'warn' | 'danger'

/**
 * Banner — slim status notice above content.
 *
 * Used for: mock-only notices, phase warnings, resolved item banners, etc.
 *
 * <Banner tone="warn">Mock-only audit store · resets on restart.</Banner>
 */
export function Banner({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: BannerTone
}) {
  const cls = ['cm-banner']
  if (tone !== 'default') cls.push(tone)
  return <div className={cls.join(' ')} role="status">{children}</div>
}

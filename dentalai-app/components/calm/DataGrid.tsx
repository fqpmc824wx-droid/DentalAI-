import type { ReactNode } from 'react'

export type DataGridItem = {
  label: ReactNode
  value: ReactNode
  /** Render value with monospace font (IDs, phone numbers). */
  mono?: boolean
  /** Tone of value cell colour (warn/ok/bad). */
  tone?: 'warn' | 'ok' | 'bad'
  /** Strong emphasis on value. */
  strong?: boolean
}

/**
 * DataGrid — replaces every inline dt/dd patient/appointment grid.
 *
 * <DataGrid items={[
 *   { label: 'Name',  value: 'Sarah Williams', strong: true },
 *   { label: 'Phone', value: '07700900001', mono: true },
 *   { label: 'Balance', value: '£245 owed', tone: 'warn' },
 * ]} />
 */
export function DataGrid({ items }: { items: DataGridItem[] }) {
  return (
    <dl className="cm-dl">
      {items.map((item, i) => {
        const ddCls: string[] = []
        if (item.mono) ddCls.push('mono')
        if (item.tone) ddCls.push(item.tone)
        return (
          <div key={i}>
            <dt>{item.label}</dt>
            <dd className={ddCls.join(' ')}>
              {item.strong ? <span className="strong">{item.value}</span> : item.value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

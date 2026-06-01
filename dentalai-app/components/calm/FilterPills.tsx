import Link from 'next/link'

export type FilterOption = {
  id: string
  label: string
  count?: number
}

/**
 * FilterPills — segmented pill group for list filters.
 *
 * Each pill is a Link (no client state needed). Active pill is solid-inverted.
 *
 * <FilterPills
 *   options={[{id:'all', label:'All', count:12}]}
 *   activeId={filter}
 *   hrefFor={id => `/queue?filter=${id}`}
 * />
 */
export function FilterPills({
  options,
  activeId,
  hrefFor,
}: {
  options: FilterOption[]
  activeId: string
  hrefFor: (id: string) => string
}) {
  return (
    <nav className="cm-filters" aria-label="Filter">
      {options.map(opt => {
        const active = opt.id === activeId
        return (
          <Link
            key={opt.id}
            href={hrefFor(opt.id)}
            className={`cm-filter${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {opt.label}
            {typeof opt.count === 'number' && <span className="count">{opt.count}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

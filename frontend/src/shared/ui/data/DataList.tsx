import type { ReactNode } from 'react'

export interface DataListProps<T> {
  label: string
  items: T[]
  renderItem: (item: T) => ReactNode
  keyExtractor: (item: T) => string | number
  groupBy?: (item: T) => string
  emptyText?: string
  className?: string
}

export function DataList<T>({
  className = '',
  emptyText = 'No hay registros para mostrar.',
  groupBy,
  items,
  keyExtractor,
  label,
  renderItem,
}: DataListProps<T>) {
  if (items.length === 0) {
    return (
      <div
        aria-label={label}
        className={`p-6 text-center text-[13px] text-ink-muted bg-surface rounded-panel border border-line ${className}`.trim()}
        role="region"
      >
        <p>{emptyText}</p>
      </div>
    )
  }

  if (groupBy) {
    const groups: Record<string, T[]> = {}
    for (const item of items) {
      const groupKey = groupBy(item)
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(item)
    }

    return (
      <div
        aria-label={label}
        className={`space-y-6 ${className}`.trim()}
        role="region"
      >
        {Object.entries(groups).map(([groupName, groupItems]) => {
          const groupId = `group-${groupName.toLowerCase().replace(/\s+/g, '-')}`
          return (
            <section
              aria-labelledby={groupId}
              className="space-y-1.5"
              key={groupName}
              role="group"
            >
              <h3
                className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider px-1"
                id={groupId}
              >
                {groupName}
              </h3>
              <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
                {groupItems.map((item) => (
                  <li
                    className="px-4 py-3 transition-colors hover:bg-surface-subtle"
                    key={keyExtractor(item)}
                  >
                    {renderItem(item)}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <ul
      aria-label={label}
      className={`divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface ${className}`.trim()}
    >
      {items.map((item) => (
        <li
          className="px-4 py-3 transition-colors hover:bg-surface-subtle"
          key={keyExtractor(item)}
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  )
}

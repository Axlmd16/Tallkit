import type { ChangeEvent } from 'react'

import { SearchInput } from '../forms'

export interface ConversationItem {
  id: string
  title: string
  preview: string
  time: string
  group?: string | undefined
  unreadCount?: number | undefined
}

export interface ConversationListProps {
  conversations: ConversationItem[]
  label: string
  selectedId?: string | undefined
  onSelect?: ((conversation: ConversationItem) => void) | undefined
  query?: string | undefined
  onQueryChange?: ((query: string) => void) | undefined
  className?: string | undefined
}

export function ConversationList({
  className = '',
  conversations,
  label,
  onQueryChange,
  onSelect,
  query = '',
  selectedId,
}: ConversationListProps) {
  const groups = new Map<string, ConversationItem[]>()
  for (const conversation of conversations) {
    const group = conversation.group ?? 'Conversaciones'
    groups.set(group, [...(groups.get(group) ?? []), conversation])
  }

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    onQueryChange?.(event.currentTarget.value)
  }

  return (
    <section
      aria-label={label}
      className={`min-w-0 rounded-group bg-surface p-3 ${className}`.trim()}
    >
      {onQueryChange && (
        <div className="mb-3">
          <SearchInput
            aria-label="Buscar conversaciones"
            onChange={handleQueryChange}
            onClear={() => onQueryChange('')}
            placeholder="Buscar ejemplos…"
            value={query}
          />
        </div>
      )}

      <div className="space-y-4">
        {Array.from(groups).map(([group, items]) => {
          const headingId = `conversation-group-${group.replace(/\s+/g, '-').toLowerCase()}`
          return (
            <section aria-labelledby={headingId} key={group}>
              <h3
                className="mb-2 px-2 text-xs font-extrabold uppercase tracking-wider text-ink-muted"
                id={headingId}
              >
                {group}
              </h3>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      aria-pressed={selectedId === item.id}
                      className={`flex min-h-16 w-full items-start gap-3 rounded-group p-3 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        selectedId === item.id
                          ? 'bg-primary-soft text-ink'
                          : 'bg-surface text-ink hover:bg-surface-muted'
                      }`}
                      onClick={() => onSelect?.(item)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-extrabold text-primary-strong"
                      >
                        {item.title.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="break-words text-sm font-extrabold">
                            {item.title}
                          </span>
                          <span className="shrink-0 text-xs text-ink-muted">
                            {item.time}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-ink-muted">
                          {item.preview}
                        </span>
                      </span>
                      {Boolean(item.unreadCount) && (
                        <span
                          aria-label={`${item.unreadCount} elementos sin leer`}
                          className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white"
                        >
                          {item.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </section>
  )
}

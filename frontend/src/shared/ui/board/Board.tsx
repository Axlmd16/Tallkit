import type { BoardCardProps } from './BoardCard'
import { BoardCard } from './BoardCard'

export type BoardCardData = Omit<
  BoardCardProps,
  'selected' | 'onSelect' | 'className'
>

export interface BoardColumn {
  id: string
  title: string
  cards: BoardCardData[]
}

export interface BoardProps {
  columns: BoardColumn[]
  label: string
  selectedCardId?: string | undefined
  onSelectCard?: ((card: BoardCardData) => void) | undefined
  className?: string | undefined
}

export function Board({
  className = '',
  columns,
  label,
  onSelectCard,
  selectedCardId,
}: BoardProps) {
  return (
    <section aria-label={label} className={`min-w-0 ${className}`.trim()}>
      <div
        aria-label={`${label}: columnas desplazables`}
        className="overflow-x-auto pb-2"
        role="region"
        tabIndex={0}
      >
        <div className="grid min-w-max auto-cols-[minmax(17.5rem,20rem)] grid-flow-col gap-4">
          {columns.map((column) => (
            <section
              aria-labelledby={`board-column-${column.id}`}
              className="rounded-group bg-surface-muted p-3"
              key={column.id}
            >
              <header className="mb-3 flex min-h-11 items-center justify-between gap-3 px-1">
                <h3
                  className="break-words text-sm font-extrabold text-ink"
                  id={`board-column-${column.id}`}
                >
                  {column.title}
                </h3>
                <span
                  aria-label={`${column.title}: ${column.cards.length} elementos`}
                  className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full bg-surface px-2 text-xs font-bold text-ink"
                >
                  {column.cards.length}
                </span>
              </header>
              <div
                aria-label={`Elementos de ${column.title}`}
                className="space-y-3"
                role="list"
              >
                {column.cards.map((card) => (
                  <BoardCard
                    {...card}
                    key={card.id}
                    onSelect={() => onSelectCard?.(card)}
                    selected={selectedCardId === card.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

import { CaretLeft, CaretRight } from '@phosphor-icons/react'

import { Button } from '../controls'

export interface PaginationProps {
  page: number
  totalPages: number
  totalItems?: number
  onNext: () => void
  onPrevious: () => void
  className?: string
}

export function Pagination({
  className = '',
  onNext,
  onPrevious,
  page,
  totalItems,
  totalPages,
}: PaginationProps) {
  const normalizedTotal = Math.max(totalPages, 1)

  const hasTotal = totalItems !== undefined
  return (
    <nav
      aria-label="Paginación"
      className={`mt-3 flex flex-wrap items-center justify-between gap-2 ${className}`.trim()}
    >
      <span className="numeric text-label text-ink-muted">
        Página {page} de {normalizedTotal}
        {hasTotal ? ` · ${totalItems} registros` : ''}
      </span>
      <div className="flex items-center gap-1">
        <Button
          aria-label="Página anterior"
          className="min-w-11 px-2"
          disabled={page <= 1}
          onClick={onPrevious}
          title="Página anterior"
          variant="secondary"
        >
          <CaretLeft aria-hidden="true" size={16} />
        </Button>
        <span
          aria-current="page"
          className="numeric grid min-h-10 min-w-10 place-items-center rounded-control bg-primary px-2 text-body font-semibold text-white"
        >
          {page}
        </span>
        <Button
          aria-label="Página siguiente"
          className="min-w-11 px-2"
          disabled={page >= normalizedTotal}
          onClick={onNext}
          title="Página siguiente"
          variant="secondary"
        >
          <CaretRight aria-hidden="true" size={16} />
        </Button>
      </div>
    </nav>
  )
}

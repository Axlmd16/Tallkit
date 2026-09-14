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

  return (
    <nav
      aria-label="Paginación"
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
    >
      <Button
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={onPrevious}
        variant="secondary"
      >
        Anterior
      </Button>

      <span className="numeric text-sm text-ink-muted">
        Página {page} de {normalizedTotal}
        {totalItems !== undefined ? ` (${totalItems} registros)` : ''}
      </span>

      <Button
        aria-label="Página siguiente"
        disabled={page >= normalizedTotal}
        onClick={onNext}
        variant="secondary"
      >
        Siguiente
      </Button>
    </nav>
  )
}

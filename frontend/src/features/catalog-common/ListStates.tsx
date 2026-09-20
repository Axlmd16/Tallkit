import type { ReactNode } from 'react'

import type { Page } from '@/shared/api/catalog-resource'
import {
  Button,
  EmptyState,
  InlineNotice,
  LoadingState,
  Pagination,
} from '@/shared/ui'

interface QueryLike<T> {
  isPending: boolean
  isError: boolean
  data?: Page<T> | undefined
  refetch?: (() => unknown) | undefined
}

/** Carga, error, vacío, sin coincidencias y paginación del servidor de una lista. */
export function ListStates<T>({
  query,
  loadingLabel,
  errorText,
  emptyTitle,
  emptyText,
  filtered,
  onPage,
  children,
}: {
  query: QueryLike<T>
  loadingLabel: string
  errorText: string
  emptyTitle: string
  emptyText: string
  filtered: boolean
  onPage: (page: number) => void
  children: (rows: T[]) => ReactNode
}) {
  if (query.isPending) return <LoadingState label={loadingLabel} />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="Error de carga" tone="danger">
        {errorText}
        {query.refetch && (
          <div className="mt-3">
            <Button
              onClick={() => void query.refetch?.()}
              type="button"
              variant="secondary"
            >
              Reintentar
            </Button>
          </div>
        )}
      </InlineNotice>
    )
  }
  const data = query.data
  if (data.results.length === 0) {
    return (
      <EmptyState
        description={
          filtered
            ? 'No hay resultados con los filtros aplicados. Ajuste la búsqueda o el estado.'
            : emptyText
        }
        title={filtered ? 'Sin coincidencias' : emptyTitle}
      />
    )
  }
  return (
    <div className="space-y-4">
      {children(data.results)}
      {data.total_pages > 1 && (
        <Pagination
          onNext={() => onPage(data.page + 1)}
          onPrevious={() => onPage(data.page - 1)}
          page={data.page}
          totalItems={data.count}
          totalPages={data.total_pages}
        />
      )}
    </div>
  )
}

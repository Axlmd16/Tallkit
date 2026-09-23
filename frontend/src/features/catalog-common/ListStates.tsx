import type { ReactNode } from 'react'

import type { Page } from '@/shared/api/catalog-resource'
import {
  Button,
  EmptyState,
  InlineNotice,
  Pagination,
  SkeletonRows,
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
  toolbar,
}: {
  query: QueryLike<T>
  loadingLabel: string
  errorText: string
  emptyTitle: string
  emptyText: string
  filtered: boolean
  onPage: (page: number) => void
  children: (rows: T[]) => ReactNode
  /** Franja de búsqueda y filtros en la parte superior del panel (PPF-01). */
  toolbar?: ReactNode
}) {
  return (
    <section className="list-panel overflow-hidden rounded-panel border border-line bg-surface">
      {toolbar && (
        <div className="list-panel-toolbar border-b border-line p-3">
          {toolbar}
        </div>
      )}
      <div className="list-panel-body">
        <ListBody
          emptyText={emptyText}
          emptyTitle={emptyTitle}
          errorText={errorText}
          filtered={filtered}
          loadingLabel={loadingLabel}
          onPage={onPage}
          query={query}
        >
          {children}
        </ListBody>
      </div>
    </section>
  )
}

function ListBody<T>({
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
  if (query.isPending) return <SkeletonRows label={loadingLabel} />
  if (query.isError || !query.data) {
    return (
      <div className="p-4">
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
      </div>
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
    <>
      {children(data.results)}
      <div className="border-t border-line px-4 py-2">
        <Pagination
          className="mt-0"
          onNext={() => onPage(data.page + 1)}
          onPrevious={() => onPage(data.page - 1)}
          page={data.page}
          totalItems={data.count}
          totalPages={Math.max(data.total_pages, 1)}
        />
      </div>
    </>
  )
}

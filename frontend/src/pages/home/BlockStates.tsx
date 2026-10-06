import type { ReactNode } from 'react'

import { ErrorState, SkeletonRows } from '@/shared/ui'

export interface BlockQuery<T> {
  isPending: boolean
  isError: boolean
  data?: T | undefined
  refetch: () => unknown
}

/**
 * Estados de un bloque del inicio dentro de su propio panel: carga con marcadores de posición,
 * error con «Reintentar» solo para ese bloque y contenido. Nunca muestra un cero en lugar de un
 * dato que no pudo obtenerse.
 */
export function BlockStates<T>({
  query,
  loadingLabel,
  errorTitle,
  children,
}: {
  query: BlockQuery<T>
  loadingLabel: string
  errorTitle: string
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <SkeletonRows label={loadingLabel} rows={2} />
  if (query.isError || query.data === undefined) {
    return (
      <div className="px-4 py-3.5">
        <ErrorState
          message="El servidor no respondió. Reintente en unos instantes."
          onRetry={() => void query.refetch()}
          title={errorTitle}
        />
      </div>
    )
  }
  return <>{children(query.data)}</>
}

/** Un bloque cargado y sin nada que mostrar a esta persona no ocupa lugar en la página. */
export function isEmptyBlock<T>(
  query: BlockQuery<T>,
  isEmpty: (data: T) => boolean,
): boolean {
  return (
    !query.isPending &&
    !query.isError &&
    query.data !== undefined &&
    isEmpty(query.data)
  )
}

import type { ReactNode } from 'react'

import { Button } from '@/shared/ui/actions'
import { EmptyState, InlineNotice, LoadingState } from '@/shared/ui/states'

export { EmptyState, InlineNotice, LoadingState }

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  action?: ReactNode
  className?: string
}

export function ErrorState({
  title = 'Ha ocurrido un error',
  message,
  onRetry,
  retryLabel = 'Reintentar',
  action,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <InlineNotice title={title} tone="danger">
        <p>{message}</p>
      </InlineNotice>
      {(onRetry || action) && (
        <div className="flex items-center gap-2 pt-1">
          {onRetry && (
            <Button onClick={onRetry} variant="secondary">
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

export interface SuccessStateProps {
  title?: string
  message?: ReactNode
  action?: ReactNode
  className?: string
}

export function SuccessState({
  title = 'Operación completada con éxito',
  message,
  action,
  className = '',
}: SuccessStateProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <InlineNotice title={title} tone="success">
        {message && <div>{message}</div>}
      </InlineNotice>
      {action && <div className="flex items-center gap-2 pt-1">{action}</div>}
    </div>
  )
}

export interface NoResultsStateProps {
  title?: string
  description?: string
  onClear?: () => void
  clearLabel?: string
  action?: ReactNode
  className?: string
}

export function NoResultsState({
  title = 'Sin coincidencias',
  description = 'No se encontraron resultados para los filtros aplicados. Intente ajustar los términos de búsqueda.',
  onClear,
  clearLabel = 'Limpiar filtros',
  action,
}: NoResultsStateProps) {
  return (
    <EmptyState
      action={
        onClear ? (
          <Button onClick={onClear} variant="secondary">
            {clearLabel}
          </Button>
        ) : (
          action
        )
      }
      description={description}
      title={title}
    />
  )
}

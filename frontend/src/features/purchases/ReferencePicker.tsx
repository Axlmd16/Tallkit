import { useEffect, useState } from 'react'

import {
  Button,
  Field,
  InlineNotice,
  LoadingState,
  SearchInput,
  StatusBadge,
} from '@/shared/ui'

export interface PickerOption {
  id: number
  label: string
  detail?: string | undefined
  inactive?: boolean | undefined
  /** Definición tributaria sugerida por el catálogo (solo productos). */
  taxDefinitionId?: number | undefined
}

export interface PickerResults {
  isPending: boolean
  isError: boolean
  data?: { options: PickerOption[]; totalPages: number } | undefined
  refetch?: (() => unknown) | undefined
}

function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * Selector de una referencia con búsqueda en servidor y paginación explícita.
 * Conserva la selección al cambiar de página, etiqueta las referencias inactivas y
 * no permite incorporarlas como selección nueva.
 */
export function ReferencePicker({
  id,
  label,
  selected,
  onSelect,
  useOptions,
  disabled = false,
  error,
  inactiveHelp,
}: {
  id: string
  label: string
  selected: PickerOption | null
  onSelect: (option: PickerOption | null) => void
  useOptions: (term: string, page: number) => PickerResults
  disabled?: boolean
  error?: string | undefined
  inactiveHelp: string
}) {
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(selected === null)
  const debounced = useDebounced(term)
  const results = useOptions(debounced, page)
  useEffect(() => setPage(1), [debounced])

  if (selected && !open) {
    return (
      <Field error={error} id={id} label={label}>
        <div className="flex flex-wrap items-center gap-3" id={id}>
          <span className="font-semibold text-ink">{selected.label}</span>
          {selected.inactive && <StatusBadge label="Inactivo" tone="warning" />}
          {!disabled && (
            <Button onClick={() => setOpen(true)} type="button" variant="quiet">
              Cambiar
            </Button>
          )}
        </div>
        {selected.inactive && (
          <p className="mt-2 text-sm text-warning">{inactiveHelp}</p>
        )}
      </Field>
    )
  }

  return (
    <Field error={error} id={id} label={label}>
      <SearchInput
        id={id}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar…"
        value={term}
      />
      {results.isPending && <LoadingState label="Buscando…" />}
      {results.isError && (
        <InlineNotice title="No se pudo buscar" tone="danger">
          <Button
            onClick={() => void results.refetch?.()}
            type="button"
            variant="secondary"
          >
            Reintentar
          </Button>
        </InlineNotice>
      )}
      {results.data?.options.length === 0 && (
        <p className="mt-3 text-sm text-ink-muted">Sin coincidencias.</p>
      )}
      {results.data && results.data.options.length > 0 && (
        <div
          aria-label={`Resultados de ${label}`}
          className="mt-3 space-y-2"
          role="list"
        >
          {results.data.options.map((option) => (
            <div
              className="flex items-center justify-between gap-3"
              key={option.id}
              role="listitem"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {option.label}
                </p>
                {option.detail && (
                  <p className="truncate text-sm text-ink-muted">
                    {option.detail}
                  </p>
                )}
              </div>
              {option.inactive ? (
                <StatusBadge
                  label="Inactivo: no seleccionable"
                  tone="warning"
                />
              ) : (
                <Button
                  disabled={disabled}
                  onClick={() => {
                    onSelect(option)
                    setOpen(false)
                  }}
                  type="button"
                  variant="secondary"
                >
                  Elegir
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {results.data && results.data.totalPages > 1 && (
        <div className="mt-3 flex items-center gap-3">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            type="button"
            variant="quiet"
          >
            Anterior
          </Button>
          <span className="text-sm text-ink-muted">
            Página {page} de {results.data.totalPages}
          </span>
          <Button
            disabled={page >= results.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            type="button"
            variant="quiet"
          >
            Siguiente
          </Button>
        </div>
      )}
      {selected && (
        <div className="mt-3">
          <Button onClick={() => setOpen(false)} type="button" variant="quiet">
            Conservar «{selected.label}»
          </Button>
        </div>
      )}
    </Field>
  )
}

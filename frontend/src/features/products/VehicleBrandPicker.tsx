import { X } from '@phosphor-icons/react'
import { useState } from 'react'

import { useVehicleBrands } from '@/features/vehicle-brands/hooks'
import { Button, Checkbox, Field, Input, Pagination } from '@/shared/ui'

import type { CatalogRef } from './types'

const PAGE_SIZE = 8

/**
 * Selector de varias marcas de vehículo con búsqueda y paginación del servidor.
 * Las seleccionadas permanecen visibles aunque cambie la página o la búsqueda;
 * una marca inactiva ya asociada se conserva pero no puede volver a elegirse.
 */
export function VehicleBrandPicker({
  selected,
  onChange,
  disabled = false,
  error,
}: {
  selected: CatalogRef[]
  onChange: (next: CatalogRef[]) => void
  disabled?: boolean
  error?: string | undefined
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const query = useVehicleBrands({
    search: search.trim() || undefined,
    isActive: true,
    page,
    pageSize: PAGE_SIZE,
  })
  const chosen = new Set(selected.map((brand) => brand.id))
  const results = query.data?.results ?? []

  function toggle(id: number, name: string, checked: boolean) {
    onChange(
      checked
        ? [...selected, { id, name, is_active: true }]
        : selected.filter((brand) => brand.id !== id),
    )
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-semibold text-ink">
        Marcas de vehículo compatibles (opcional)
      </legend>
      <p className="text-sm text-ink-muted">
        Compatibilidad informativa para búsquedas; no bloquea ventas.
      </p>

      <ul aria-label="Marcas seleccionadas" className="flex flex-wrap gap-2">
        {selected.length === 0 && (
          <li className="text-sm text-ink-muted">Sin marcas seleccionadas.</li>
        )}
        {selected.map((brand) => (
          <li
            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-sm font-semibold text-primary-strong"
            key={brand.id}
          >
            {brand.name}
            {!brand.is_active && ' (inactiva)'}
            <button
              aria-label={`Quitar ${brand.name}`}
              className="grid size-8 place-items-center rounded-full hover:bg-surface-muted"
              onClick={() =>
                onChange(selected.filter((other) => other.id !== brand.id))
              }
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </li>
        ))}
      </ul>

      <Field id="vehicle-brand-picker-search" label="Buscar marca de vehículo">
        <Input
          id="vehicle-brand-picker-search"
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Buscar por nombre…"
          value={search}
        />
      </Field>

      {query.isPending && (
        <p className="text-sm text-ink-muted">Cargando marcas…</p>
      )}
      {query.isError && (
        <p className="text-sm font-semibold text-danger" role="alert">
          No fue posible cargar las marcas de vehículo.
        </p>
      )}
      {query.isSuccess && results.length === 0 && (
        <p className="text-sm text-ink-muted">
          {search.trim()
            ? 'Ninguna marca activa coincide con la búsqueda.'
            : 'No hay marcas de vehículo activas.'}
        </p>
      )}
      {results.length > 0 && (
        <ul
          aria-label="Marcas disponibles"
          className="grid gap-1 sm:grid-cols-2"
        >
          {results.map((brand) => (
            <li key={brand.id}>
              <Checkbox
                checked={chosen.has(brand.id)}
                label={brand.name}
                onChange={(event) =>
                  toggle(brand.id, brand.name, event.target.checked)
                }
              />
            </li>
          ))}
        </ul>
      )}
      {query.data && query.data.total_pages > 1 && (
        <Pagination
          onNext={() => setPage(page + 1)}
          onPrevious={() => setPage(page - 1)}
          page={query.data.page}
          totalPages={query.data.total_pages}
        />
      )}
      {error && (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
      {selected.length > 0 && (
        <Button onClick={() => onChange([])} type="button" variant="quiet">
          Quitar todas
        </Button>
      )}
    </fieldset>
  )
}

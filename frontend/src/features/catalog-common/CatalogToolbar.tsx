import { MagnifyingGlass, Plus, XCircle } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { Button, Field, FilterPanel, Input, Select, Toolbar } from '@/shared/ui'

import type { UrlFilters } from './filters'

export function CatalogToolbar({
  idPrefix,
  label,
  searchLabel,
  searchPlaceholder,
  filters,
  newLabel,
  onNew,
  extraFilters,
  statusLabels = { active: 'Activos', inactive: 'Inactivos' },
}: {
  idPrefix: string
  label: string
  searchLabel: string
  searchPlaceholder: string
  filters: UrlFilters
  newLabel?: string | undefined
  onNew?: (() => void) | undefined
  extraFilters?: ReactNode
  statusLabels?: { active: string; inactive: string }
}) {
  const [text, setText] = useState(filters.search)
  // Sincroniza el cuadro al volver por el historial o al limpiar filtros.
  useEffect(() => setText(filters.search), [filters.search])

  function submit(event: FormEvent) {
    event.preventDefault()
    filters.set({ search: text.trim() })
  }

  return (
    <Toolbar label={label}>
      <form
        className="flex flex-1 flex-wrap items-end gap-3"
        onSubmit={submit}
        role="search"
      >
        <div className="min-w-[220px] flex-1">
          <Field id={`${idPrefix}-search`} label={searchLabel}>
            <div className="relative">
              <Input
                id={`${idPrefix}-search`}
                onChange={(event) => setText(event.target.value)}
                placeholder={searchPlaceholder}
                value={text}
              />
              {text && (
                <button
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-ink-muted hover:text-ink"
                  onClick={() => {
                    setText('')
                    filters.set({ search: '' })
                  }}
                  type="button"
                >
                  <XCircle size={18} weight="fill" />
                </button>
              )}
            </div>
          </Field>
        </div>
        <Button type="submit" variant="secondary">
          <MagnifyingGlass aria-hidden="true" size={16} />
          Buscar
        </Button>
      </form>

      <FilterPanel
        className="order-last w-full basis-full"
        layout="inline"
        label={label.replace(/^Barra de herramientas de /, 'Filtros de ')}
      >
        <div className="w-44">
          <Field id={`${idPrefix}-status`} label="Estado">
            <Select
              id={`${idPrefix}-status`}
              onChange={(event) =>
                filters.set({ is_active: event.target.value })
              }
              value={filters.isActive}
            >
              <option value="true">{statusLabels.active}</option>
              <option value="false">{statusLabels.inactive}</option>
              <option value="all">Todos</option>
            </Select>
          </Field>
        </div>
        {extraFilters}
      </FilterPanel>

      {onNew && (
        <div className="ml-auto">
          <Button onClick={onNew} type="button" variant="primary">
            <Plus aria-hidden="true" size={16} weight="bold" />
            {newLabel}
          </Button>
        </div>
      )}
    </Toolbar>
  )
}

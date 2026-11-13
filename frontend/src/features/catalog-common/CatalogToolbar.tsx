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
  extraFilters,
  statusLabels = { active: 'Activos', inactive: 'Inactivos' },
}: {
  idPrefix: string
  label: string
  searchLabel: string
  searchPlaceholder: string
  filters: UrlFilters
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
    <Toolbar className="items-end gap-3" label={label}>
      <form
        className="flex min-w-[18rem] flex-1 items-end gap-2"
        onSubmit={submit}
        role="search"
      >
        <div className="min-w-[12rem] flex-1">
          <Field hideLabel id={`${idPrefix}-search`} label={searchLabel}>
            <div className="relative">
              <MagnifyingGlass
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-ink-muted"
                size={16}
              />
              <Input
                className="rounded-none! border-0! border-b-2! border-line-strong! bg-transparent! px-0! pl-8! shadow-none! hover:border-ink-muted! focus:border-ink! focus:shadow-none!"
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
          Buscar
        </Button>
      </form>

      <FilterPanel
        bare
        layout="inline"
        label={label.replace(/^Barra de herramientas de /, 'Filtros de ')}
      >
        <div className="w-40">
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
    </Toolbar>
  )
}

/** Acción principal de una lista: va en la cabecera de la página, a la derecha. */
export function NewRecordButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button onClick={onClick} type="button" variant="primary">
      <Plus aria-hidden="true" size={16} weight="bold" />
      {label}
    </Button>
  )
}

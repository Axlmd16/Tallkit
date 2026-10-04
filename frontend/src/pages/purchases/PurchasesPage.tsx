import { DotsThreeVertical, Eye, Plus } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  count,
  PurchaseStateBadge,
  timestamp,
} from '@/features/purchases/format'
import { usePurchases } from '@/features/purchases/hooks'
import type { PurchaseState, PurchaseSummary } from '@/features/purchases/types'
import {
  Button,
  DropdownMenu,
  ElevatedDataList,
  Field,
  FilterPanel,
  IconButton,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
} from '@/shared/ui'

const SEGMENT_LABELS: Record<PurchaseState, string> = {
  CONFIRMED: 'Registradas',
  VOIDED: 'Anuladas',
  DRAFT: 'Sin efecto',
}

/** Lista de entradas con filtros en la URL que se conservan al volver de la ficha. */
export function PurchasesPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const location = useLocation()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canCreate = permissions.has('ingresos.crear')
  // Los borradores del flujo anterior solo los ve quien también ve costos (el Administrador).
  const seesLegacyDrafts = permissions.has('productos.ver_costos')
  const [text, setText] = useState(filters.search)
  useEffect(() => setText(filters.search), [filters.search])

  const state = filters.get('state') as PurchaseState | ''
  const query = usePurchases({
    search: filters.search || undefined,
    state: state || undefined,
    dateFrom: filters.get('date_from') || undefined,
    dateTo: filters.get('date_to') || undefined,
    registeredBy: filters.getNumber('registered_by'),
    page: filters.page,
  })
  const people = query.data?.registered_by_options ?? []
  const segments = (Object.keys(SEGMENT_LABELS) as PurchaseState[]).filter(
    (value) => value !== 'DRAFT' || seesLegacyDrafts,
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    filters.set({ search: text.trim() })
  }

  const openDetail = (row: PurchaseSummary) =>
    navigate(`/purchases/${row.id}`, {
      state: { from: `${location.pathname}${location.search}` },
    })

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        actions={
          canCreate && (
            <Button onClick={() => navigate('/purchases/new')} type="button">
              <Plus aria-hidden="true" size={16} />
              Nueva entrada
            </Button>
          )
        }
        description="Lo recibido en la bodega, de la más reciente a la más antigua."
        title="Entradas de stock"
      />
      <ListStates
        toolbar={
          <>
            <SegmentedControl
              aria-label="Estado de la entrada"
              onChange={(value) => filters.set({ state: value })}
              options={[
                { value: '', label: 'Todas' },
                ...segments.map((value) => ({
                  value,
                  label: SEGMENT_LABELS[value],
                })),
              ]}
              value={state}
            />
            <FilterPanel
              bare
              className="mt-3"
              label="Filtros de entradas"
              layout="inline"
              {...(filters.filtered
                ? {
                    onClear: () =>
                      filters.set({
                        search: '',
                        state: '',
                        date_from: '',
                        date_to: '',
                        registered_by: '',
                      }),
                  }
                : {})}
            >
              <form className="contents" onSubmit={submit} role="search">
                <Field
                  id="purchase-search"
                  label="Número, referencia o proveedor"
                >
                  <Input
                    id="purchase-search"
                    onChange={(event) => setText(event.target.value)}
                    placeholder="COM-ING, referencia o proveedor…"
                    value={text}
                  />
                </Field>
                <Button type="submit" variant="secondary">
                  Buscar
                </Button>
              </form>
              <Field id="purchase-date-from" label="Desde">
                <Input
                  id="purchase-date-from"
                  onChange={(event) =>
                    filters.set({ date_from: event.target.value })
                  }
                  type="date"
                  value={filters.get('date_from')}
                />
              </Field>
              <Field id="purchase-date-to" label="Hasta">
                <Input
                  id="purchase-date-to"
                  onChange={(event) =>
                    filters.set({ date_to: event.target.value })
                  }
                  type="date"
                  value={filters.get('date_to')}
                />
              </Field>
              {(people.length > 1 || filters.getNumber('registered_by')) && (
                <Field id="purchase-user" label="Registró">
                  <Select
                    id="purchase-user"
                    onChange={(event) =>
                      filters.set({ registered_by: event.target.value })
                    }
                    value={filters.get('registered_by')}
                  >
                    <option value="">Todos</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </FilterPanel>
          </>
        }
        emptyText="Aún no hay entradas registradas."
        emptyTitle="No hay entradas"
        errorText="No fue posible consultar las entradas. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando entradas…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<PurchaseSummary>
            actions={(row) => (
              <DropdownMenu
                items={[
                  {
                    id: 'view',
                    label: 'Ver entrada',
                    icon: <Eye aria-hidden="true" size={16} />,
                    onClick: () => openDetail(row),
                  },
                ]}
                trigger={
                  <IconButton
                    icon={<DotsThreeVertical size={20} weight="bold" />}
                    label={`Acciones de ${row.internal_number ?? 'entrada sin número'}`}
                  />
                }
              />
            )}
            columns={[
              {
                header: 'Número',
                key: 'internal_number',
                priority: 'primary',
                render: (row) =>
                  row.internal_number ? (
                    <span className="font-mono font-medium text-ink">
                      {row.internal_number}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Sin número</span>
                  ),
              },
              {
                header: 'Fecha y hora',
                key: 'moment',
                priority: 'secondary',
                render: (row) => timestamp(row.moment),
              },
              {
                header: 'Registró',
                key: 'registered_by',
                priority: 'secondary',
                render: (row) => row.registered_by?.name ?? '—',
              },
              {
                header: 'Contenido',
                key: 'product_count',
                priority: 'secondary',
                render: (row) =>
                  `${count(row.product_count, 'producto', 'productos')} · ${count(row.unit_count, 'unidad', 'unidades')}`,
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'secondary',
                render: (row) => <PurchaseStateBadge state={row.state} />,
              },
            ]}
            getRowKey={(row) => row.id}
            label="Entradas de stock"
            onRowClick={openDetail}
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

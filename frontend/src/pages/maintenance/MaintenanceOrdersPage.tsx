import {
  DotsThreeVertical,
  Eye,
  NotePencil,
  Plus,
  Wrench,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { BillingCell } from '@/features/maintenance/BillingCell'
import {
  documentDate,
  kilometers,
  OrderStateBadge,
} from '@/features/maintenance/format'
import { useMaintenanceOrders } from '@/features/maintenance/hooks'
import { NewMaintenanceDialog } from '@/features/maintenance/NewMaintenanceDialog'
import type {
  OrderListItem,
  OrderStateFilter,
} from '@/features/maintenance/types'
import { useIssuerBrand } from '@/shared/api/entity-logos'
import {
  Button,
  DropdownMenu,
  ElevatedDataList,
  Field,
  FilterPanel,
  IconButton,
  Input,
  Money,
  PageHeader,
  PlateTag,
  SearchInput,
  SegmentedControl,
  VehicleTile,
} from '@/shared/ui'

/** Cuántas tarjetas caben en «En el taller ahora» antes de pedir la lista completa. */
const OPEN_TILES = 12

function InWorkshopNow({
  query,
  onNew,
}: {
  query: ReturnType<typeof useMaintenanceOrders>
  onNew: (() => void) | null
}) {
  if (query.isPending || query.isError || !query.data) return null
  const { results, count } = query.data
  if (results.length === 0 && !onNew) return null
  return (
    <section aria-labelledby="in-workshop-now" className="space-y-3">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-block font-bold" id="in-workshop-now">
          En el taller ahora
        </h2>
        <span className="text-label text-ink-muted">
          {count === 1 ? '1 abierto' : `${count} abiertos`}
        </span>
      </div>
      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {results.map((order) => (
          <VehicleTile
            className="w-64 shrink-0"
            corner={`N.º ${order.number}`}
            footer={`${order.state === 'REOPENED' ? 'Reabierto' : 'Abierto'} · ${documentDate(order.opened_on)}`}
            footerEnd={<Money amount={order.services_total} />}
            key={order.id}
            plate={order.vehicle.plate}
            subtitle={`${order.vehicle.brand} ${order.vehicle.model}`.trim()}
            title={order.customer.name}
            to={`/maintenance/${order.id}`}
          />
        ))}
        {onNew && (
          <button
            className="flex min-h-36 w-52 shrink-0 items-center justify-center rounded-card border-[1.5px] border-dashed border-line-dashed text-body font-semibold text-ink-muted hover:text-ink"
            onClick={onNew}
            type="button"
          >
            + Recibir vehículo
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * Mantenimientos: los vehículos que están en el taller, segmentos por estado con su contador y
 * la lista con el cobro de cada negocio por separado. Búsqueda y filtros viven en la URL.
 */
export function MaintenanceOrdersPage() {
  const filters = useUrlFilters()
  const location = useLocation()
  const navigate = useNavigate()
  const [newOpen, setNewOpen] = useState(false)
  const canManage = new Set(useSession().data?.permissions ?? []).has(
    'mantenimientos.gestionar',
  )
  const state = filters.get('state') as OrderStateFilter | ''
  const business = useIssuerBrand('ARTESANAL').displayName
  // Va antes que la lista: es la misma consulta que usa «En el taller» del inicio.
  const openNow = useMaintenanceOrders({ state: 'OPEN', pageSize: OPEN_TILES })
  const query = useMaintenanceOrders({
    search: filters.search || undefined,
    state: state || undefined,
    dateFrom: filters.get('date_from') || undefined,
    dateTo: filters.get('date_to') || undefined,
    page: filters.page,
  })

  // El servidor cuenta cada segmento con la misma búsqueda y fechas, sin el estado elegido.
  const counts = query.data?.status_counts
  const count = (value: number | undefined) =>
    value === undefined ? {} : { count: value }

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        actions={
          canManage && (
            <Button onClick={() => setNewOpen(true)} type="button">
              <Plus aria-hidden="true" size={16} />
              Nuevo mantenimiento
            </Button>
          )
        }
        icon={<Wrench />}
        description="Cada vehículo que entró al taller, con lo cobrado de cada negocio."
        {...(business ? { eyebrow: business } : {})}
        title="Mantenimientos"
      />
      <InWorkshopNow
        onNew={canManage ? () => setNewOpen(true) : null}
        query={openNow}
      />
      <ListStates
        toolbar={
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[16rem] flex-1">
                <SearchInput
                  aria-label="Buscar mantenimientos"
                  onChange={(event) =>
                    filters.set({ search: event.target.value })
                  }
                  placeholder="Placa, cliente o número"
                  value={filters.search}
                  variant="underline"
                />
              </div>
              <SegmentedControl
                aria-label="Estado de la orden"
                onChange={(value) => filters.set({ state: value })}
                options={[
                  { value: '', label: 'Todos', ...count(counts?.all) },
                  { value: 'OPEN', label: 'Abiertos', ...count(counts?.open) },
                  {
                    value: 'REOPENED',
                    label: 'Reabiertos',
                    ...count(counts?.reopened),
                  },
                  {
                    value: 'FINALIZED',
                    label: 'Finalizados',
                    ...count(counts?.finalized),
                  },
                ]}
                value={state}
              />
            </div>
            <FilterPanel
              bare
              className="mt-3"
              label="Filtros de mantenimientos"
              layout="inline"
              {...(filters.filtered
                ? {
                    onClear: () =>
                      filters.set({
                        search: '',
                        state: '',
                        date_from: '',
                        date_to: '',
                      }),
                  }
                : {})}
            >
              <Field id="maintenance-date-from" label="Apertura desde">
                <Input
                  id="maintenance-date-from"
                  onChange={(event) =>
                    filters.set({ date_from: event.target.value })
                  }
                  type="date"
                  value={filters.get('date_from')}
                />
              </Field>
              <Field id="maintenance-date-to" label="Apertura hasta">
                <Input
                  id="maintenance-date-to"
                  onChange={(event) =>
                    filters.set({ date_to: event.target.value })
                  }
                  type="date"
                  value={filters.get('date_to')}
                />
              </Field>
            </FilterPanel>
          </>
        }
        emptyText="Aún no hay mantenimientos registrados."
        emptyTitle="No hay mantenimientos"
        errorText="No fue posible consultar los mantenimientos. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando mantenimientos…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<OrderListItem>
            actions={(row) => (
              <DropdownMenu
                items={[
                  {
                    id: 'view',
                    label: 'Abrir',
                    icon: <Eye aria-hidden="true" size={16} />,
                    onClick: () =>
                      navigate(`/maintenance/${row.id}`, {
                        state: { from: location.search },
                      }),
                  },
                  ...(row.state === 'REGISTERED' && canManage
                    ? [
                        {
                          id: 'edit',
                          label: 'Editar',
                          icon: <NotePencil aria-hidden="true" size={16} />,
                          onClick: () =>
                            navigate(`/maintenance/${row.id}/edit`),
                        },
                      ]
                    : []),
                ]}
                trigger={
                  <IconButton
                    icon={<DotsThreeVertical size={20} weight="bold" />}
                    label={`Acciones de ${row.number}`}
                  />
                }
              />
            )}
            columns={[
              {
                header: 'N.º',
                key: 'number',
                priority: 'primary',
                render: (row) => (
                  <span className="code font-bold text-ink">{row.number}</span>
                ),
              },
              {
                header: 'Vehículo',
                key: 'vehicle',
                priority: 'secondary',
                render: (row) => (
                  <span className="flex flex-col items-start gap-1">
                    <PlateTag plate={row.vehicle.plate} />
                    <span className="text-label text-ink-muted">
                      {row.vehicle.brand} {row.vehicle.model}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Cliente',
                key: 'customer',
                priority: 'secondary',
                render: (row) => (
                  <span className="font-semibold">{row.customer.name}</span>
                ),
              },
              {
                header: 'Abierto',
                key: 'opened_on',
                priority: 'secondary',
                render: (row) => (
                  <span className="leading-snug">
                    <span className="block">{documentDate(row.opened_on)}</span>
                    <span className="text-label text-ink-muted">
                      {kilometers(row.odometer_km)}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'secondary',
                render: (row) => <OrderStateBadge state={row.state} />,
              },
              {
                header: 'Cobro',
                key: 'billing',
                priority: 'secondary',
                render: (row) => <BillingCell billing={row.billing} />,
              },
              {
                header: 'Servicios',
                key: 'services_total',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.services_total} className="font-bold" />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Mantenimientos"
            onRowClick={(row) =>
              navigate(`/maintenance/${row.id}`, {
                state: { from: location.search },
              })
            }
            rows={rows}
          />
        )}
      </ListStates>
      {newOpen && (
        <NewMaintenanceDialog onClose={() => setNewOpen(false)} open />
      )}
    </div>
  )
}

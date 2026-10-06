import { DotsThreeVertical, Eye, NotePencil, Plus } from '@phosphor-icons/react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  documentDate,
  kilometers,
  OrderStateBadge,
} from '@/features/maintenance/format'
import { useMaintenanceOrders } from '@/features/maintenance/hooks'
import type {
  OrderListItem,
  OrderState,
  OrderStateFilter,
} from '@/features/maintenance/types'
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
} from '@/shared/ui'

const SEGMENT_LABELS: Record<OrderState, string> = {
  REGISTERED: 'Registradas',
  REOPENED: 'Reabiertas',
  FINALIZED: 'Finalizadas',
}

/** Órdenes de mantenimiento del RUC artesanal con búsqueda y filtros en la URL. */
export function MaintenanceOrdersPage() {
  const filters = useUrlFilters()
  const location = useLocation()
  const navigate = useNavigate()
  const canManage = new Set(useSession().data?.permissions ?? []).has(
    'mantenimientos.gestionar',
  )
  const state = filters.get('state') as OrderStateFilter | ''
  const query = useMaintenanceOrders({
    search: filters.search || undefined,
    state: state || undefined,
    dateFrom: filters.get('date_from') || undefined,
    dateTo: filters.get('date_to') || undefined,
    page: filters.page,
  })

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        actions={
          canManage && (
            <Button onClick={() => navigate('/maintenance/new')} type="button">
              <Plus aria-hidden="true" size={16} />
              Nueva orden
            </Button>
          )
        }
        description="Órdenes de mantenimiento del RUC artesanal. El total de servicios es operativo: no es un cobro ni una factura."
        title="Mantenimientos"
      />
      <ListStates
        toolbar={
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[16rem] flex-1">
                <SearchInput
                  aria-label="Buscar órdenes"
                  onChange={(event) =>
                    filters.set({ search: event.target.value })
                  }
                  placeholder="Número, cliente o placa"
                  value={filters.search}
                />
              </div>
              <SegmentedControl
                aria-label="Estado de la orden"
                onChange={(value) => filters.set({ state: value })}
                options={[
                  { value: '', label: 'Todas' },
                  { value: 'OPEN', label: 'Abiertas' },
                  ...(Object.keys(SEGMENT_LABELS) as OrderState[]).map(
                    (value) => ({ value, label: SEGMENT_LABELS[value] }),
                  ),
                ]}
                value={state}
              />
            </div>
            <FilterPanel
              bare
              className="mt-3"
              label="Filtros de órdenes"
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
        emptyText="Aún no hay órdenes de mantenimiento registradas."
        emptyTitle="No hay órdenes"
        errorText="No fue posible consultar las órdenes. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando órdenes…"
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
                    label: 'Ver orden',
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
                          label: 'Editar orden',
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
                header: 'Número',
                key: 'number',
                priority: 'primary',
                render: (row) => (
                  <span className="font-mono font-medium text-ink">
                    {row.number}
                  </span>
                ),
              },
              {
                header: 'Apertura',
                key: 'opened_on',
                priority: 'secondary',
                render: (row) => documentDate(row.opened_on),
              },
              {
                header: 'Cliente',
                key: 'customer',
                priority: 'secondary',
                render: (row) => row.customer.name,
              },
              {
                header: 'Vehículo',
                key: 'vehicle',
                priority: 'secondary',
                render: (row) => <PlateTag plate={row.vehicle.plate} />,
              },
              {
                header: 'Kilometraje',
                key: 'odometer_km',
                priority: 'secondary',
                align: 'end',
                render: (row) => kilometers(row.odometer_km),
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'secondary',
                render: (row) => <OrderStateBadge state={row.state} />,
              },
              {
                header: 'Servicios USD',
                key: 'services_total',
                priority: 'secondary',
                align: 'end',
                render: (row) => <Money amount={row.services_total} />,
              },
            ]}
            getRowKey={(row) => row.id}
            label="Órdenes de mantenimiento"
            onRowClick={(row) =>
              navigate(`/maintenance/${row.id}`, {
                state: { from: location.search },
              })
            }
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

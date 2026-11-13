import {
  DotsThreeVertical,
  Eye,
  NotePencil,
  Plus,
  Receipt,
} from '@phosphor-icons/react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  documentDate,
  PaymentStateBadge,
  SaleOriginLabel,
  SaleStateBadge,
} from '@/features/sales/format'
import { useSales } from '@/features/sales/hooks'
import { useCustomerPickerOptions } from '@/features/sales/pickers'
import {
  conditionLabels,
  paymentStateLabels,
  type PaymentState,
  type SaleOriginType,
  type SaleState,
  type SaleSummary,
} from '@/features/sales/types'
import {
  Button,
  Combobox,
  DropdownMenu,
  ElevatedDataList,
  Field,
  FilterPanel,
  Input,
  IconButton,
  Money,
  PageHeader,
  SegmentedControl,
  Select,
} from '@/shared/ui'

/** Estados como filtros de la lista, en plural. */
const SEGMENT_LABELS: Record<SaleState, string> = {
  DRAFT: 'Borradores',
  CONFIRMED: 'Confirmadas',
  VOIDED: 'Anuladas',
}

/** Lista de ventas comerciales con filtros en la URL que se conservan al volver del detalle. */
export function SalesPage() {
  const filters = useUrlFilters()
  const location = useLocation()
  const navigate = useNavigate()
  const canCreate = new Set(useSession().data?.permissions ?? []).has(
    'ventas.crear',
  )
  const state = filters.get('state') as SaleState | ''
  const paymentState = filters.get('payment_state') as PaymentState | ''
  const customerId = filters.getNumber('customer_id')
  const customerName = filters.get('customer_name')
  const origin = filters.get('origin') as SaleOriginType | ''
  const query = useSales({
    customerId,
    origin: origin || undefined,
    state: state || undefined,
    paymentState: paymentState || undefined,
    dateFrom: filters.get('date_from') || undefined,
    dateTo: filters.get('date_to') || undefined,
    page: filters.page,
  })

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        icon={<Receipt />}
        actions={
          canCreate && (
            <Button onClick={() => navigate('/sales/new')} type="button">
              <Plus aria-hidden="true" size={16} />
              Nueva venta
            </Button>
          )
        }
        description="Ventas de repuestos del RUC comercial. Confirmar descuenta el inventario y no registra ningún cobro."
        title="Ventas"
      />
      <ListStates
        toolbar={
          <>
            <SegmentedControl
              aria-label="Estado de la venta"
              onChange={(value) => filters.set({ state: value })}
              options={[
                { value: '', label: 'Todas' },
                ...(Object.keys(SEGMENT_LABELS) as SaleState[]).map(
                  (value) => ({
                    value,
                    label: SEGMENT_LABELS[value],
                  }),
                ),
              ]}
              value={state}
            />
            <FilterPanel
              bare
              className="mt-3"
              label="Filtros de ventas"
              layout="inline"
              {...(filters.filtered
                ? {
                    onClear: () =>
                      filters.set({
                        customer_id: '',
                        customer_name: '',
                        state: '',
                        payment_state: '',
                        origin: '',
                        date_from: '',
                        date_to: '',
                      }),
                  }
                : {})}
            >
              <div className="ui-field">
                <label
                  className="block text-label font-semibold text-ink"
                  htmlFor="sales-filter-customer"
                >
                  Cliente
                </label>
                <div className="mt-1.5">
                  <Combobox
                    clearable
                    id="sales-filter-customer"
                    inactiveHelp="Cliente inactivo."
                    label="Cliente"
                    onSelect={(option) =>
                      filters.set({
                        customer_id: option?.id,
                        customer_name: option?.label,
                      })
                    }
                    placeholder="Nombre o identificación"
                    selected={
                      customerId
                        ? {
                            id: customerId,
                            label: customerName || `Cliente ${customerId}`,
                          }
                        : null
                    }
                    useOptions={useCustomerPickerOptions}
                  />
                </div>
              </div>
              <Field id="sales-payment-state" label="Estado de pago">
                <Select
                  id="sales-payment-state"
                  onChange={(event) =>
                    filters.set({ payment_state: event.target.value })
                  }
                  value={paymentState}
                >
                  <option value="">Todos</option>
                  {(Object.keys(paymentStateLabels) as PaymentState[]).map(
                    (value) => (
                      <option key={value} value={value}>
                        {paymentStateLabels[value]}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field id="sales-origin" label="Origen">
                <Select
                  id="sales-origin"
                  onChange={(event) =>
                    filters.set({ origin: event.target.value })
                  }
                  value={origin}
                >
                  <option value="">Todos</option>
                  <option value="DIRECT">Venta directa</option>
                  <option value="MAINTENANCE">Mantenimiento</option>
                  <option value="PROFORMA">Proforma</option>
                </Select>
              </Field>
              <Field id="sales-date-from" label="Fecha desde">
                <Input
                  id="sales-date-from"
                  onChange={(event) =>
                    filters.set({ date_from: event.target.value })
                  }
                  type="date"
                  value={filters.get('date_from')}
                />
              </Field>
              <Field id="sales-date-to" label="Fecha hasta">
                <Input
                  id="sales-date-to"
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
        emptyText="Aún no hay ventas registradas."
        emptyTitle="No hay ventas"
        errorText="No fue posible consultar las ventas. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando ventas…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<SaleSummary>
            actions={(row) => (
              <DropdownMenu
                items={[
                  {
                    id: 'view',
                    label: 'Ver venta',
                    icon: <Eye aria-hidden="true" size={16} />,
                    onClick: () =>
                      navigate(`/sales/${row.id}`, {
                        state: { from: location.search },
                      }),
                  },
                  ...(row.state === 'DRAFT' && canCreate
                    ? [
                        {
                          id: 'edit',
                          label: 'Editar borrador',
                          icon: <NotePencil aria-hidden="true" size={16} />,
                          onClick: () => navigate(`/sales/${row.id}/edit`),
                        },
                      ]
                    : []),
                ]}
                trigger={
                  <IconButton
                    icon={<DotsThreeVertical size={20} weight="bold" />}
                    label={`Acciones de ${row.internal_number || 'venta sin número'}`}
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
                    <span className="code font-medium text-ink">
                      {row.internal_number}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Sin número</span>
                  ),
              },
              {
                header: 'Fecha',
                key: 'sale_date',
                priority: 'secondary',
                render: (row) => documentDate(row.sale_date),
              },
              {
                header: 'Origen',
                key: 'origin',
                priority: 'secondary',
                render: (row) => <SaleOriginLabel origin={row.origin} />,
              },
              {
                header: 'Cliente',
                key: 'customer',
                priority: 'secondary',
                render: (row) => row.customer.name ?? '—',
              },
              {
                header: 'Condición',
                key: 'condition',
                priority: 'secondary',
                render: (row) => conditionLabels[row.condition],
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'secondary',
                render: (row) => <SaleStateBadge state={row.state} />,
              },
              {
                header: 'Pago',
                key: 'money',
                priority: 'secondary',
                render: (row) =>
                  row.state === 'DRAFT' || row.state === 'VOIDED' ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <PaymentStateBadge state={row.money.payment_state} />
                  ),
              },
              {
                header: 'Total USD',
                key: 'grand_total',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.grand_total} className="font-semibold" />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Ventas"
            onRowClick={(row) =>
              navigate(`/sales/${row.id}`, {
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

import {
  DotsThreeVertical,
  Eye,
  NotePencil,
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
  SalesActions,
  SalesOverview,
  SalesTabs,
} from '@/features/sales/SalesOverview'
import {
  conditionLabels,
  paymentStateLabels,
  type PaymentState,
  type SaleOriginType,
  type SaleState,
  type SaleSummary,
} from '@/features/sales/types'
import { useIssuerBrand } from '@/shared/api/entity-logos'
import {
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

const timeFormat = new Intl.DateTimeFormat('es-EC', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Guayaquil',
})

/** Hora de confirmación de la venta; sin ella, la del borrador. */
function saleTime(row: SaleSummary): string | null {
  const stamp = row.confirmed_at ?? row.created_at
  if (!stamp) return null
  const date = new Date(stamp)
  return Number.isNaN(date.getTime()) ? null : timeFormat.format(date)
}

function PaymentCell({ row }: { row: SaleSummary }) {
  if (row.state === 'DRAFT' || row.state === 'VOIDED')
    return <span className="text-ink-muted">—</span>
  if (row.money.payment_state === 'PAID')
    return <PaymentStateBadge state={row.money.payment_state} />
  return (
    <span className="flex flex-col items-start gap-0.5">
      <PaymentStateBadge state={row.money.payment_state} />
      <span className="text-label font-semibold text-danger">
        Debe <Money amount={row.money.balance} />
      </span>
    </span>
  )
}

/**
 * Ventas del negocio de repuestos: indicadores del día, segmentos por estado y la lista con su
 * forma de pago y su cobro. Los filtros viven en la URL y se conservan al volver del detalle.
 */
export function SalesPage() {
  const filters = useUrlFilters()
  const location = useLocation()
  const navigate = useNavigate()
  const canCreate = new Set(useSession().data?.permissions ?? []).has(
    'ventas.crear',
  )
  const business = useIssuerBrand('COMERCIAL').displayName
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
        actions={<SalesActions />}
        description="Lo vendido en mostrador y lo que quedaron debiendo."
        {...(business ? { eyebrow: business } : {})}
        title="Ventas"
      />
      <SalesOverview />
      <SalesTabs active="sales" />
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
                header: 'Venta',
                key: 'internal_number',
                priority: 'primary',
                render: (row) => (
                  <span className="leading-snug">
                    {row.internal_number ? (
                      <span className="code block font-bold text-ink">
                        {row.internal_number}
                      </span>
                    ) : (
                      <span className="block text-ink-muted">Borrador</span>
                    )}
                    <span className="text-label text-ink-muted">
                      {documentDate(row.sale_date)}
                      {saleTime(row) && ` · ${saleTime(row)}`}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Cliente',
                key: 'customer',
                priority: 'secondary',
                render: (row) => (
                  <span className="leading-snug">
                    <span className="block font-semibold">
                      {row.customer.name ?? '—'}
                    </span>
                    <span className="text-label text-ink-muted">
                      <SaleOriginLabel origin={row.origin} />
                    </span>
                  </span>
                ),
              },
              {
                header: 'Forma de pago',
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
                header: 'Cobro',
                key: 'money',
                priority: 'secondary',
                render: (row) => <PaymentCell row={row} />,
              },
              {
                header: 'Total',
                key: 'grand_total',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.grand_total} className="font-bold" />
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

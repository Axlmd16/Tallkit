import { Plus, Receipt } from '@phosphor-icons/react'
import { useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  documentDate,
  PaymentStateBadge,
  SaleStateBadge,
  usd,
} from '@/features/sales/format'
import { useSales } from '@/features/sales/hooks'
import { useCustomerPickerOptions } from '@/features/sales/pickers'
import { ReferencePicker } from '@/features/sales/ReferencePicker'
import {
  conditionLabels,
  paymentStateLabels,
  saleStateLabels,
  type PaymentState,
  type SaleState,
  type SaleSummary,
} from '@/features/sales/types'
import {
  Button,
  ElevatedDataList,
  Field,
  FilterPanel,
  FiscalScopeBadge,
  Input,
  PageHeader,
  Select,
} from '@/shared/ui'

/** Lista de ventas comerciales con filtros en la URL que se conservan al volver del detalle. */
export function SalesPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const canCreate = new Set(useSession().data?.permissions ?? []).has(
    'ventas.crear',
  )
  const state = filters.get('state') as SaleState | ''
  const paymentState = filters.get('payment_state') as PaymentState | ''
  const customerId = filters.getNumber('customer_id')
  const customerName = filters.get('customer_name')
  const query = useSales({
    customerId,
    state: state || undefined,
    paymentState: paymentState || undefined,
    dateFrom: filters.get('date_from') || undefined,
    dateTo: filters.get('date_to') || undefined,
    page: filters.page,
  })

  return (
    <div className="catalog-page list-page space-y-6">
      <PageHeader
        actions={
          canCreate && (
            <Button onClick={() => navigate('/sales/new')} type="button">
              <Plus aria-hidden="true" size={16} />
              Nueva venta
            </Button>
          )
        }
        description="Ventas directas de repuestos del ámbito comercial. Confirmar descuenta el inventario y no registra ningún cobro."
        title="Ventas"
      />
      <FiscalScopeBadge scope="commercial" />
      <FilterPanel
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
                  date_from: '',
                  date_to: '',
                }),
            }
          : {})}
      >
        <ReferencePicker
          id="sales-filter-customer"
          inactiveHelp="Cliente inactivo."
          label="Cliente"
          onSelect={(option) =>
            filters.set({
              customer_id: option?.id,
              customer_name: option?.label,
            })
          }
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
        <Field id="sales-state" label="Estado de la venta">
          <Select
            id="sales-state"
            onChange={(event) => filters.set({ state: event.target.value })}
            value={state}
          >
            <option value="">Todos</option>
            {(Object.keys(saleStateLabels) as SaleState[]).map((value) => (
              <option key={value} value={value}>
                {saleStateLabels[value]}
              </option>
            ))}
          </Select>
        </Field>
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
        <Field id="sales-date-from" label="Fecha desde">
          <Input
            id="sales-date-from"
            onChange={(event) => filters.set({ date_from: event.target.value })}
            type="date"
            value={filters.get('date_from')}
          />
        </Field>
        <Field id="sales-date-to" label="Fecha hasta">
          <Input
            id="sales-date-to"
            onChange={(event) => filters.set({ date_to: event.target.value })}
            type="date"
            value={filters.get('date_to')}
          />
        </Field>
      </FilterPanel>
      <ListStates
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
            columns={[
              {
                header: 'Número interno',
                key: 'internal_number',
                priority: 'primary',
                render: (row) => (
                  <span className="flex items-center gap-2.5 font-semibold text-ink">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-soft text-cyan">
                      <Receipt aria-hidden="true" size={17} weight="fill" />
                    </span>
                    {row.internal_number ?? 'Borrador'}
                  </span>
                ),
              },
              {
                header: 'Cliente',
                key: 'customer',
                priority: 'secondary',
                render: (row) => row.customer.name ?? '—',
              },
              {
                header: 'Origen',
                key: 'origin',
                priority: 'secondary',
                render: () => 'Venta directa',
              },
              {
                header: 'Fecha',
                key: 'sale_date',
                priority: 'secondary',
                render: (row) => documentDate(row.sale_date),
              },
              {
                header: 'Condición',
                key: 'condition',
                priority: 'secondary',
                render: (row) => conditionLabels[row.condition],
              },
              {
                header: 'Total',
                key: 'grand_total',
                priority: 'secondary',
                render: (row) => usd(row.grand_total),
              },
              {
                header: 'Venta',
                key: 'state',
                priority: 'secondary',
                render: (row) => <SaleStateBadge state={row.state} />,
              },
              {
                header: 'Pago',
                key: 'money',
                priority: 'secondary',
                render: (row) => (
                  <PaymentStateBadge state={row.money.payment_state} />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Ventas"
            onRowClick={(row) =>
              navigate(`/sales/${row.id}${window.location.search}`)
            }
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

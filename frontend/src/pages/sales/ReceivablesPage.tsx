import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { documentDate, PaymentStateBadge, usd } from '@/features/sales/format'
import { useReceivables } from '@/features/sales/hooks'
import { useCustomerPickerOptions } from '@/features/sales/pickers'
import { ReferencePicker } from '@/features/sales/ReferencePicker'
import type { PaymentState, SaleSummary } from '@/features/sales/types'
import {
  ElevatedDataList,
  Field,
  FilterPanel,
  FiscalScopeBadge,
  InlineNotice,
  Input,
  PageHeader,
  Select,
} from '@/shared/ui'
import { Link } from 'react-router'

/**
 * Cuentas por cobrar comerciales. Deuda cobrable y exceso por reembolsar son columnas y
 * totales separados: nunca se restan ni se presentan como saldo a favor. La antigüedad
 * cuenta días desde la confirmación, sin vencimiento ni etiquetas de mora.
 */
export function ReceivablesPage() {
  const filters = useUrlFilters()
  const paymentState = filters.get('payment_state') as PaymentState | ''
  const customerId = filters.getNumber('customer_id')
  const query = useReceivables({
    customerId,
    paymentState: (paymentState || undefined) as PaymentState | undefined,
    minAgeDays: filters.getNumber('min_age_days'),
    page: filters.page,
  })
  const totals = query.data
  return (
    <div className="catalog-page list-page space-y-6">
      <PageHeader
        description="Deuda cobrable y reembolsos pendientes de las ventas comerciales confirmadas."
        title="Cuentas por cobrar"
      />
      <FiscalScopeBadge scope="commercial" />
      <FilterPanel
        label="Filtros de cuentas por cobrar"
        layout="inline"
        {...(filters.filtered
          ? {
              onClear: () =>
                filters.set({
                  customer_id: '',
                  customer_name: '',
                  payment_state: '',
                  min_age_days: '',
                }),
            }
          : {})}
      >
        <ReferencePicker
          id="receivables-customer"
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
                  label:
                    filters.get('customer_name') || `Cliente ${customerId}`,
                }
              : null
          }
          useOptions={useCustomerPickerOptions}
        />
        <Field id="receivables-state" label="Estado de pago">
          <Select
            id="receivables-state"
            onChange={(event) =>
              filters.set({ payment_state: event.target.value })
            }
            value={paymentState}
          >
            <option value="">Pendiente y parcial</option>
            <option value="PENDING">Pendiente</option>
            <option value="PARTIAL">Parcial</option>
          </Select>
        </Field>
        <Field id="receivables-age" label="Antigüedad mínima (días)">
          <Input
            id="receivables-age"
            inputMode="numeric"
            onChange={(event) =>
              filters.set({ min_age_days: event.target.value })
            }
            value={filters.get('min_age_days')}
          />
        </Field>
      </FilterPanel>
      {totals && (
        <section
          aria-label="Totales de todas las coincidencias"
          className="grid gap-4 sm:grid-cols-2"
        >
          <InlineNotice title="Deuda cobrable" tone="warning">
            <strong>{usd(totals.receivable_total)}</strong> en {totals.count}{' '}
            ventas (todas las coincidencias, no solo esta página).
          </InlineNotice>
          <InlineNotice title="Reembolsos pendientes" tone="info">
            <strong>{usd(totals.refund_due_total)}</strong>. No se resta de la
            deuda ni es saldo a favor utilizable.
          </InlineNotice>
        </section>
      )}
      <ListStates
        emptyText="No hay ventas con saldo por cobrar ni reembolsos pendientes."
        emptyTitle="Sin cuentas por cobrar"
        errorText="No fue posible consultar las cuentas por cobrar. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando cuentas por cobrar…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {/* La clave de columna solo identifica la celda; el contenido lo define `render`. */}
        {(rows) => (
          <ElevatedDataList<SaleSummary>
            columns={[
              {
                header: 'Venta',
                key: 'internal_number',
                priority: 'primary',
                render: (row) => (
                  <Link
                    className="font-semibold underline"
                    to={`/sales/${row.id}`}
                  >
                    {row.internal_number}
                  </Link>
                ),
              },
              {
                header: 'Cliente',
                key: 'customer',
                priority: 'secondary',
                render: (row) => row.customer.name ?? '—',
              },
              {
                header: 'Fecha de confirmación',
                key: 'sale_date',
                priority: 'secondary',
                render: (row) => documentDate(row.sale_date),
              },
              {
                header: 'Antigüedad',
                key: 'age_days',
                priority: 'secondary',
                render: (row) => `${row.age_days ?? 0} días`,
              },
              {
                header: 'Deuda cobrable',
                key: 'money',
                priority: 'secondary',
                render: (row) => usd(row.money.balance),
              },
              {
                header: 'Reembolso pendiente',
                key: 'grand_total',
                priority: 'secondary',
                render: (row) => usd(row.money.refund_due),
              },
              {
                header: 'Estado de pago',
                key: 'state',
                priority: 'secondary',
                render: (row) => (
                  <PaymentStateBadge state={row.money.payment_state} />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Cuentas por cobrar"
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

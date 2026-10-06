import { Link } from 'react-router'

import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { useArtisanReceivables } from '@/features/maintenance/billingHooks'
import type { ArtisanReceivableRow } from '@/features/maintenance/types'
import { documentDate, PaymentStateBadge } from '@/features/sales/format'
import type { PaymentState } from '@/features/sales/types'
import {
  ElevatedDataList,
  Field,
  FilterPanel,
  FiscalScopeBadge,
  Money,
  PageHeader,
  Select,
} from '@/shared/ui'

/**
 * Cuentas por cobrar del RUC artesanal (operaciones de servicios). Nunca incluye ventas
 * comerciales ni compensa saldos entre RUC; la antigüedad no expresa mora ni vencimiento.
 */
export function ArtisanReceivablesPage() {
  const filters = useUrlFilters()
  const paymentState = filters.get('payment_state') as PaymentState | ''
  const query = useArtisanReceivables({
    customerId: filters.getNumber('customer_id'),
    orderId: filters.getNumber('order_id'),
    paymentState: (paymentState || undefined) as PaymentState | undefined,
    page: filters.page,
  })
  const totals = query.data?.totals
  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        actions={
          <Link
            className="text-[13px] font-semibold text-accent hover:underline"
            to="/maintenance/withholdings"
          >
            Retenciones por completar
          </Link>
        }
        description="Saldos de servicios del RUC artesanal; los repuestos se consultan en las cuentas por cobrar comerciales."
        title="Cuentas por cobrar de servicios"
      />
      <FiscalScopeBadge scope="artesanal" />
      {totals && (
        <section
          aria-label="Totales de todas las coincidencias"
          className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-4"
        >
          {[
            ['Documentado', totals.grand_total],
            ['Cobrado en dinero', totals.paid],
            ['Retenido por clientes', totals.withheld ?? '0.00'],
            ['Saldo por cobrar', totals.balance],
          ].map(([label, amount]) => (
            <div className="bg-surface px-4 py-3" key={label}>
              <h2 className="text-xs font-semibold text-ink-muted">{label}</h2>
              <p className="mt-1 text-xl font-semibold">
                <Money amount={amount ?? null} />
              </p>
            </div>
          ))}
        </section>
      )}
      <ListStates
        toolbar={
          <FilterPanel
            bare
            label="Filtros de cuentas por cobrar de servicios"
            layout="inline"
            {...(filters.filtered
              ? {
                  onClear: () =>
                    filters.set({
                      payment_state: '',
                      customer_id: '',
                      order_id: '',
                    }),
                }
              : {})}
          >
            <Field id="artisan-receivables-state" label="Estado de pago">
              <Select
                id="artisan-receivables-state"
                onChange={(event) =>
                  filters.set({ payment_state: event.target.value })
                }
                value={paymentState}
              >
                <option value="">Pendiente y parcial</option>
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagado</option>
              </Select>
            </Field>
          </FilterPanel>
        }
        emptyText="No hay operaciones de servicios con saldo por cobrar."
        emptyTitle="Sin cuentas por cobrar de servicios"
        errorText="No fue posible consultar las cuentas por cobrar de servicios."
        filtered={filters.filtered}
        loadingLabel="Cargando cuentas por cobrar de servicios…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<ArtisanReceivableRow>
            columns={[
              {
                header: 'Operación',
                key: 'internal_number',
                priority: 'primary',
                render: (row) => (
                  <Link
                    className="font-mono font-semibold text-accent hover:underline"
                    to={`/maintenance/service-operations/${row.id}`}
                  >
                    {row.internal_number}
                  </Link>
                ),
              },
              {
                header: 'Orden',
                key: 'order_number',
                priority: 'secondary',
                render: (row) => (
                  <Link
                    className="font-mono hover:underline"
                    to={`/maintenance/${row.order_id}`}
                  >
                    {row.order_number}
                  </Link>
                ),
              },
              {
                header: 'Cliente',
                key: 'customer_name',
                priority: 'secondary',
                render: (row) => row.customer_name,
              },
              {
                header: 'Fecha de confirmación',
                key: 'operational_date',
                priority: 'secondary',
                render: (row) => documentDate(row.operational_date),
              },
              {
                header: 'Antigüedad',
                key: 'age_days',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <span className="tabular-nums">{`${row.age_days} días`}</span>
                ),
              },
              {
                header: 'Retenido',
                key: 'withheld',
                priority: 'secondary',
                align: 'end',
                render: (row) => <Money amount={row.withheld ?? '0.00'} />,
              },
              {
                header: 'Saldo',
                key: 'balance',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.balance} className="font-semibold" />
                ),
              },
              {
                header: 'Estado de pago',
                key: 'payment_state',
                priority: 'secondary',
                render: (row) => (
                  <PaymentStateBadge state={row.payment_state} />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Cuentas por cobrar de servicios"
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

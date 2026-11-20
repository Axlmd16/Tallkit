import { Coins } from '@phosphor-icons/react'
import { AccountsHeader } from '@/features/accounts/AccountsHeader'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { documentDate, PaymentStateBadge } from '@/features/sales/format'
import { useReceivables } from '@/features/sales/hooks'
import { useCustomerPickerOptions } from '@/features/sales/pickers'
import type {
  PaymentState,
  SaleCondition,
  SaleOriginType,
  SaleSummary,
} from '@/features/sales/types'
import {
  Combobox,
  ElevatedDataList,
  Field,
  FilterPanel,
  Input,
  Money,
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
  const origin = filters.get('origin') as SaleOriginType | ''
  const condition = filters.get('condition') as SaleCondition | ''
  const onlyDebt = filters.get('only_debt') === 'true'
  const query = useReceivables({
    customerId,
    origin: origin || undefined,
    paymentState: (paymentState || undefined) as PaymentState | undefined,
    minAgeDays: filters.getNumber('min_age_days'),
    condition: condition || undefined,
    onlyDebt: onlyDebt || undefined,
    page: filters.page,
  })
  const totals = query.data
  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        icon={<Coins />}
        description="Quién debe a cada negocio y las retenciones que te hicieron los clientes."
        title="Cuentas"
      />
      <AccountsHeader business="commercial" view="receivables" />
      {totals && (
        <section
          aria-label="Totales de todas las coincidencias"
          className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2"
        >
          <div className="bg-surface px-4 py-3">
            <h2 className="text-label font-semibold text-ink-muted">
              Deuda cobrable
            </h2>
            <p className="mt-1 text-block font-semibold text-ink">
              <Money amount={totals.receivable_total} />
            </p>
            <p className="mt-0.5 text-label text-ink-muted">
              en {totals.count} ventas (todas las coincidencias, no solo esta
              página).
            </p>
          </div>
          <div className="bg-surface px-4 py-3">
            <h2 className="text-label font-semibold text-ink-muted">
              Reembolsos pendientes
            </h2>
            <p className="mt-1 text-block font-semibold text-ink">
              <Money amount={totals.refund_due_total} />
            </p>
            <p className="mt-0.5 text-label text-ink-muted">
              No se resta de la deuda ni es saldo a favor utilizable.
            </p>
          </div>
        </section>
      )}
      <ListStates
        toolbar={
          <FilterPanel
            bare
            label="Filtros de cuentas por cobrar"
            layout="inline"
            {...(filters.filtered
              ? {
                  onClear: () =>
                    filters.set({
                      customer_id: '',
                      customer_name: '',
                      payment_state: '',
                      origin: '',
                      min_age_days: '',
                      condition: '',
                      only_debt: '',
                    }),
                }
              : {})}
          >
            <div className="ui-field">
              <label
                className="block text-label font-semibold text-ink"
                htmlFor="receivables-customer"
              >
                Cliente
              </label>
              <div className="mt-1.5">
                <Combobox
                  clearable
                  id="receivables-customer"
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
                          label:
                            filters.get('customer_name') ||
                            `Cliente ${customerId}`,
                        }
                      : null
                  }
                  useOptions={useCustomerPickerOptions}
                />
              </div>
            </div>
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
            <Field id="receivables-origin" label="Origen">
              <Select
                id="receivables-origin"
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
            <Field id="receivables-condition" label="Condición">
              <Select
                id="receivables-condition"
                onChange={(event) =>
                  filters.set({ condition: event.target.value })
                }
                value={condition}
              >
                <option value="">Contado y crédito</option>
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </Select>
            </Field>
            <Field id="receivables-show" label="Mostrar">
              <Select
                id="receivables-show"
                onChange={(event) =>
                  filters.set({ only_debt: event.target.value })
                }
                value={onlyDebt ? 'true' : ''}
              >
                <option value="">Deuda y reembolsos</option>
                <option value="true">Solo deuda</option>
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
        }
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
                    className="code font-semibold text-accent hover:underline"
                    to={`/sales/${row.id}`}
                  >
                    {row.internal_number}
                  </Link>
                ),
              },
              {
                header: 'Origen',
                key: 'origin',
                priority: 'secondary',
                render: (row) =>
                  row.origin?.type === 'MAINTENANCE'
                    ? `Mantenimiento ${row.origin.order_number ?? ''}`
                    : row.origin?.type === 'PROFORMA'
                      ? `Proforma ${row.origin.proforma_number ?? ''}`
                      : 'Directa',
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
                align: 'end',
                render: (row) => (
                  <span className="tabular-nums">{`${row.age_days ?? 0} días`}</span>
                ),
              },
              {
                header: 'Deuda cobrable',
                key: 'money',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.money.balance} className="font-semibold" />
                ),
              },
              {
                header: 'Retenido',
                // La clave solo identifica la celda; el contenido lo define `render`.
                key: 'version',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.money.withheld_total ?? '0.00'} />
                ),
              },
              {
                header: 'Reembolso pendiente',
                key: 'grand_total',
                priority: 'secondary',
                align: 'end',
                render: (row) => <Money amount={row.money.refund_due} />,
              },
              {
                header: 'Estado de pago',
                key: 'state',
                priority: 'secondary',
                render: (row) => (
                  <PaymentStateBadge state={row.money.payment_state} />
                ),
              },
              {
                header: 'Cobro',
                key: 'created_at',
                priority: 'secondary',
                render: (row) =>
                  Number(row.money.balance) > 0 ? (
                    <Link
                      className="ui-button inline-flex min-h-10 items-center rounded-control border border-ink px-3.5 text-body font-semibold text-ink hover:bg-ink hover:text-white"
                      to={`/sales/${row.id}`}
                    >
                      Registrar pago
                    </Link>
                  ) : null,
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

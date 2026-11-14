import { Link } from 'react-router'

import { useArtisanReceivables } from '@/features/maintenance/billingHooks'
import { documentDate } from '@/features/maintenance/format'
import { MaintenanceHistorySection } from '@/features/maintenance/MaintenanceHistorySection'
import { useReceivables, useSales } from '@/features/sales/hooks'
import { useBusinessName } from '@/shared/api/entity-logos'
import {
  InlineNotice,
  LoadingState,
  Money,
  type ScopeLabelScope,
} from '@/shared/ui'

import type { UseQueryResult } from '@tanstack/react-query'

const PREVIEW = 5

/** Un negocio con su nombre, su estado de carga y su propio contenido: nunca se mezclan. */
function BusinessBlock({
  scope,
  label,
  query,
  children,
}: {
  scope: ScopeLabelScope
  label: string
  query?: Pick<UseQueryResult, 'isPending' | 'isError' | 'refetch'>
  children: React.ReactNode
}) {
  const name = useBusinessName(scope)
  return (
    <section
      aria-label={`${label}: ${name}`}
      className="rounded-panel border border-line bg-surface"
    >
      <h3 className="border-b border-line px-4 py-3 text-body font-semibold text-ink">
        {name}
      </h3>
      <div className="p-4">
        {query?.isPending ? (
          <LoadingState label="Cargando…" />
        ) : query?.isError ? (
          <InlineNotice title="No se pudo cargar" tone="danger">
            <button
              className="font-semibold underline"
              onClick={() => void query.refetch()}
              type="button"
            >
              Reintentar
            </button>
          </InlineNotice>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

function Empty({ children }: { children: string }) {
  return <p className="text-body text-ink-muted">{children}</p>
}

function CommercialPurchases({ customerId }: { customerId: number }) {
  const query = useSales({ customerId, pageSize: PREVIEW })
  const rows = query.data?.results ?? []
  return (
    <BusinessBlock label="Compras" query={query} scope="commercial">
      {rows.length === 0 ? (
        <Empty>Este cliente no tiene ventas de repuestos.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((sale) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-body"
              key={sale.id}
            >
              <div>
                <Link
                  className="code font-semibold text-ink hover:text-accent hover:underline"
                  to={`/sales/${sale.id}`}
                >
                  {sale.internal_number ?? `Borrador ${sale.id}`}
                </Link>
                <span className="ml-2 text-ink-muted">
                  {documentDate(sale.sale_date)}
                </span>
              </div>
              <Money amount={sale.grand_total} />
            </li>
          ))}
        </ul>
      )}
    </BusinessBlock>
  )
}

function CommercialDebt({ customerId }: { customerId: number }) {
  const query = useReceivables({
    customerId,
    onlyDebt: true,
    pageSize: PREVIEW,
  })
  const rows = query.data?.results ?? []
  return (
    <BusinessBlock label="Deuda" query={query} scope="commercial">
      <p className="mb-3 flex items-baseline justify-between gap-3 text-body">
        <span className="text-ink-muted">Total a pagar</span>
        <Money
          amount={query.data?.receivable_total}
          className="text-block font-semibold"
        />
      </p>
      {rows.length === 0 ? (
        <Empty>Este cliente no debe nada en este negocio.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((sale) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-body"
              key={sale.id}
            >
              <Link
                className="code font-semibold text-ink hover:text-accent hover:underline"
                to={`/sales/${sale.id}`}
              >
                {sale.internal_number ?? sale.id}
              </Link>
              <Money amount={sale.money.balance} />
            </li>
          ))}
        </ul>
      )}
    </BusinessBlock>
  )
}

function ArtisanDebt({ customerId }: { customerId: number }) {
  const query = useArtisanReceivables({ customerId, pageSize: PREVIEW })
  const rows = (query.data?.results ?? []).filter(
    (row) => Number(row.balance) > 0,
  )
  return (
    <BusinessBlock label="Deuda" query={query} scope="artesanal">
      <p className="mb-3 flex items-baseline justify-between gap-3 text-body">
        <span className="text-ink-muted">Total a pagar</span>
        <Money
          amount={query.data?.totals.balance}
          className="text-block font-semibold"
        />
      </p>
      {rows.length === 0 ? (
        <Empty>Este cliente no debe nada en este negocio.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-body"
              key={row.id}
            >
              <Link
                className="code font-semibold text-ink hover:text-accent hover:underline"
                to={`/maintenance/service-operations/${row.id}`}
              >
                {row.internal_number}
              </Link>
              <Money amount={row.balance} />
            </li>
          ))}
        </ul>
      )}
    </BusinessBlock>
  )
}

/** Permisos que abren cada bloque; cada negocio se consulta solo con el suyo. */
export function customerAccountAccess(permissions: ReadonlySet<string>) {
  return {
    commercialPurchases: permissions.has('ventas.ver'),
    artisanPurchases: permissions.has('mantenimientos.ver'),
    commercialDebt: permissions.has('pagos_comerciales.ver'),
    artisanDebt: permissions.has('pagos_artesanales.ver'),
  }
}

/** Compras del cliente: un bloque por negocio, sin sumar ni mezclar. */
export function CustomerPurchases({
  customer,
  permissions,
}: {
  customer: { id: number; name: string; is_active: boolean }
  permissions: ReadonlySet<string>
}) {
  const access = customerAccountAccess(permissions)
  return (
    <div className="space-y-4">
      {access.commercialPurchases && (
        <CommercialPurchases customerId={customer.id} />
      )}
      {access.artisanPurchases && (
        <MaintenanceHistorySection
          canCreate={
            customer.is_active && permissions.has('mantenimientos.gestionar')
          }
          customer={{ id: customer.id, name: customer.name }}
        />
      )}
    </div>
  )
}

/** Deuda del cliente: un bloque por negocio con su propio total; nunca un total conjunto. */
export function CustomerDebt({
  customerId,
  permissions,
}: {
  customerId: number
  permissions: ReadonlySet<string>
}) {
  const access = customerAccountAccess(permissions)
  return (
    <div className="space-y-4">
      {access.commercialDebt && <CommercialDebt customerId={customerId} />}
      {access.artisanDebt && <ArtisanDebt customerId={customerId} />}
    </div>
  )
}

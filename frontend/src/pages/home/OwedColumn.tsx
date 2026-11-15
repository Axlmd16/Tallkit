import { Link } from 'react-router'

import { useArtisanReceivables } from '@/features/maintenance/billingHooks'
import { documentDate } from '@/features/maintenance/format'
import { useReceivables } from '@/features/sales/hooks'
import type { SaleCondition } from '@/features/sales/types'
import { useIssuerBrand } from '@/shared/api/entity-logos'
import {
  BusinessMark,
  ErrorState,
  Money,
  SkeletonRows,
  StatusBadge,
} from '@/shared/ui'

import { cardClass, Column } from './Column'

interface OwedRow {
  key: string
  scope: 'commercial' | 'artesanal'
  to: string
  number: string
  customer: string
  date: string
  balance: string
  condition: SaleCondition
  ageDays: number | undefined
  canCollect: boolean
}

const MAX_CARDS = 5

function BusinessTag({ scope }: { scope: OwedRow['scope'] }) {
  const brand = useIssuerBrand(
    scope === 'commercial' ? 'COMERCIAL' : 'ARTESANAL',
  )
  const name =
    brand.displayName ?? (scope === 'commercial' ? 'Repuestos' : 'Servicios')
  return (
    <span className="flex items-center gap-2 text-label font-semibold text-ink-muted">
      <BusinessMark
        decorative
        logoUrl={brand.logoUrl}
        name={name}
        scope={scope}
        size="sm"
      />
      {name}
    </span>
  )
}

function Term({ row }: { row: OwedRow }) {
  if (row.condition === 'CONTADO')
    return <StatusBadge label="De contado, sin cobrar" tone="danger" />
  const days = row.ageDays ?? 0
  return (
    <StatusBadge
      label={days > 0 ? `A crédito · ${days} d` : 'A crédito'}
      tone={days > 30 ? 'warning' : 'neutral'}
    />
  )
}

function OwedCard({ row }: { row: OwedRow }) {
  return (
    <div className={cardClass}>
      <BusinessTag scope={row.scope} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 leading-snug">
          <div className="truncate font-bold">{row.customer}</div>
          <div className="text-label text-ink-muted">
            <span className="code">{row.number}</span> ·{' '}
            {documentDate(row.date)}
          </div>
        </div>
        <Money
          amount={row.balance}
          className="text-block font-semibold tracking-tight"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Term row={row} />
        {row.canCollect ? (
          <Link
            className="ui-button inline-flex min-h-10 items-center rounded-control border border-ink px-3.5 text-body font-semibold text-ink hover:bg-ink hover:text-white"
            to={row.to}
          >
            Cobrar
          </Link>
        ) : (
          <Link
            className="text-body font-semibold text-accent hover:underline"
            to={row.to}
          >
            Ver
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * «Falta cobrar»: las cuentas con deuda de cada negocio permitido. Las tarjetas de los dos
 * negocios se ordenan juntas por fecha solo para listarlas; cada una lleva su negocio y su saldo
 * y no hay ningún total conjunto. «Cobrar» abre la cuenta, donde está el cobro de siempre.
 */
export function OwedColumn({
  commercial,
  artisan,
  canCollectCommercial,
  canCollectArtisan,
}: {
  commercial: boolean
  artisan: boolean
  canCollectCommercial: boolean
  canCollectArtisan: boolean
}) {
  const sales = useReceivables(
    { onlyDebt: true, pageSize: MAX_CARDS },
    commercial,
  )
  const services = useArtisanReceivables({ pageSize: 20 }, artisan)

  const rows: OwedRow[] = []
  if (commercial && sales.data) {
    for (const sale of sales.data.results) {
      rows.push({
        key: `c${sale.id}`,
        scope: 'commercial',
        to: `/sales/${sale.id}`,
        number: sale.internal_number ?? String(sale.id),
        customer: sale.customer.name ?? '',
        date: sale.sale_date,
        balance: sale.money.balance ?? '0.00',
        condition: sale.condition,
        ageDays: sale.age_days,
        canCollect: canCollectCommercial,
      })
    }
  }
  const owedServices = (services.data?.results ?? []).filter(
    (row) => Number(row.balance) > 0,
  )
  if (artisan) {
    for (const row of owedServices) {
      rows.push({
        key: `a${row.id}`,
        scope: 'artesanal',
        to: `/maintenance/service-operations/${row.id}`,
        number: row.internal_number,
        customer: row.customer_name,
        date: row.operational_date,
        balance: row.balance,
        condition: row.condition,
        ageDays: row.age_days,
        canCollect: canCollectArtisan,
      })
    }
  }

  const pending =
    (commercial && sales.isPending) || (artisan && services.isPending)
  const failed = (commercial && sales.isError) || (artisan && services.isError)
  const total =
    (commercial ? (sales.data?.count ?? 0) : 0) +
    (artisan ? owedServices.length : 0)

  return (
    <Column
      count={pending || failed ? undefined : total}
      id="home-owed"
      subtitle="Documentos con saldo"
      title="Falta cobrar"
      tone="danger"
    >
      {commercial && sales.isError && (
        <FailedPart
          onRetry={() => void sales.refetch()}
          title="No se pudieron cargar las cuentas de repuestos"
        />
      )}
      {artisan && services.isError && (
        <FailedPart
          onRetry={() => void services.refetch()}
          title="No se pudieron cargar las cuentas de servicios"
        />
      )}
      {pending && !failed && (
        <SkeletonRows label="Cargando cuentas por cobrar…" rows={2} />
      )}
      {!pending &&
        [...rows]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, MAX_CARDS)
          .map((row) => <OwedCard key={row.key} row={row} />)}
      {!pending && !failed && rows.length === 0 && (
        <p className="px-5 pb-5 text-body text-ink-muted">Nadie debe nada.</p>
      )}
    </Column>
  )
}

function FailedPart({
  title,
  onRetry,
}: {
  title: string
  onRetry: () => void
}) {
  return (
    <div className="px-5 pb-4">
      <ErrorState
        message="El servidor no respondió. Reintente en unos instantes."
        onRetry={onRetry}
        title={title}
      />
    </div>
  )
}

import { HandCoins } from '@phosphor-icons/react'
import { Link } from 'react-router'

import { useArtisanReceivables } from '@/features/maintenance/billingHooks'
import { documentDate } from '@/features/maintenance/format'
import { useReceivables } from '@/features/sales/hooks'
import { useBusinessName } from '@/shared/api/entity-logos'
import { Money, SectionPanel } from '@/shared/ui'

import { BlockStates } from './BlockStates'

interface OwedRow {
  key: string
  scope: 'commercial' | 'artesanal'
  to: string
  number: string
  customer: string
  date: string
  balance: string
}

function BusinessTag({ scope }: { scope: OwedRow['scope'] }) {
  const name = useBusinessName(scope)
  return <span className="text-label font-semibold text-ink-muted">{name}</span>
}

/**
 * «Falta cobrar»: las cuentas con deuda de cada negocio permitido. Las filas de los dos
 * negocios se ordenan juntas por fecha solo para listarlas; cada una lleva su negocio y su saldo
 * y no hay ningún total conjunto.
 */
export function OwedBlock({
  commercial,
  artisan,
  className = '',
}: {
  commercial: boolean
  artisan: boolean
  className?: string
}) {
  return (
    <SectionPanel
      className={className}
      icon={<HandCoins aria-hidden="true" size={17} weight="bold" />}
      id="home-owed"
      title="Falta cobrar"
    >
      <div className="divide-y divide-line">
        {commercial && <CommercialOwed />}
        {artisan && <ArtisanOwed />}
      </div>
    </SectionPanel>
  )
}

function OwedList({ rows }: { rows: OwedRow[] }) {
  return rows.length === 0 ? (
    <p className="px-4 py-3.5 text-body text-ink-muted">
      No hay cuentas por cobrar.
    </p>
  ) : (
    <ul className="divide-y divide-line">
      {[...rows]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((row) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-body"
            key={row.key}
          >
            <div className="min-w-0">
              <Link
                className="code font-semibold text-ink hover:text-accent hover:underline"
                to={row.to}
              >
                {row.number}
              </Link>
              <span className="ml-2 text-ink-muted">
                {documentDate(row.date)}
              </span>
              <p className="truncate text-label text-ink-muted">
                <BusinessTag scope={row.scope} /> · {row.customer}
              </p>
            </div>
            <Money amount={row.balance} className="font-semibold" />
          </li>
        ))}
    </ul>
  )
}

function CommercialOwed() {
  const query = useReceivables({ onlyDebt: true, pageSize: 5 })
  return (
    <BlockStates
      errorTitle="No se pudieron cargar las cuentas de repuestos"
      loadingLabel="Cargando cuentas por cobrar…"
      query={query}
    >
      {(data) => (
        <OwedList
          rows={data.results.map((sale) => ({
            key: `c${sale.id}`,
            scope: 'commercial' as const,
            to: `/sales/${sale.id}`,
            number: sale.internal_number ?? String(sale.id),
            customer: sale.customer.name ?? '',
            date: sale.sale_date,
            balance: sale.money.balance ?? '0.00',
          }))}
        />
      )}
    </BlockStates>
  )
}

function ArtisanOwed() {
  const query = useArtisanReceivables({ pageSize: 5 })
  return (
    <BlockStates
      errorTitle="No se pudieron cargar las cuentas de servicios"
      loadingLabel="Cargando cuentas por cobrar…"
      query={query}
    >
      {(data) => (
        <OwedList
          rows={data.results
            .filter((row) => Number(row.balance) > 0)
            .map((row) => ({
              key: `a${row.id}`,
              scope: 'artesanal' as const,
              to: `/maintenance/service-operations/${row.id}`,
              number: row.internal_number,
              customer: row.customer_name,
              date: row.operational_date,
              balance: row.balance,
            }))}
        />
      )}
    </BlockStates>
  )
}

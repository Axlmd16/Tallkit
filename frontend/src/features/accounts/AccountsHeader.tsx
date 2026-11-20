import { Link, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useHomePending, useHomeReceivables } from '@/features/home/hooks'
import type { HomeScope } from '@/features/home/types'
import { useIssuerBrand, type IssuerScope } from '@/shared/api/entity-logos'
import { BusinessMark, Money, SegmentedControl } from '@/shared/ui'

export type AccountsBusiness = 'commercial' | 'artesanal'
export type AccountsView = 'receivables' | 'withholdings'

const PATHS: Record<AccountsBusiness, Record<AccountsView, string>> = {
  commercial: {
    receivables: '/sales/receivables',
    withholdings: '/sales/withholdings',
  },
  artesanal: {
    receivables: '/maintenance/receivables',
    withholdings: '/maintenance/withholdings',
  },
}

const ISSUER: Record<AccountsBusiness, IssuerScope> = {
  commercial: 'COMERCIAL',
  artesanal: 'ARTESANAL',
}
const HOME_SCOPE: Record<AccountsBusiness, HomeScope> = {
  commercial: 'commercial',
  artesanal: 'artisan',
}
const FALLBACK: Record<AccountsBusiness, string> = {
  commercial: 'Repuestos',
  artesanal: 'Servicios',
}

function BusinessCard({
  business,
  view,
  current,
  owed,
  customers,
  withholdings,
}: {
  business: AccountsBusiness
  view: AccountsView
  current: boolean
  owed: string | undefined
  customers: number | undefined
  withholdings: number | undefined
}) {
  const brand = useIssuerBrand(ISSUER[business])
  const name = brand.displayName ?? FALLBACK[business]
  const facts = [
    customers === undefined
      ? null
      : customers === 1
        ? '1 cliente con deuda'
        : `${customers} clientes con deuda`,
    withholdings === undefined
      ? null
      : withholdings === 1
        ? '1 retención por completar'
        : `${withholdings} retenciones por completar`,
  ].filter(Boolean)
  return (
    <Link
      aria-current={current ? 'page' : undefined}
      className={`flex items-center gap-3.5 rounded-card border px-4.5 py-3.5 transition-colors ${current ? 'border-ink bg-surface shadow-menu' : 'border-line bg-surface hover:border-ink/40'}`}
      to={PATHS[business][view]}
    >
      <BusinessMark
        decorative
        logoUrl={brand.logoUrl}
        name={name}
        scope={business}
        size="lg"
      />
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block truncate font-bold">{name}</span>
        {facts.length > 0 && (
          <span className="block text-label text-ink-muted">
            {facts.join(' · ')}
          </span>
        )}
      </span>
      {owed !== undefined && (
        <span className="text-right leading-snug">
          <span className="block text-label text-ink-muted">Le deben</span>
          <Money amount={owed} className="text-figure font-bold" />
        </span>
      )}
    </Link>
  )
}

/**
 * Encabezado común de Cuentas: una tarjeta por negocio (solo los que la sesión puede ver, cada
 * uno con su propia deuda y sin ningún total conjunto) y los segmentos «Por cobrar» y
 * «Retenciones». Elegir una tarjeta cambia de negocio; los segmentos, de lista.
 */
export function AccountsHeader({
  business,
  view,
}: {
  business: AccountsBusiness
  view: AccountsView
}) {
  const navigate = useNavigate()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canCommercial = permissions.has('pagos_comerciales.ver')
  const canArtisan = permissions.has('pagos_artesanales.ver')
  const receivables = useHomeReceivables(canCommercial || canArtisan)
  const pending = useHomePending(canCommercial || canArtisan)

  const visible: AccountsBusiness[] = [
    ...(canCommercial ? (['commercial'] as const) : []),
    ...(canArtisan ? (['artesanal'] as const) : []),
  ]
  const owedBy = (item: AccountsBusiness) =>
    receivables.data?.items.find((row) => row.scope === HOME_SCOPE[item])
  const withholdingsOf = (item: AccountsBusiness) =>
    pending.data?.items.find(
      (row) =>
        row.key === 'withholdings_pending' && row.scope === HOME_SCOPE[item],
    )?.count

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5 md:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]">
        {visible.map((item) => (
          <BusinessCard
            business={item}
            current={item === business}
            customers={owedBy(item)?.customers}
            key={item}
            owed={owedBy(item)?.balance}
            view={view}
            withholdings={withholdingsOf(item)}
          />
        ))}
      </div>
      <SegmentedControl
        aria-label="Ver cuentas"
        onChange={(value) =>
          void navigate(PATHS[business][value as AccountsView])
        }
        options={[
          { value: 'receivables', label: 'Por cobrar' },
          {
            value: 'withholdings',
            label: 'Retenciones',
            ...(withholdingsOf(business) !== undefined
              ? { count: withholdingsOf(business) as number }
              : {}),
          },
        ]}
        value={view}
      />
    </div>
  )
}

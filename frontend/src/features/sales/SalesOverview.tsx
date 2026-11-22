import { Link, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useHomeCollections, useHomeReceivables } from '@/features/home/hooks'
import { businessToday } from '@/features/maintenance/OrderForm'
import { useProformas } from '@/features/proformas/hooks'
import { Button, Money, StatTile, StatTiles } from '@/shared/ui'

import { useSales } from './hooks'

/** Pestañas para alternar entre Ventas y Proformas desde la misma vista. */
export function SalesTabs({ active }: { active: 'sales' | 'proformas' }) {
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canSales = permissions.has('ventas.ver')
  const canProformas = permissions.has('proformas.ver')
  if (!canSales || !canProformas) return null
  const tabClass = (isActive: boolean) =>
    `inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-body font-semibold transition-colors ${
      isActive
        ? 'border-ink text-ink'
        : 'border-transparent text-ink-muted hover:text-ink'
    }`
  return (
    <nav aria-label="Ventas y proformas" className="flex border-b border-line">
      <Link
        aria-current={active === 'sales' ? 'page' : undefined}
        className={tabClass(active === 'sales')}
        to="/sales"
      >
        Ventas
      </Link>
      <Link
        aria-current={active === 'proformas' ? 'page' : undefined}
        className={tabClass(active === 'proformas')}
        to="/proformas"
      >
        Proformas
      </Link>
    </nav>
  )
}

/** Acciones de la cabecera de Ventas y de Proformas, según lo que la sesión puede hacer. */
export function SalesActions() {
  const navigate = useNavigate()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canQuote = permissions.has('proformas.gestionar')
  const canSell = permissions.has('ventas.crear')
  if (!canQuote && !canSell) return null
  return (
    <div className="flex flex-wrap gap-2.5">
      {canQuote && (
        <Button
          onClick={() => navigate('/proformas/new')}
          type="button"
          variant="secondary"
        >
          Nueva proforma
        </Button>
      )}
      {canSell && (
        <Button onClick={() => navigate('/sales/quick')} type="button">
          Venta rápida
        </Button>
      )}
    </div>
  )
}

/**
 * Indicadores de Ventas y Proformas. Todos son del negocio de repuestos y los calcula el
 * servidor: lo cobrado hoy y la deuda salen del resumen del inicio, las ventas de hoy y las
 * proformas vigentes del contador de sus listas. Cada uno se muestra solo con su permiso.
 */
export function SalesOverview() {
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canSeeMoney = permissions.has('pagos_comerciales.ver')
  const canSeeSales = permissions.has('ventas.ver')
  const canSeeProformas = permissions.has('proformas.ver')
  const today = businessToday()

  const collections = useHomeCollections(canSeeMoney)
  const receivables = useHomeReceivables(canSeeMoney)
  const salesToday = useSales(
    { state: 'CONFIRMED', dateFrom: today, dateTo: today, pageSize: 1 },
    canSeeSales,
  )
  const validProformas = useProformas(
    { state: 'VALID', pageSize: 1 },
    canSeeProformas,
  )

  const collected = collections.data?.items
    .find((item) => item.scope === 'commercial')
    ?.days.find((day) => day.date === today)?.amount
  const owed = receivables.data?.items.find(
    (item) => item.scope === 'commercial',
  )

  if (!canSeeMoney && !canSeeSales && !canSeeProformas) return null
  return (
    <StatTiles label="Resumen de ventas">
      {canSeeMoney && (
        <StatTile
          label="Cobrado hoy"
          value={
            collections.data ? <Money amount={collected ?? '0.00'} /> : '—'
          }
        />
      )}
      {canSeeSales && (
        <StatTile
          label="Ventas de hoy"
          to={`/sales?state=CONFIRMED&date_from=${today}&date_to=${today}`}
          value={salesToday.data?.count ?? '—'}
        />
      )}
      {canSeeMoney && (
        <StatTile
          label="Quedaron debiendo"
          {...(owed && owed.customers > 0
            ? {
                detail:
                  owed.customers === 1
                    ? '1 cliente'
                    : `${owed.customers} clientes`,
              }
            : {})}
          to="/sales/receivables"
          tone={owed && Number(owed.balance) > 0 ? 'danger' : 'neutral'}
          value={
            receivables.data ? <Money amount={owed?.balance ?? '0.00'} /> : '—'
          }
        />
      )}
      {canSeeProformas && (
        <StatTile
          label="Proformas vigentes"
          to="/proformas?state=VALID"
          value={validProformas.data?.count ?? '—'}
        />
      )}
    </StatTiles>
  )
}

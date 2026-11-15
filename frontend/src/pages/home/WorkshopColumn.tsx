import { Link } from 'react-router'

import { documentDate, OrderStateBadge } from '@/features/maintenance/format'
import { useMaintenanceOrders } from '@/features/maintenance/hooks'
import { Money, PlateTag } from '@/shared/ui'

import { BlockStates } from './BlockStates'
import { cardClass, Column } from './Column'

/**
 * «En el taller»: los mantenimientos abiertos (registrados o reabiertos), uno por tarjeta con
 * su placa, cliente, vehículo, estado y número. El importe es el de los servicios de la orden:
 * es operativo, no un cobro. Solo se monta con permiso de mantenimientos.
 */
export function WorkshopColumn({
  onNewMaintenance,
}: {
  onNewMaintenance: (() => void) | null
}) {
  const query = useMaintenanceOrders({ state: 'OPEN', pageSize: 5 })
  const count = query.data?.status_counts?.open ?? query.data?.count
  return (
    <Column
      count={query.isPending || query.isError ? undefined : count}
      id="home-in-workshop"
      subtitle="Mantenimientos abiertos"
      title="En el taller"
      tone="info"
    >
      <BlockStates
        errorTitle="No se pudieron cargar los mantenimientos abiertos"
        loadingLabel="Cargando mantenimientos…"
        query={query}
      >
        {(data) => (
          <>
            {data.results.map((order) => (
              <Link
                className={`${cardClass} transition-colors hover:bg-surface-subtle`}
                key={order.id}
                to={`/maintenance/${order.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <PlateTag plate={order.vehicle.plate} />
                  <OrderStateBadge state={order.state} />
                </div>
                <div className="leading-snug">
                  <div className="font-bold">{order.customer.name}</div>
                  <div className="text-label text-ink-muted">
                    {order.vehicle.brand} {order.vehicle.model}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-label text-ink-muted">
                  <span>
                    N.º <span className="code">{order.number}</span> · desde{' '}
                    {documentDate(order.opened_on)}
                  </span>
                  <span className="text-body font-bold text-ink">
                    <Money amount={order.services_total} />
                  </span>
                </div>
              </Link>
            ))}
            {data.results.length === 0 && onNewMaintenance && (
              <div className="px-5 pt-2 pb-5">
                <button
                  className="flex min-h-14 w-full items-center justify-center rounded-group border-[1.5px] border-dashed border-line-dashed text-body font-semibold text-ink-muted hover:text-ink"
                  onClick={onNewMaintenance}
                  type="button"
                >
                  + Recibir un vehículo
                </button>
              </div>
            )}
            {data.results.length === 0 && !onNewMaintenance && (
              <p className="px-5 pb-5 text-body text-ink-muted">
                No hay mantenimientos abiertos.
              </p>
            )}
            {data.count > data.results.length && (
              <div className="border-t border-line px-5 py-3 text-right">
                <Link
                  className="text-body font-semibold text-accent hover:underline"
                  to="/maintenance?state=OPEN"
                >
                  Ver todos
                </Link>
              </div>
            )}
          </>
        )}
      </BlockStates>
    </Column>
  )
}

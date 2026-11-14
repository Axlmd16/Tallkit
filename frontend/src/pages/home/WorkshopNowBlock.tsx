import { Wrench } from '@phosphor-icons/react'
import { Link } from 'react-router'

import { documentDate } from '@/features/maintenance/format'
import { useMaintenanceOrders } from '@/features/maintenance/hooks'
import { PlateTag, SectionPanel } from '@/shared/ui'

import { BlockStates } from './BlockStates'

/**
 * «En el taller»: los mantenimientos abiertos (registrados o reabiertos), con acceso a la lista
 * completa. Solo se monta con permiso de mantenimientos.
 */
export function WorkshopNowBlock({ className = '' }: { className?: string }) {
  const query = useMaintenanceOrders({ state: 'OPEN', pageSize: 5 })
  return (
    <SectionPanel
      actions={
        <Link
          className="text-body font-semibold text-accent hover:underline"
          to="/maintenance?state=OPEN"
        >
          Ver todos
        </Link>
      }
      className={className}
      icon={<Wrench aria-hidden="true" size={17} weight="bold" />}
      id="home-in-workshop"
      title="En el taller"
    >
      <BlockStates
        errorTitle="No se pudieron cargar los mantenimientos abiertos"
        loadingLabel="Cargando mantenimientos…"
        query={query}
      >
        {(data) =>
          data.results.length === 0 ? (
            <p className="px-4 py-3.5 text-body text-ink-muted">
              No hay mantenimientos abiertos.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.results.map((order) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-body"
                  key={order.id}
                >
                  <div className="min-w-0">
                    <Link
                      className="code font-semibold text-ink hover:text-accent hover:underline"
                      to={`/maintenance/${order.id}`}
                    >
                      {order.number}
                    </Link>
                    <span className="ml-2 text-ink-muted">
                      {documentDate(order.opened_on)}
                    </span>
                    <p className="truncate text-label text-ink-muted">
                      {order.customer.name}
                    </p>
                  </div>
                  <PlateTag plate={order.vehicle.plate} />
                </li>
              ))}
            </ul>
          )
        }
      </BlockStates>
    </SectionPanel>
  )
}

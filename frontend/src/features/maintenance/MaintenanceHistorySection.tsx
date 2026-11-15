import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router'

import {
  Button,
  InlineNotice,
  LoadingState,
  Money,
  Pagination,
  PlateTag,
} from '@/shared/ui'

import { documentDate, OrderStateBadge } from './format'
import { useMaintenanceOrders } from './hooks'
import { NewMaintenanceDialog } from './NewMaintenanceDialog'

/**
 * Historial operativo de mantenimientos desde la ficha de un cliente o de un vehículo.
 * Solo se monta con `mantenimientos.ver`; el servidor vuelve a autorizar la consulta.
 */
export function MaintenanceHistorySection({
  customer,
  vehicleId,
  canCreate,
}: {
  customer?: { id: number; name: string } | undefined
  vehicleId?: number | undefined
  canCreate: boolean
}) {
  const [page, setPage] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const query = useMaintenanceOrders({
    customerId: vehicleId ? undefined : customer?.id,
    vehicleId,
    page,
    pageSize: 10,
  })
  return (
    <>
      <section
        aria-labelledby="maintenance-history-title"
        className="rounded-panel border border-line bg-surface"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2
            className="text-body font-semibold text-ink"
            id="maintenance-history-title"
          >
            Historial de mantenimientos
          </h2>
          {canCreate && customer && (
            <Button
              onClick={() => setNewOpen(true)}
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={16} />
              Nueva orden
            </Button>
          )}
        </div>
        <div className="p-4">
          {query.isPending ? (
            <LoadingState label="Cargando historial…" />
          ) : query.isError || !query.data ? (
            <InlineNotice title="No se pudo cargar el historial" tone="danger">
              <Button
                onClick={() => void query.refetch()}
                type="button"
                variant="secondary"
              >
                Reintentar
              </Button>
            </InlineNotice>
          ) : query.data.results.length === 0 ? (
            <p className="text-body text-ink-muted">
              No hay órdenes de mantenimiento registradas.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {query.data.results.map((item) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-body"
                    key={item.id}
                  >
                    <div className="min-w-0">
                      <Link
                        className="code font-semibold text-ink hover:text-accent hover:underline"
                        to={`/maintenance/${item.id}`}
                      >
                        {item.number}
                      </Link>
                      <span className="ml-2 text-ink-muted">
                        {documentDate(item.opened_on)}
                      </span>
                      <p className="truncate text-label text-ink-muted">
                        {vehicleId ? (
                          item.customer.name
                        ) : (
                          <PlateTag plate={item.vehicle.plate} />
                        )}
                        {' · '}
                        {item.service_summary.line_count === 0
                          ? 'Sin servicios'
                          : `${item.service_summary.names.join(', ')}${
                              item.service_summary.line_count >
                              item.service_summary.names.length
                                ? ` y ${item.service_summary.line_count - item.service_summary.names.length} más`
                                : ''
                            }`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStateBadge state={item.state} />
                      <Money amount={item.services_total} />
                    </div>
                  </li>
                ))}
              </ul>
              {query.data.total_pages > 1 && (
                <div className="mt-3">
                  <Pagination
                    onNext={() => setPage(page + 1)}
                    onPrevious={() => setPage(Math.max(1, page - 1))}
                    page={query.data.page}
                    totalItems={query.data.count}
                    totalPages={query.data.total_pages}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
      {newOpen && customer && (
        <NewMaintenanceDialog
          initialSearch={customer.name}
          onClose={() => setNewOpen(false)}
          open
        />
      )}
    </>
  )
}

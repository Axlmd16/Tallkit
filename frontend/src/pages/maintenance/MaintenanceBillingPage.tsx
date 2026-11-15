import { ArrowLeft } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { EconomicSummary } from '@/features/maintenance/EconomicSummary'
import { useMaintenanceOrder } from '@/features/maintenance/hooks'
import {
  Button,
  InlineNotice,
  LoadingState,
  PlateTag,
  useToast,
} from '@/shared/ui'

/**
 * «Cobrar y facturar» de un mantenimiento: los cobros y documentos de cada negocio, por
 * separado. Es el destino del botón de la ficha hasta que el cobro en un paso (U6) lo reemplace.
 */
export function MaintenanceBillingPage() {
  const id = Number(useParams().id)
  const query = useMaintenanceOrder(Number.isFinite(id) ? id : null)
  const session = useSession().data
  const toast = useToast()

  if (query.isPending) return <LoadingState label="Cargando orden…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar la orden" tone="danger">
        <Button
          onClick={() => void query.refetch()}
          type="button"
          variant="secondary"
        >
          Reintentar
        </Button>
      </InlineNotice>
    )
  }
  const order = query.data
  return (
    <div className="catalog-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3.5 border-b border-line pb-5">
        <div>
          <p className="text-label text-ink-muted">
            Mantenimiento N.º <span className="code">{order.number}</span>
          </p>
          <h1 className="text-page font-bold tracking-tight">
            Cobrar y facturar
          </h1>
          <p className="mt-1.5 flex items-center gap-2.5 text-lead text-ink-muted">
            {order.customer.name} <PlateTag plate={order.vehicle.plate} />
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 text-body font-semibold text-accent hover:underline"
          to={`/maintenance/${order.id}`}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Volver al mantenimiento
        </Link>
      </div>
      <EconomicSummary
        onDone={(message) => toast.success(message)}
        order={order}
        userScope={session?.username ?? ''}
      />
    </div>
  )
}

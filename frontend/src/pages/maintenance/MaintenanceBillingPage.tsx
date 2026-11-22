import { ArrowLeft, Receipt } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { EconomicSummary } from '@/features/maintenance/EconomicSummary'
import { useMaintenanceOrder } from '@/features/maintenance/hooks'
import {
  Button,
  InlineNotice,
  LoadingState,
  PageHeader,
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
      <PageHeader
        actions={
          <Link
            className="inline-flex items-center gap-2 text-body font-semibold text-ink-muted hover:text-ink"
            to={`/maintenance/${order.id}`}
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Volver al mantenimiento
          </Link>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            <span>{order.customer.name}</span>
            <PlateTag plate={order.vehicle.plate} />
          </span>
        }
        eyebrow={`Mantenimiento N.º ${order.number}`}
        icon={<Receipt />}
        title="Cobrar y facturar"
      />
      <EconomicSummary
        onDone={(message) => toast.success(message)}
        order={order}
        userScope={session?.username ?? ''}
      />
    </div>
  )
}

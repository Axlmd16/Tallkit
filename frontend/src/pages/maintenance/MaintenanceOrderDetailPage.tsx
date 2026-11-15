import { ArrowCounterClockwise, NotePencil } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useEconomicSummary } from '@/features/maintenance/billingHooks'
import {
  useMaintenanceOrder,
  useMaintenanceOrders,
} from '@/features/maintenance/hooks'
import { sumMoney } from '@/features/maintenance/money'
import { lifecycleText, OrderBand } from '@/features/maintenance/OrderBand'
import {
  ClosingPanel,
  CobroCard,
  DiagnosisCard,
  FinalizeCard,
  MovesLog,
  NotesCard,
} from '@/features/maintenance/OrderPanels'
import { PartsSection } from '@/features/maintenance/PartsSection'
import { PhotosSection } from '@/features/maintenance/Photos'
import { ServiceLinesSection } from '@/features/maintenance/ServiceLines'
import {
  FinalizeDialog,
  InterventionsSection,
  ReopenDialog,
} from '@/features/maintenance/Transitions'
import { OrderStateBadge } from '@/features/maintenance/format'
import { Button, InlineNotice, LoadingState, useToast } from '@/shared/ui'

type Dialogs = 'finalize' | 'reopen' | null

/**
 * Ficha del mantenimiento: la banda del vehículo arriba; a la izquierda el diagnóstico, los
 * trabajos y los repuestos; a la derecha lo que falta para finalizar, el cobro y las visitas
 * anteriores. Las acciones visibles las calcula el servidor según estado y permisos; el
 * servidor vuelve a autorizarlas al ejecutarlas.
 */
export function MaintenanceOrderDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const validId = Number.isFinite(id)
  const query = useMaintenanceOrder(validId ? id : null)
  const vehicleId = query.data?.vehicle.id
  const visitsQuery = useMaintenanceOrders({ vehicleId, pageSize: 2 })
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const summaryQuery = useEconomicSummary(validId ? id : 0, validId)
  const [dialog, setDialog] = useState<Dialogs>(null)
  const toast = useToast()
  const returnFocus = useRef<HTMLElement | null>(null)

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
  const actions = new Set(order.allowed_actions)
  const summary = summaryQuery.data
  const visits = (visitsQuery.data?.results ?? []).filter(
    (visit) => visit.id !== order.id,
  )
  const done = (message: string) => {
    setDialog(null)
    toast.success(message)
  }
  const open = (next: Dialogs, event: { currentTarget: HTMLElement }) => {
    returnFocus.current = event.currentTarget
    setDialog(next)
  }
  const reopened = order.state === 'REOPENED'

  // Los importes son del servidor; el total junta dos negocios solo para informar.
  const parts = summary?.commercial.visible
    ? sumMoney(
        summary.commercial.confirmed_total,
        summary.commercial.pending?.estimated_total,
      )
    : null
  const amounts = {
    labor: order.services_total,
    parts,
    total: sumMoney(order.services_total, parts),
  }
  const showBilling = Boolean(
    summary && (summary.commercial.visible || summary.artisan.visible),
  )

  return (
    <div className="catalog-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className="text-page font-bold tracking-tight">
            Mantenimiento N.º <span className="code">{order.number}</span>
          </h1>
          <OrderStateBadge state={order.state} />
          <span className="text-label text-ink-muted">
            {lifecycleText(order)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.has('edit') && (
            <Button
              onClick={() => void navigate(`/maintenance/${order.id}/edit`)}
              type="button"
              variant="ghost"
            >
              <NotePencil aria-hidden="true" size={16} />
              Editar datos
            </Button>
          )}
          {actions.has('reopen') && (
            <Button
              onClick={(event) => open('reopen', event)}
              type="button"
              variant="ghost"
            >
              <ArrowCounterClockwise aria-hidden="true" size={16} />
              Reabrir por un problema
            </Button>
          )}
        </div>
      </div>

      <OrderBand order={order} previous={visits[0]} />

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_37.5rem] flex-col gap-4">
          {reopened && <InterventionsSection onDone={done} order={order} />}
          <DiagnosisCard editable={actions.has('edit')} order={order} />
          <ServiceLinesSection onDone={done} order={order} />
          <PartsSection
            canOpenSales={permissions.has('ventas.ver')}
            canSeeKardex={permissions.has('inventario.ver')}
            onDone={done}
            order={order}
          />
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(18.75rem,1fr))]">
            <NotesCard editable={actions.has('edit')} order={order} />
            <PhotosSection onDone={done} order={order} />
          </div>
          {!reopened && <InterventionsSection onDone={done} order={order} />}
        </div>
        <aside className="flex min-w-0 flex-[1_1_23rem] flex-col gap-4">
          <ClosingPanel>
            {order.state !== 'FINALIZED' && (
              <FinalizeCard
                onFinalize={(event) => open('finalize', event)}
                order={order}
              />
            )}
            {showBilling && summary && (
              <CobroCard
                amounts={amounts}
                billingTo={`/maintenance/${order.id}/billing`}
                order={order}
                summary={summary}
              />
            )}
          </ClosingPanel>
          <MovesLog order={order} />
        </aside>
      </div>

      {dialog === 'finalize' && (
        <FinalizeDialog
          onClose={() => setDialog(null)}
          onDone={done}
          order={order}
          returnFocusRef={returnFocus}
        />
      )}
      {dialog === 'reopen' && (
        <ReopenDialog
          onClose={() => setDialog(null)}
          onDone={done}
          order={order}
          returnFocusRef={returnFocus}
        />
      )}
    </div>
  )
}

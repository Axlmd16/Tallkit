import {
  ArrowCounterClockwise,
  ArrowLeft,
  CheckCircle,
  Info,
  NotePencil,
  Stethoscope,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import {
  documentDate,
  kilometers,
  OrderStateBadge,
  timestamp,
} from '@/features/maintenance/format'
import { useMaintenanceOrder } from '@/features/maintenance/hooks'
import type { MaintenanceOrder } from '@/features/maintenance/types'
import { OrderSummary } from '@/features/maintenance/OrderSummary'
import { PhotosSection } from '@/features/maintenance/Photos'
import { SectionPanel } from '@/features/maintenance/SectionPanel'
import { ServiceLinesSection } from '@/features/maintenance/ServiceLines'
import {
  FinalizeDialog,
  InterventionsSection,
  ReopenDialog,
  TransitionTimeline,
} from '@/features/maintenance/Transitions'
import {
  Button,
  InlineNotice,
  LoadingState,
  PlateTag,
  StatusBadge,
  useToast,
} from '@/shared/ui'

type Dialogs = 'finalize' | 'reopen' | null

/**
 * Ficha de la orden: información general, diagnóstico y observaciones, intervenciones,
 * servicios, fotografías e historial. Las acciones visibles las calcula el servidor según
 * estado y permisos; el servidor vuelve a autorizarlas al ejecutarlas.
 */
export function MaintenanceOrderDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const navigate = useNavigate()
  const query = useMaintenanceOrder(Number.isFinite(id) ? id : null)
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
  const done = (message: string) => {
    setDialog(null)
    toast.success(message)
  }
  const open = (next: Dialogs, event: { currentTarget: HTMLElement }) => {
    returnFocus.current = event.currentTarget
    setDialog(next)
  }
  const from = (location.state as { from?: string } | null)?.from ?? ''
  const back = `/maintenance${from.startsWith('?') ? from : ''}`
  const reopened = order.state === 'REOPENED'

  return (
    <div className="catalog-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            aria-label="Volver a mantenimientos"
            className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
            title="Volver a mantenimientos"
            to={back}
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Mantenimientos</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-[22px] leading-7 font-semibold text-ink">
                {order.number}
              </h1>
              <OrderStateBadge state={order.state} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.has('edit') && (
            <Button
              onClick={() => void navigate(`/maintenance/${order.id}/edit`)}
              type="button"
              variant="secondary"
            >
              <NotePencil aria-hidden="true" size={16} />
              Editar datos
            </Button>
          )}
          {actions.has('finalize') && (
            <Button onClick={(event) => open('finalize', event)} type="button">
              <CheckCircle aria-hidden="true" size={16} />
              {reopened ? 'Finalizar corrección' : 'Finalizar'}
            </Button>
          )}
          {actions.has('reopen') && (
            <Button onClick={(event) => open('reopen', event)} type="button">
              <ArrowCounterClockwise aria-hidden="true" size={16} />
              Reabrir
            </Button>
          )}
        </div>
      </div>

      {order.state === 'FINALIZED' && (
        <InlineNotice title="Orden finalizada" tone="success">
          Finalizada por {order.last_finalized_by?.name ?? '—'} el{' '}
          {timestamp(order.last_finalized_at)}. Para modificarla debe reabrirse.
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {reopened && <InterventionsSection onDone={done} order={order} />}
          <SectionPanel
            icon={<Info size={17} />}
            id="order-general-title"
            title="Información general"
          >
            <GeneralInfo order={order} />
          </SectionPanel>
          <SectionPanel
            icon={<Stethoscope size={17} />}
            id="order-diagnosis-title"
            title="Diagnóstico y observaciones"
          >
            <dl className="grid gap-4 p-4 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">Diagnóstico</dt>
                <dd className="mt-1 whitespace-pre-line">
                  {order.diagnosis || (
                    <span className="text-ink-muted">
                      Pendiente de registrar.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Observaciones</dt>
                <dd className="mt-1 whitespace-pre-line">
                  {order.notes || <span className="text-ink-muted">—</span>}
                </dd>
              </div>
            </dl>
          </SectionPanel>
          {!reopened && <InterventionsSection onDone={done} order={order} />}
          <ServiceLinesSection onDone={done} order={order} />
          <PhotosSection onDone={done} order={order} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <OrderSummary order={order} />
          <TransitionTimeline order={order} />
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

function GeneralInfo({ order }: { order: MaintenanceOrder }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2 xl:grid-cols-4 p-4">
      <div>
        <dt className="text-xs text-ink-muted">Cliente</dt>
        <dd className="mt-1 font-medium text-ink">
          <Link
            className="hover:underline"
            to={`/customers/${order.customer.id}`}
          >
            {order.customer.name}
          </Link>
          {!order.customer.is_active && (
            <StatusBadge className="ml-2" label="Inactivo" tone="neutral" />
          )}
          <span className="block text-xs text-ink-muted">
            {order.customer.identification_type} {order.customer.identification}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Vehículo</dt>
        <dd className="mt-1">
          <Link
            aria-label={`Vehículo ${order.vehicle.plate}`}
            to={`/vehicles/${order.vehicle.id}`}
          >
            <PlateTag plate={order.vehicle.plate} />
          </Link>
          {!order.vehicle.is_active && (
            <StatusBadge className="ml-2" label="Inactivo" tone="neutral" />
          )}
          <span className="block text-xs text-ink-muted">
            {order.vehicle.brand} {order.vehicle.model}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Apertura</dt>
        <dd className="mt-1">{documentDate(order.opened_on)}</dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Kilometraje</dt>
        <dd className="mt-1">
          {kilometers(order.odometer_km)}
          {order.odometer_confirmation && (
            <span className="block text-xs text-ink-muted">
              Menor al último conocido; confirmado por{' '}
              {order.odometer_confirmation.by.name}
            </span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Registrada por</dt>
        <dd className="mt-1">
          {order.created_by.name} · {timestamp(order.created_at)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Última actualización</dt>
        <dd className="mt-1">
          {order.updated_by.name} · {timestamp(order.updated_at)}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-ink-muted">RUC artesanal</dt>
        <dd className="mt-1">
          {order.fiscal_entity.legal_name} · {order.fiscal_entity.ruc}
        </dd>
      </div>
    </dl>
  )
}

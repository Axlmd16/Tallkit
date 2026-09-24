import { ArrowLeft, Package } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useCommercialView } from '@/features/maintenance/billingHooks'
import { OrderStateBadge } from '@/features/maintenance/format'
import {
  FiscalScopeBadge,
  InlineNotice,
  LoadingState,
  Money,
  PlateTag,
  SectionPanel,
  StatusBadge,
} from '@/shared/ui'

/**
 * Vista restringida de la orden de origen para el Vendedor: identificación, estado y
 * repuestos vinculados. No muestra servicios, importes artesanales, diagnóstico ni fotos.
 */
export function CommercialOrderViewPage() {
  const id = Number(useParams().id)
  const query = useCommercialView(Number.isFinite(id) ? id : null)
  if (query.isPending) return <LoadingState label="Cargando orden de origen…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="Orden no disponible" tone="danger">
        Solo puede consultarse la orden de origen de una venta vinculada.
      </InlineNotice>
    )
  }
  const view = query.data
  return (
    <div className="catalog-page space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label="Volver a ventas"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          to="/sales?origin=MAINTENANCE"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div>
          <p className="text-xs text-ink-muted">Orden de origen de repuestos</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-[22px] leading-7 font-semibold">
              {view.number}
            </h1>
            <OrderStateBadge state={view.state} />
          </div>
        </div>
      </div>
      <dl className="grid gap-4 rounded-panel border border-line bg-surface p-4 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-muted">Cliente</dt>
          <dd className="mt-1 font-medium">
            {view.customer.name}
            <span className="block text-xs text-ink-muted">
              {view.customer.identification}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Vehículo</dt>
          <dd className="mt-1">
            <PlateTag plate={view.vehicle.plate ?? ''} />
            <span className="block text-xs text-ink-muted">
              {view.vehicle.brand} {view.vehicle.model}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Apertura</dt>
          <dd className="mt-1">{view.opened_on}</dd>
        </div>
      </dl>
      <SectionPanel
        icon={<Package size={17} />}
        id="commercial-view-parts"
        title="Repuestos vinculados"
      >
        <div className="space-y-3 p-4">
          <FiscalScopeBadge scope="commercial" />
          {view.parts.map((sale) => (
            <article
              className="rounded-control border border-line p-3"
              key={sale.id}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Link
                  className="font-mono text-[13px] font-semibold hover:underline"
                  to={`/sales/${sale.id}`}
                >
                  {sale.internal_number ?? `Borrador ${sale.id}`}
                </Link>
                <StatusBadge
                  label={
                    sale.state === 'DRAFT'
                      ? 'Reservado, pendiente de confirmar'
                      : sale.state === 'VOIDED'
                        ? 'Anulada'
                        : 'Confirmada'
                  }
                  tone={sale.state === 'DRAFT' ? 'warning' : 'success'}
                />
              </div>
              <ul className="text-[13px]">
                {sale.lines.map((line) => (
                  <li className="flex justify-between gap-3" key={line.id}>
                    <span>
                      {line.product_code} · {line.product_name} ×{' '}
                      {line.quantity}
                    </span>
                    <Money amount={line.total_amount ?? null} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  )
}

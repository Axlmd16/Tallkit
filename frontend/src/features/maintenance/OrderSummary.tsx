import { CheckCircle, Circle, ClipboardText } from '@phosphor-icons/react'

import { Money } from '@/shared/ui'

import { OrderStateBadge, timestamp } from './format'
import { SectionPanel } from './SectionPanel'
import type { MaintenanceOrder } from './types'

const REQUIREMENT_LABELS: Record<string, string> = {
  diagnosis: 'Diagnóstico registrado',
  service_lines: 'Al menos un servicio',
  work_performed: 'Trabajo correctivo registrado',
}

/**
 * Resumen lateral de la orden: estado, total operativo y requisitos para finalizar según
 * la intervención abierta. Los requisitos los calcula el servidor; aquí solo se muestran.
 */
export function OrderSummary({ order }: { order: MaintenanceOrder }) {
  const open = order.interventions.find((i) => i.is_open)
  const lineCount = order.interventions.reduce((n, i) => n + i.lines.length, 0)
  const pending = new Set(order.pending_requirements.map((r) => r.code))
  const expected = !open
    ? []
    : open.kind === 'INITIAL'
      ? ['diagnosis', 'service_lines']
      : ['work_performed']
  const extra = order.pending_requirements.filter(
    (r) => !expected.includes(r.code),
  )
  return (
    <SectionPanel
      icon={<ClipboardText size={17} />}
      id="order-summary-title"
      title="Resumen"
    >
      <div className="space-y-4 p-4 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-muted">Estado</span>
          <OrderStateBadge state={order.state} />
        </div>
        <div className="rounded-control bg-surface-subtle px-3 py-2.5">
          <p className="text-xs text-ink-muted">
            Total de servicios de la orden
          </p>
          <Money
            amount={order.services_total}
            className="text-[20px] font-semibold text-ink"
          />
          <p className="mt-0.5 text-xs text-ink-muted">
            Valor operativo; no es un cobro ni una factura.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-xs text-ink-muted">Servicios</dt>
            <dd className="font-semibold text-ink">{lineCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Fotografías</dt>
            <dd className="font-semibold text-ink">{order.photos.length}</dd>
          </div>
        </dl>
        {open ? (
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Para finalizar
            </h3>
            <ul
              aria-label="Requisitos para finalizar"
              className="mt-2 space-y-1.5"
            >
              {[
                ...expected.map((code) => ({
                  code,
                  message: REQUIREMENT_LABELS[code] ?? code,
                })),
                ...extra,
              ].map((requirement) => {
                const done = !pending.has(requirement.code)
                return (
                  <li
                    className="flex items-center gap-2"
                    key={requirement.code}
                  >
                    {done ? (
                      <CheckCircle
                        aria-hidden="true"
                        className="shrink-0 text-success"
                        size={17}
                        weight="fill"
                      />
                    ) : (
                      <Circle
                        aria-hidden="true"
                        className="shrink-0 text-ink-muted"
                        size={17}
                      />
                    )}
                    <span className={done ? 'text-ink' : 'text-ink-muted'}>
                      {requirement.message}
                      <span className="sr-only">
                        {done ? ' (completo)' : ' (pendiente)'}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          order.last_finalized_at && (
            <p className="text-xs text-ink-muted">
              Finalizada por {order.last_finalized_by?.name ?? '—'} ·{' '}
              {timestamp(order.last_finalized_at)}
            </p>
          )
        )}
      </div>
    </SectionPanel>
  )
}

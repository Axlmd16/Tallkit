import { NotePencil, X } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import { ConfirmationPanel, InlineNotice, StatusBadge } from '@/shared/ui'

import { InlineField } from './InlineField'
import { QuantityStepper } from './QuantityStepper'
import { maintenanceKeys, useMaintenanceMutations } from './hooks'
import { ServiceAdder } from './WorkSearch'
import type { MaintenanceOrder, ServiceLine } from './types'

const PRICE = /^\d{1,12}(\.\d{1,2})?$/

/** Número de trabajo dentro de la orden: las líneas de todas las intervenciones, de corrido. */
function numbered(order: MaintenanceOrder) {
  let position = 0
  return order.interventions.map((intervention) => ({
    intervention,
    lines: intervention.lines.map((line) => ({ line, n: ++position })),
  }))
}

/**
 * «Trabajos realizados»: la mano de obra de la orden, una fila por trabajo con su código, su
 * nota para la factura y su precio, que se editan en la misma fila. Los precios son los
 * aplicados a esta orden; en una intervención correctiva se registran sin cargo. Solo la
 * intervención abierta es editable y una línea ya incluida en un recibo queda bloqueada.
 */
export function ServiceLinesSection({
  order,
  onDone,
}: {
  order: MaintenanceOrder
  onDone: (message: string) => void
}) {
  const canManage = order.allowed_actions.includes('manage_services')
  const canChangePrice = order.allowed_actions.includes('change_price')
  const [removing, setRemoving] = useState<ServiceLine | null>(null)
  const [removeError, setRemoveError] = useState('')
  const [error, setError] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const mutations = useMaintenanceMutations()
  const queryClient = useQueryClient()
  const tracker = useIntentTracker()
  const open = order.interventions.find((i) => i.is_open) ?? null
  const groups = numbered(order)
  const lineCount = groups.reduce((n, g) => n + g.lines.length, 0)

  // La versión vigente se lee al guardar, no al dibujar: un guardado que espera a otro
  // (por ejemplo, varios clics en la cantidad) sale con la versión que dejó el anterior.
  const version = useRef(order.version)
  version.current = order.version

  async function save(
    line: ServiceLine,
    data: { quantity?: number; applied_price?: string; detail?: string },
  ) {
    setError('')
    try {
      await tracker.run({ line: line.id, ...data }, (key) =>
        mutations.updateLine.mutateAsync({
          id: order.id,
          lineId: line.id,
          data,
          expectedVersion: version.current,
          key,
        }),
      )
    } catch (failure) {
      const problem = describeProblem(failure)
      if (problem.staleRecord) {
        // Otra persona (u otra pestaña) cambió la orden: se trae la vigente y se avisa sin jerga.
        void queryClient.invalidateQueries({
          queryKey: maintenanceKeys.detail(order.id),
        })
        setError(
          'La orden cambió mientras se guardaba. Ya se cargó la versión actual; repita el cambio si hace falta.',
        )
      } else {
        setError(problem.message)
      }
      throw failure
    }
  }

  async function remove(line: ServiceLine) {
    setRemoveError('')
    try {
      await tracker.run({ remove: line.id }, (key) =>
        mutations.removeLine.mutateAsync({
          id: order.id,
          lineId: line.id,
          expectedVersion: order.version,
          key,
        }),
      )
      setRemoving(null)
      onDone(`Servicio «${line.service_name}» retirado de la orden.`)
    } catch (failure) {
      setRemoveError(describeProblem(failure).message)
    }
  }

  return (
    <section
      aria-labelledby="order-services-title"
      className="rounded-card border border-line bg-surface"
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2.5">
        <h2 className="text-block font-bold" id="order-services-title">
          Trabajos realizados
        </h2>
        <span className="text-label text-ink-muted tabular-nums">
          {lineCount === 1 ? '1 trabajo' : `${lineCount} trabajos`} · mano de
          obra USD {order.services_total}
        </span>
      </div>
      {error && (
        <div className="px-5 pb-2">
          <InlineNotice title="No se guardó el cambio" tone="danger">
            {error}
          </InlineNotice>
        </div>
      )}
      {canManage && open && (
        <ServiceAdder corrective={open.kind === 'CORRECTIVE'} order={order} />
      )}
      {groups.map(({ intervention, lines }) => (
        <div key={intervention.id}>
          {order.interventions.length > 1 && (
            <h3 className="border-t border-line px-5 pt-3 text-label font-semibold text-ink-muted">
              {intervention.kind === 'CORRECTIVE'
                ? `Intervención correctiva ${intervention.ordinal - 1} · sin cargo`
                : 'Intervención inicial'}
            </h3>
          )}
          {lines.map(({ line, n }) => (
            <ServiceRow
              canManage={canManage && intervention.is_open}
              canPrice={
                canChangePrice &&
                intervention.is_open &&
                intervention.kind === 'INITIAL'
              }
              key={line.id}
              line={line}
              n={n}
              onRemove={(target) => {
                returnFocus.current = target
                setRemoveError('')
                setRemoving(line)
              }}
              onSave={(data) => save(line, data)}
            />
          ))}
        </div>
      ))}
      {lineCount === 0 && (
        <p className="border-t border-line px-5 py-3.5 text-body text-ink-muted">
          Todavía no hay trabajos. Agregue al menos uno para poder finalizar.
        </p>
      )}
      <ConfirmationPanel
        confirmLabel="Retirar servicio"
        description={
          removing
            ? `Se retirará «${removing.service_name}» de esta orden y se recalculará el total.`
            : ''
        }
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
        open={removing !== null}
        returnFocusRef={returnFocus}
        title="Retirar servicio"
        tone="danger"
      >
        {removeError && (
          <InlineNotice title="No se retiró el servicio" tone="danger">
            {removeError}
          </InlineNotice>
        )}
      </ConfirmationPanel>
    </section>
  )
}

function ServiceRow({
  line,
  n,
  canManage,
  canPrice,
  onSave,
  onRemove,
}: {
  line: ServiceLine
  n: number
  canManage: boolean
  canPrice: boolean
  onSave: (data: {
    quantity?: number
    applied_price?: string
    detail?: string
  }) => Promise<void>
  onRemove: (target: HTMLElement) => void
}) {
  const locked = Boolean(line.documented_by)
  const editable = canManage && !locked
  const [noteOpen, setNoteOpen] = useState(false)
  const quantityChange = editable
    ? (quantity: number) => onSave({ quantity })
    : undefined
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line px-5 py-5">
      <div className="flex min-w-[16rem] flex-1 items-start gap-4">
        {/* Del alto de la primera línea del nombre: el número queda centrado con ella. */}
        <span
          aria-hidden="true"
          className="flex h-[var(--text-lead--line-height)] shrink-0 items-center"
        >
          <span className="grid size-7 place-items-center rounded-full bg-surface-muted text-label font-semibold text-ink-muted tabular-nums">
            {n}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-lead font-semibold text-ink">
              {line.service_name}
            </span>
            {!line.service_is_active && (
              <StatusBadge label="Inactivo en catálogo" tone="neutral" />
            )}
            {line.no_charge && <StatusBadge label="Sin cargo" tone="info" />}
            {!line.no_charge && line.documented_by && (
              <StatusBadge
                label={`En recibo ${line.documented_by.number}`}
                tone="success"
              />
            )}
          </div>
          {noteOpen ? (
            <InlineField
              autoFocus
              className="mt-2 border-b border-line-strong py-1.5 text-body text-ink focus:border-ink"
              label={`Nota para la factura de ${line.service_name}`}
              onCommit={async (detail) => {
                await onSave({ detail })
                setNoteOpen(false)
              }}
              onUnchanged={() => setNoteOpen(false)}
              placeholder="Texto que se imprime junto a este trabajo en la factura"
              value={line.detail}
            />
          ) : (
            line.detail && (
              <p className="mt-1 text-body text-ink-muted">{line.detail}</p>
            )
          )}
          {canManage && locked && (
            <p className="mt-1.5 text-label text-ink-muted">
              Bloqueada: incluida en un recibo
            </p>
          )}
        </div>
      </div>
      <div className="flex items-end gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-label font-medium text-ink-muted">
            Cantidad
          </span>
          <QuantityStepper
            name={line.service_name}
            onChange={quantityChange}
            value={line.quantity}
          />
        </div>
        <label className="flex w-28 flex-col gap-1 text-right text-label font-medium text-ink-muted">
          Precio USD
          {canPrice && !locked ? (
            <InlineField
              align="right"
              className="h-10 border-b-[1.5px] border-line-strong px-1 text-block font-bold text-ink tabular-nums focus:border-ink"
              inputMode="decimal"
              label={`Precio de ${line.service_name}`}
              onCommit={async (price) => {
                if (!PRICE.test(price)) throw new Error('Importe inválido.')
                await onSave({ applied_price: price })
              }}
              value={line.applied_price}
            />
          ) : (
            <span
              aria-label={`Precio de ${line.service_name}`}
              className="flex h-10 items-center justify-end px-1 text-block font-bold text-ink tabular-nums"
              role="textbox"
            >
              {line.applied_price}
            </span>
          )}
        </label>
        {editable ? (
          <span className="flex items-center">
            <button
              aria-label={
                line.detail
                  ? `Cambiar la nota para la factura de ${line.service_name}`
                  : `Agregar una nota para la factura de ${line.service_name}`
              }
              aria-pressed={noteOpen}
              className={`grid size-10 place-items-center rounded-full hover:bg-surface-muted hover:text-ink ${line.detail ? 'text-accent' : 'text-ink-muted'}`}
              onClick={() => setNoteOpen(!noteOpen)}
              title="Nota para la factura"
              type="button"
            >
              <NotePencil aria-hidden="true" size={17} />
            </button>
            <button
              aria-label={`Retirar ${line.service_name}`}
              className="grid size-10 place-items-center rounded-full text-ink-muted hover:bg-danger-soft hover:text-danger"
              onClick={(event) => onRemove(event.currentTarget)}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </span>
        ) : (
          <span aria-hidden="true" className="w-20" />
        )}
      </div>
    </div>
  )
}

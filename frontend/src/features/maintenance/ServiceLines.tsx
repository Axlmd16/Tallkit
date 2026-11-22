import { LockSimple, NotePencil, Wrench, X } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  ConfirmationPanel,
  InlineNotice,
  Money,
  StatusBadge,
} from '@/shared/ui'

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
      className="overflow-hidden rounded-card border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-subtle/60 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-control bg-surface text-ink-muted ring-1 ring-line"
          >
            <Wrench size={16} />
          </span>
          <div className="leading-tight">
            <h2
              className="text-body font-bold text-ink"
              id="order-services-title"
            >
              Trabajos realizados
            </h2>
            <p className="text-micro text-ink-muted">
              {lineCount === 1 ? '1 trabajo' : `${lineCount} trabajos`}
            </p>
          </div>
        </div>
        <div className="text-right leading-tight">
          <span className="block text-micro text-ink-muted">Mano de obra</span>
          <Money
            amount={order.services_total}
            className="text-lead font-bold text-ink"
          />
        </div>
      </div>
      {error && (
        <div className="px-5 pt-3">
          <InlineNotice title="No se guardó el cambio" tone="danger">
            {error}
          </InlineNotice>
        </div>
      )}
      {canManage && open && (
        <ServiceAdder corrective={open.kind === 'CORRECTIVE'} order={order} />
      )}
      {lineCount > 0 && (
        <div
          aria-hidden="true"
          className="hidden items-center gap-4 border-y border-line bg-surface-subtle/40 px-5 py-2 text-micro font-semibold tracking-wider text-ink-muted uppercase sm:grid sm:grid-cols-[1.75rem_minmax(0,1fr)_7.5rem_7rem_4.5rem]"
        >
          <span>#</span>
          <span>Trabajo</span>
          <span className="text-center">Cantidad</span>
          <span className="text-right">Precio</span>
          <span />
        </div>
      )}
      {groups.map(({ intervention, lines }) => {
        if (lines.length === 0) return null
        return (
          <div key={intervention.id}>
            {order.interventions.length > 1 && (
              <h3 className="border-b border-line bg-surface-subtle/30 px-5 py-1.5 text-micro font-semibold text-ink-muted">
                {intervention.kind === 'CORRECTIVE'
                  ? `Intervención correctiva ${intervention.ordinal - 1} · sin cargo`
                  : 'Intervención inicial'}
              </h3>
            )}
            <div className="divide-y divide-line">
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
          </div>
        )
      })}
      {lineCount === 0 && (
        <p className="border-t border-line px-5 py-6 text-center text-body text-ink-muted">
          Todavía no hay trabajos. Agregue al menos uno para poder finalizar.
        </p>
      )}
      {lineCount > 0 && (
        <div className="flex items-center justify-between border-t border-line bg-surface-subtle/50 px-5 py-2.5 text-label">
          <span className="font-medium text-ink-muted">Total mano de obra</span>
          <Money
            amount={order.services_total}
            className="text-body font-bold text-ink"
          />
        </div>
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
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2.5 px-5 py-3 transition-colors hover:bg-surface-subtle/40 sm:grid-cols-[1.75rem_minmax(0,1fr)_7.5rem_7rem_4.5rem]">
      <span
        aria-hidden="true"
        className="hidden size-6 place-items-center rounded-full bg-surface-muted text-micro font-bold text-ink-muted tabular-nums sm:grid"
      >
        {n}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body font-semibold text-ink">
            {line.service_name}
          </span>
          {!line.service_is_active && (
            <StatusBadge label="Inactivo en catálogo" tone="neutral" />
          )}
          {line.no_charge && <StatusBadge label="Sin cargo" tone="info" />}
        </div>
        {noteOpen ? (
          <InlineField
            autoFocus
            className="mt-1.5 border-b border-line-strong py-1 text-label text-ink focus:border-ink"
            label={`Nota para la factura de ${line.service_name}`}
            onCommit={async (detail) => {
              await onSave({ detail })
              setNoteOpen(false)
            }}
            onUnchanged={() => setNoteOpen(false)}
            placeholder="Nota opcional para la factura"
            value={line.detail}
          />
        ) : (
          line.detail && (
            <p className="mt-0.5 text-label text-ink-muted">{line.detail}</p>
          )
        )}
        {!line.no_charge && line.documented_by && (
          <p
            className="mt-0.5 inline-flex items-center gap-1 text-micro text-ink-muted"
            title="Línea bloqueada por estar incluida en un recibo"
          >
            <LockSimple aria-hidden="true" size={11} />
            <span>Recibo {line.documented_by.number}</span>
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 sm:contents">
        <div className="flex items-center sm:justify-center">
          <QuantityStepper
            name={line.service_name}
            onChange={quantityChange}
            value={line.quantity}
          />
        </div>
        <div className="flex items-center justify-end">
          {canPrice && !locked ? (
            <InlineField
              align="right"
              className="h-9 w-24 border-b border-line-strong px-1 text-body font-bold text-ink tabular-nums focus:border-ink"
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
              className="text-body font-bold text-ink tabular-nums"
              role="textbox"
            >
              USD {line.applied_price}
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-0.5">
          {editable && (
            <>
              <button
                aria-label={
                  line.detail
                    ? `Cambiar la nota para la factura de ${line.service_name}`
                    : `Agregar una nota para la factura de ${line.service_name}`
                }
                aria-pressed={noteOpen}
                className={`grid size-8 place-items-center rounded-full hover:bg-surface-muted hover:text-ink ${line.detail ? 'text-accent' : 'text-ink-muted'}`}
                onClick={() => setNoteOpen(!noteOpen)}
                title="Nota para la factura"
                type="button"
              >
                <NotePencil aria-hidden="true" size={15} />
              </button>
              <button
                aria-label={`Retirar ${line.service_name}`}
                className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-danger-soft hover:text-danger"
                onClick={(event) => onRemove(event.currentTarget)}
                type="button"
              >
                <X aria-hidden="true" size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

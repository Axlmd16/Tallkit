import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import { Button, InlineNotice, Money, StatusBadge } from '@/shared/ui'

import { timestamp } from './format'
import { useMaintenanceMutations } from './hooks'
import { requestNotes, splitRequest } from './request'
import type {
  CommercialDocument,
  EconomicSummary,
  MaintenanceOrder,
  ServiceOperationSummary,
} from './types'

const card = 'rounded-card border border-line bg-surface'
const area =
  'min-h-[5.75rem] w-full resize-y rounded-group border border-line-strong bg-surface px-3.5 py-3 text-body leading-relaxed text-ink outline-none placeholder:text-ink-muted focus:border-ink focus:shadow-[0_0_0_3px_rgb(74_98_128/0.15)] read-only:bg-surface-subtle'

/**
 * Cuadro de texto de la orden que se guarda al salir de él, solo si cambió y la sesión puede
 * editar. El servidor valida la versión; un rechazo muestra el motivo y conserva lo escrito.
 */
function AutoSaveArea({
  order,
  field,
  title,
  hint,
  placeholder,
  editable,
  compose,
  initial,
  minHeight,
}: {
  order: MaintenanceOrder
  field: 'diagnosis' | 'notes'
  title: string
  hint?: string
  placeholder: string
  editable: boolean
  /** Arma el valor que viaja al servidor a partir del texto del cuadro. */
  compose: (text: string) => string
  /** Texto que se muestra en el cuadro a partir del valor guardado. */
  initial: string
  minHeight?: string
}) {
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const [text, setText] = useState(initial)
  const [error, setError] = useState('')
  useEffect(() => setText(initial), [initial])
  const id = `order-${field}`

  async function commit() {
    if (!editable || text.trim() === initial.trim()) return
    setError('')
    const data = { [field]: compose(text.trim()) }
    try {
      await tracker.run({ ...data, version: order.version }, (key) =>
        mutations.update.mutateAsync({
          id: order.id,
          data,
          expectedVersion: order.version,
          key,
        }),
      )
    } catch (failure) {
      setError(describeProblem(failure).message)
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`${card} flex flex-col gap-2.5 px-5 py-4`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-block font-bold" id={`${id}-title`}>
          {title}
        </h2>
        {hint && <span className="text-label text-ink-muted">{hint}</span>}
      </div>
      <textarea
        aria-labelledby={`${id}-title`}
        className={area}
        maxLength={5000}
        onBlur={() => void commit()}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        readOnly={!editable}
        style={minHeight ? { minHeight } : undefined}
        value={text}
      />
      {error && (
        <InlineNotice title="No se guardó" tone="danger">
          {error}
        </InlineNotice>
      )}
    </section>
  )
}

/** «Diagnóstico»: lo que encontró el mecánico. Obligatorio para finalizar. */
export function DiagnosisCard({
  order,
  editable,
}: {
  order: MaintenanceOrder
  editable: boolean
}) {
  return (
    <AutoSaveArea
      compose={(text) => text}
      editable={editable}
      field="diagnosis"
      hint="Lo que encontró el mecánico"
      initial={order.diagnosis}
      order={order}
      placeholder="Por ejemplo: pastillas delanteras gastadas al 90 %, discos en buen estado"
      title="Diagnóstico"
    />
  )
}

/**
 * «Observaciones»: el texto libre de la orden. Lo que pidió el cliente al abrirla viaja en la
 * primera línea de este mismo campo y se conserva al editar el resto.
 */
export function NotesCard({
  order,
  editable,
}: {
  order: MaintenanceOrder
  editable: boolean
}) {
  const { chips, text } = splitRequest(order.notes)
  return (
    <AutoSaveArea
      compose={(next) =>
        chips.length > 0
          ? `${requestNotes(chips)}${next ? `\n${next}` : ''}`
          : next
      }
      editable={editable}
      initial={text}
      minHeight="5.25rem"
      order={order}
      placeholder="Por ejemplo: el cliente trajo el aceite"
      title="Observaciones"
      field="notes"
    />
  )
}

/** Una sola tarjeta para el cierre: lo que falta para finalizar y, debajo, el cobro. */
export function ClosingPanel({ children }: { children: React.ReactNode }) {
  return <div className={`${card} overflow-hidden`}>{children}</div>
}

// --- Para finalizar -----------------------------------------------------------------------

interface Check {
  ok: boolean
  title: string
  detail: string
}

/** Pasos para finalizar a partir de lo que el servidor reporta como pendiente. */
export function finalizeChecks(order: MaintenanceOrder): Check[] {
  const pending = new Set(order.pending_requirements.map((r) => r.code))
  const open = order.interventions.find((i) => i.is_open)
  if (open?.kind === 'CORRECTIVE') {
    return [
      {
        ok: !pending.has('work_performed'),
        title: 'Corrección descrita',
        detail: 'Qué se hizo para corregir la falla',
      },
    ]
  }
  const lines = open?.lines.length ?? 0
  const partsPending = pending.has('pending_parts')
  return [
    {
      ok: !pending.has('diagnosis'),
      title: 'Diagnóstico escrito',
      detail: 'Lo que encontró el mecánico',
    },
    {
      ok: !pending.has('service_lines'),
      title: 'Al menos un trabajo',
      detail: lines > 0 ? `${lines} agregados` : 'Agregue lo que se hizo',
    },
    {
      ok: !partsPending,
      title: partsPending
        ? 'Repuestos sin confirmar'
        : 'Sin repuestos pendientes',
      detail: partsPending
        ? 'Confírmelos o quítelos'
        : 'Nada reservado sin confirmar',
    },
  ]
}

/** «Para finalizar»: avance de los requisitos y el botón de finalizar. */
export function FinalizeCard({
  order,
  onFinalize,
}: {
  order: MaintenanceOrder
  onFinalize: (event: { currentTarget: HTMLElement }) => void
}) {
  const checks = finalizeChecks(order)
  const done = checks.filter((c) => c.ok).length
  const ready = done === checks.length
  const canFinalize = order.allowed_actions.includes('finalize')
  const reopened = order.state === 'REOPENED'
  return (
    <section
      aria-labelledby="order-finalize-title"
      className="flex flex-col gap-2 px-6 py-6"
    >
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="text-figure font-bold" id="order-finalize-title">
          Para finalizar
        </h2>
        <span
          className={`text-body font-bold tabular-nums ${ready ? 'text-success' : 'text-ink-muted'}`}
        >
          {done} de {checks.length}
        </span>
      </div>
      <div aria-hidden="true" className="my-1.5 flex gap-1">
        {checks.map((check) => (
          <span
            className={`h-1.5 flex-1 rounded-full ${check.ok ? 'bg-success' : 'bg-line'}`}
            key={check.title}
          />
        ))}
      </div>
      <ul aria-label="Requisitos para finalizar">
        {checks.map((check) => (
          <li className="flex items-center gap-3.5 py-3" key={check.title}>
            <span
              aria-hidden="true"
              className={`grid size-8 shrink-0 place-items-center rounded-full text-body font-bold ${check.ok ? 'bg-success text-white' : 'bg-surface-muted text-ink-muted'}`}
            >
              {check.ok ? '✓' : ''}
            </span>
            <span className="leading-snug">
              <span
                className={`block text-lead font-semibold ${check.ok ? 'text-ink' : 'text-ink-muted'}`}
              >
                {check.title}
                <span className="sr-only">
                  {check.ok ? ' (completo)' : ' (pendiente)'}
                </span>
              </span>
              <span className="text-body text-ink-muted">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {canFinalize && (
        <Button
          className="mt-3 min-h-14 w-full text-lead"
          disabled={!ready}
          onClick={onFinalize}
          type="button"
        >
          {reopened ? 'Finalizar corrección' : 'Finalizar mantenimiento'}
        </Button>
      )}
    </section>
  )
}

// --- Cobro ----------------------------------------------------------------------------------

type Documents = readonly (CommercialDocument | ServiceOperationSummary)[]

/** Estado del cobro de la orden a partir de los documentos vigentes; el servidor lo calcula. */
export function collectionStatus(documents: Documents): {
  label: string
  tone: 'neutral' | 'warning' | 'success'
} {
  const live = documents.filter((doc) => doc.state === 'CONFIRMED')
  if (live.length === 0) return { label: 'Sin cobrar', tone: 'neutral' }
  if (live.every((doc) => doc.payment_state === 'PAID'))
    return { label: 'Cobrado', tone: 'success' }
  if (live.some((doc) => doc.payment_state && doc.payment_state !== 'PENDING'))
    return { label: 'Cobro parcial', tone: 'warning' }
  return { label: 'Sin cobrar', tone: 'neutral' }
}

/**
 * «Cobro»: lo que se cobra por negocio y el total, que junta dos negocios solo para informar.
 * «Cobrar y facturar» abre los cobros de cada negocio.
 */
export function CobroCard({
  order,
  summary,
  amounts,
  billingTo,
}: {
  order: MaintenanceOrder
  summary: EconomicSummary
  amounts: { labor: string | null; parts: string | null; total: string | null }
  billingTo: string
}) {
  const status = collectionStatus([
    ...summary.commercial.documents,
    ...summary.artisan.documents,
  ])
  const finalized = order.state === 'FINALIZED'
  return (
    <section
      aria-labelledby="order-cobro-title"
      className="flex flex-col gap-4 border-t border-line px-6 py-6"
    >
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 className="text-figure font-bold" id="order-cobro-title">
          Cobro
        </h2>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>
      <div className="flex flex-col gap-3">
        <span className="flex flex-col gap-1 text-body text-ink-muted">
          <span className="flex justify-between gap-3">
            Mano de obra{' '}
            <b className="font-semibold text-ink">
              <Money amount={amounts.labor} />
            </b>
          </span>
          <span className="flex justify-between gap-3">
            Repuestos{' '}
            <b className="font-semibold text-ink">
              <Money amount={amounts.parts} />
            </b>
          </span>
        </span>
        <span className="border-t border-line pt-3">
          <span className="block text-label font-medium text-ink-muted">
            Total a cobrar
          </span>
          <span className="block text-display font-light tracking-tight tabular-nums">
            <Money amount={amounts.total} className="text-left" />
          </span>
        </span>
      </div>
      <Link
        className={`ui-button inline-flex min-h-14 w-full items-center justify-center rounded-control border px-4 text-lead font-semibold ${finalized ? 'border-primary bg-primary text-white hover:bg-primary-strong' : 'border-ink text-ink hover:bg-ink hover:text-white'}`}
        to={billingTo}
      >
        Cobrar y facturar
      </Link>
      {!finalized && (
        <span className="text-center text-body text-ink-muted">
          Se puede cobrar antes o después de finalizar.
        </span>
      )}
    </section>
  )
}

// --- Movimientos ---------------------------------------------------------------------------

/** «Movimientos de esta orden»: apertura y cambios de estado, del más antiguo al más reciente. */
export function MovesLog({ order }: { order: MaintenanceOrder }) {
  const moves = [
    {
      key: 'open',
      text: `Abierto por ${order.created_by.name}`,
      when: order.created_at,
      tone: 'bg-accent',
    },
    ...order.transitions.map((t) => ({
      key: `t${t.id}`,
      text:
        t.to_state === 'FINALIZED'
          ? `Finalizado por ${t.actor.name}`
          : `Reabierto por ${t.actor.name}${t.reason ? `: ${t.reason}` : ''}`,
      when: t.occurred_at,
      tone: t.to_state === 'FINALIZED' ? 'bg-success' : 'bg-warning',
    })),
  ]
  return (
    <section aria-labelledby="order-moves-title" className="px-1.5">
      <h2
        className="mb-1.5 text-label font-semibold text-ink-muted"
        id="order-moves-title"
      >
        Movimientos de esta orden
      </h2>
      <ul>
        {moves.map((move) => (
          <li
            className="grid grid-cols-[0.875rem_minmax(0,1fr)] gap-3 py-1.5"
            key={move.key}
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2.5 rounded-full ${move.tone}`}
            />
            <span className="text-label leading-snug text-ink">
              {move.text}{' '}
              <span className="text-ink-muted tabular-nums">
                · {timestamp(move.when)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

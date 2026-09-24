import { useState } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Field,
  FormModal,
  InlineNotice,
  Money,
  Textarea,
} from '@/shared/ui'

import { kilometers, timestamp } from './format'
import { useMaintenanceMutations } from './hooks'
import { orderStateLabels, type MaintenanceOrder } from './types'

/** Resumen antes de finalizar; los requisitos pendientes los calcula el servidor. */
export function FinalizeDialog({
  order,
  onClose,
  onDone,
  returnFocusRef,
}: {
  order: MaintenanceOrder
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const pending = order.pending_requirements
  const open = order.interventions.find((i) => i.is_open)
  const lineCount = open?.lines.length ?? 0

  async function save(): Promise<boolean> {
    try {
      await tracker.run({ finalize: order.id, version: order.version }, (key) =>
        mutations.finalize.mutateAsync({
          id: order.id,
          expectedVersion: order.version,
          key,
        }),
      )
      onDone(`Orden ${order.number} finalizada.`)
      return true
    } catch (error) {
      throw new Error(describeProblem(error).message, { cause: error })
    }
  }

  return (
    <FormModal
      description="Finalizar bloquea los cambios de datos, servicios y fotografías. No genera ventas, cobros ni facturas."
      onClose={onClose}
      onSave={save}
      open
      returnFocusRef={returnFocusRef}
      saveDisabled={pending.length > 0}
      saveLabel="Finalizar orden"
      title={`Finalizar ${order.number}`}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <dt className="text-ink-muted">Cliente</dt>
        <dd>{order.customer.name}</dd>
        <dt className="text-ink-muted">Vehículo</dt>
        <dd>{order.vehicle.plate}</dd>
        <dt className="text-ink-muted">Kilometraje</dt>
        <dd>{kilometers(order.odometer_km)}</dd>
        <dt className="text-ink-muted">Servicios en la intervención</dt>
        <dd>{lineCount}</dd>
        <dt className="text-ink-muted">Fotografías</dt>
        <dd>{order.photos.length}</dd>
        <dt className="text-ink-muted">Total de servicios de la orden</dt>
        <dd>
          <Money amount={order.services_total} />
        </dd>
      </dl>
      <div className="mt-4">
        {pending.length > 0 ? (
          <InlineNotice
            title="Requisitos pendientes para finalizar"
            tone="warning"
          >
            <ul className="list-disc pl-5">
              {pending.map((r) => (
                <li key={r.code}>{r.message}</li>
              ))}
            </ul>
          </InlineNotice>
        ) : (
          <InlineNotice title="La orden cumple los requisitos" tone="success" />
        )}
      </div>
    </FormModal>
  )
}

/** Reapertura por falla atribuible al trabajo anterior: exige causa y abre una intervención correctiva. */
export function ReopenDialog({
  order,
  onClose,
  onDone,
  returnFocusRef,
}: {
  order: MaintenanceOrder
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const trimmed = reason.trim()

  async function save(): Promise<boolean> {
    if (!trimmed) {
      setError('Indique la causa atribuible al trabajo anterior.')
      return false
    }
    try {
      await tracker.run({ reopen: order.id, reason: trimmed }, (key) =>
        mutations.reopen.mutateAsync({
          id: order.id,
          reason: trimmed,
          expectedVersion: order.version,
          key,
        }),
      )
      onDone(`Orden ${order.number} reabierta con una intervención correctiva.`)
      return true
    } catch (caught) {
      const problem = describeProblem(caught)
      if (problem.fields.reason) setError(problem.fields.reason)
      throw new Error(problem.message, { cause: caught })
    }
  }

  return (
    <FormModal
      description="Use la reapertura solo cuando el vehículo regresa por una falla atribuible al trabajo anterior. Una falla nueva requiere otra orden."
      dirty={Boolean(trimmed)}
      onClose={onClose}
      onSave={save}
      open
      returnFocusRef={returnFocusRef}
      saveLabel="Reabrir orden"
      title={`Reabrir ${order.number}`}
    >
      <div className="space-y-4">
        <InlineNotice title="Qué ocurre al reabrir" tone="info">
          La orden volverá a admitir cambios solo en una nueva intervención
          correctiva, con servicios sin cargo. La intervención inicial y los
          cierres anteriores se conservan sin cambios.
        </InlineNotice>
        <Field
          error={error}
          id="reopen-reason"
          label="Causa de la reapertura"
          required
        >
          <Textarea
            id="reopen-reason"
            maxLength={1000}
            onChange={(event) => {
              setError('')
              setReason(event.target.value)
            }}
            rows={3}
            value={reason}
          />
        </Field>
      </div>
    </FormModal>
  )
}

/** Intervenciones inicial y correctivas; solo la correctiva abierta es editable. */
export function InterventionsSection({
  order,
  onDone,
}: {
  order: MaintenanceOrder
  onDone: (message: string) => void
}) {
  const correctives = order.interventions.filter((i) => i.kind === 'CORRECTIVE')
  if (correctives.length === 0) return null
  return (
    <section
      aria-labelledby="order-interventions-title"
      className="rounded-panel border border-line bg-surface"
    >
      <h2
        className="border-b border-line px-4 py-3 text-[14.5px] font-semibold text-ink"
        id="order-interventions-title"
      >
        Intervenciones correctivas
      </h2>
      <ol className="divide-y divide-line">
        {correctives.map((intervention) => (
          <li className="space-y-2 px-4 py-3 text-[13px]" key={intervention.id}>
            <p className="font-semibold text-ink">
              Corrección {intervention.ordinal - 1} ·{' '}
              {intervention.is_open
                ? 'abierta'
                : `cerrada ${timestamp(intervention.closed_at)}`}
            </p>
            <p>
              <span className="text-ink-muted">Causa: </span>
              {intervention.cause}
            </p>
            {intervention.is_open &&
            order.allowed_actions.includes('edit_intervention') ? (
              <CorrectiveEditor
                initialNotes={intervention.notes}
                initialWork={intervention.work_performed}
                onDone={onDone}
                order={order}
              />
            ) : (
              <>
                <p>
                  <span className="text-ink-muted">Trabajo realizado: </span>
                  {intervention.work_performed || '—'}
                </p>
                {intervention.notes && (
                  <p>
                    <span className="text-ink-muted">Observaciones: </span>
                    {intervention.notes}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function CorrectiveEditor({
  order,
  initialWork,
  initialNotes,
  onDone,
}: {
  order: MaintenanceOrder
  initialWork: string
  initialNotes: string
  onDone: (message: string) => void
}) {
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const [work, setWork] = useState(initialWork)
  const [notes, setNotes] = useState(initialNotes)
  const [error, setError] = useState('')
  const dirty = work !== initialWork || notes !== initialNotes
  const saving = mutations.updateIntervention.isPending

  async function save() {
    setError('')
    const data = { work_performed: work, notes }
    try {
      await tracker.run(data, (key) =>
        mutations.updateIntervention.mutateAsync({
          id: order.id,
          data,
          expectedVersion: order.version,
          key,
        }),
      )
      onDone('Intervención correctiva guardada.')
    } catch (caught) {
      setError(describeProblem(caught).message)
    }
  }

  return (
    <div className="space-y-3">
      <Field id="corrective-work" label="Trabajo correctivo realizado" required>
        <Textarea
          id="corrective-work"
          maxLength={5000}
          onChange={(event) => setWork(event.target.value)}
          rows={3}
          value={work}
        />
      </Field>
      <Field id="corrective-notes" label="Observaciones de la corrección">
        <Textarea
          id="corrective-notes"
          maxLength={5000}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          value={notes}
        />
      </Field>
      {error && (
        <InlineNotice title="No se guardó la intervención" tone="danger">
          {error}
        </InlineNotice>
      )}
      <Button
        disabled={!dirty || saving}
        onClick={() => void save()}
        type="button"
        variant="secondary"
      >
        {saving ? 'Guardando…' : 'Guardar intervención'}
      </Button>
    </div>
  )
}

/** Historial inmutable de finalizaciones y reaperturas. */
export function TransitionTimeline({ order }: { order: MaintenanceOrder }) {
  return (
    <section
      aria-labelledby="order-history-title"
      className="rounded-panel border border-line bg-surface"
    >
      <h2
        className="border-b border-line px-4 py-3 text-[14.5px] font-semibold text-ink"
        id="order-history-title"
      >
        Historial
      </h2>
      <ol className="space-y-3 px-4 py-3 text-[13px]">
        <li>
          <p className="font-medium text-ink">Orden registrada</p>
          <p className="text-xs text-ink-muted">
            {order.created_by.name} · {timestamp(order.created_at)}
          </p>
        </li>
        {order.transitions.map((t) => (
          <li key={t.id}>
            <p className="font-medium text-ink">
              {orderStateLabels[t.from_state]} → {orderStateLabels[t.to_state]}
            </p>
            <p className="text-xs text-ink-muted">
              {t.actor.name} · {timestamp(t.occurred_at)}
            </p>
            {t.reason && <p className="mt-0.5">Causa: {t.reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}

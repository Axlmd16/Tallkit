import {
  CheckCircle,
  Circle,
  ClockCounterClockwise,
  FloppyDisk,
  Wrench,
} from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Field,
  FormModal,
  InlineNotice,
  Money,
  SectionPanel,
  Textarea,
} from '@/shared/ui'

import { kilometers, timestamp } from './format'
import { useMaintenanceMutations } from './hooks'
import { type Intervention, type MaintenanceOrder } from './types'

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
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
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
        <InlineNotice
          title="Documentos y pagos conservan sus efectos"
          tone="warning"
        >
          Reabrir no anula ventas ni operaciones de servicios, no repone
          inventario ni revierte pagos. Durante la corrección no se agregan
          repuestos cobrables.
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

/** Paso de la corrección con su estado; los opcionales nunca bloquean la finalización. */
function Step({
  done,
  title,
  detail,
}: {
  done: boolean
  title: string
  detail: string
}) {
  return (
    <li className="flex gap-2.5">
      {done ? (
        <CheckCircle
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-success"
          size={18}
          weight="fill"
        />
      ) : (
        <Circle
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-ink-muted"
          size={18}
        />
      )}
      <div className="min-w-0">
        <p className="text-body font-medium text-ink">
          {title}
          <span className="sr-only">
            {done ? ' (completo)' : ' (pendiente)'}
          </span>
        </p>
        <p className="text-label text-ink-muted">{detail}</p>
      </div>
    </li>
  )
}

/**
 * Intervenciones correctivas. La abierta se presenta como un espacio de trabajo con el tono
 * del RUC artesanal, su causa, los pasos y el registro; las cerradas, como línea de tiempo.
 */
export function InterventionsSection({
  order,
  onDone,
}: {
  order: MaintenanceOrder
  onDone: (message: string) => void
}) {
  const correctives = order.interventions.filter((i) => i.kind === 'CORRECTIVE')
  if (correctives.length === 0) return null
  const open = correctives.find((i) => i.is_open)
  const closed = correctives.filter((i) => !i.is_open)
  return (
    <>
      {open && (
        <CorrectionWorkspace
          intervention={open}
          onDone={onDone}
          order={order}
        />
      )}
      {closed.length > 0 && (
        <SectionPanel
          description="Se conservan tal como se cerraron."
          icon={<ClockCounterClockwise size={17} />}
          id="order-closed-corrections-title"
          title={
            open ? 'Correcciones anteriores' : 'Intervenciones correctivas'
          }
        >
          <ol className="relative space-y-4 px-4 py-4 before:absolute before:top-5 before:bottom-5 before:left-[27px] before:w-px before:bg-line">
            {closed.map((intervention) => (
              <li className="relative flex gap-3" key={intervention.id}>
                <span
                  aria-hidden="true"
                  className="z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-scope-artisan-soft text-micro font-bold text-scope-artisan ring-4 ring-surface"
                >
                  {intervention.ordinal - 1}
                </span>
                <div className="min-w-0 flex-1 rounded-control border border-line px-3 py-2.5 text-body">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">
                      Corrección {intervention.ordinal - 1}
                    </p>
                    <p className="text-label text-ink-muted">
                      Cerrada {timestamp(intervention.closed_at)}
                    </p>
                  </div>
                  <p className="mt-1">
                    <span className="text-ink-muted">Causa: </span>
                    {intervention.cause}
                  </p>
                  <p className="mt-1 whitespace-pre-line">
                    <span className="text-ink-muted">Trabajo realizado: </span>
                    {intervention.work_performed || '—'}
                  </p>
                  {intervention.notes && (
                    <p className="mt-1 whitespace-pre-line">
                      <span className="text-ink-muted">Observaciones: </span>
                      {intervention.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </SectionPanel>
      )}
    </>
  )
}

function CorrectionWorkspace({
  order,
  intervention,
  onDone,
}: {
  order: MaintenanceOrder
  intervention: Intervention
  onDone: (message: string) => void
}) {
  const number = intervention.ordinal - 1
  const editable = order.allowed_actions.includes('edit_intervention')
  const photos = order.photos.filter(
    (p) => p.intervention_id === intervention.id,
  )
  const workDone = intervention.work_performed.trim().length > 0
  return (
    <section
      aria-labelledby="order-correction-title"
      className="overflow-hidden rounded-panel border border-scope-artisan/30 bg-surface shadow-[inset_4px_0_0_var(--color-scope-artisan)]"
    >
      <div className="space-y-3 border-b border-scope-artisan/20 bg-scope-artisan-soft px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-control bg-surface text-scope-artisan ring-1 ring-scope-artisan/25"
            >
              <Wrench size={17} />
            </span>
            <h2
              className="text-lead font-semibold text-ink"
              id="order-correction-title"
            >
              Corrección {number} en curso
            </h2>
            <span className="rounded-chip bg-surface px-2 py-0.5 text-label font-semibold text-scope-artisan ring-1 ring-scope-artisan/25">
              Sin cargo al cliente
            </span>
          </div>
          <p className="text-label text-ink-muted">
            Reabierta por {intervention.opened_by.name} ·{' '}
            {timestamp(intervention.opened_at)}
          </p>
        </div>
        <div className="rounded-control bg-surface/70 px-3 py-2 text-body">
          <p className="text-label font-semibold text-scope-artisan">
            Causa de la reapertura
          </p>
          <p className="mt-0.5 whitespace-pre-line text-ink">
            {intervention.cause}
          </p>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="p-5">
          {editable ? (
            <CorrectiveEditor
              initialNotes={intervention.notes}
              initialWork={intervention.work_performed}
              onDone={onDone}
              order={order}
            />
          ) : (
            <dl className="space-y-3 text-body">
              <div>
                <dt className="text-label text-ink-muted">
                  Trabajo correctivo realizado
                </dt>
                <dd className="mt-1 whitespace-pre-line">
                  {intervention.work_performed || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">
                  Observaciones de la corrección
                </dt>
                <dd className="mt-1 whitespace-pre-line">
                  {intervention.notes || '—'}
                </dd>
              </div>
            </dl>
          )}
        </div>
        <div className="border-t border-line bg-surface-subtle p-5 lg:border-t-0 lg:border-l">
          <h3 className="text-label font-semibold tracking-wide text-ink-muted uppercase">
            Pasos de la corrección
          </h3>
          <ol aria-label="Pasos de la corrección" className="mt-3 space-y-3">
            <Step
              detail={workDone ? 'Guardado.' : 'Obligatorio para finalizar.'}
              done={workDone}
              title="Trabajo correctivo"
            />
            <Step
              detail={`${intervention.lines.length} registrados · opcional`}
              done={intervention.lines.length > 0}
              title="Servicios sin cargo"
            />
            <Step
              detail={`${photos.length} adjuntas · opcional`}
              done={photos.length > 0}
              title="Fotografías de la corrección"
            />
            <Step
              detail={
                order.pending_requirements.length === 0
                  ? 'Todo listo: use «Finalizar corrección» arriba.'
                  : 'Disponible al completar lo obligatorio.'
              }
              done={false}
              title="Finalizar la corrección"
            />
          </ol>
        </div>
      </div>
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

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!dirty || saving) return
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
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => void save(event)}
    >
      <Field
        hint="Describa qué se revisó y corrigió. Es obligatorio para finalizar."
        id="corrective-work"
        label="Trabajo correctivo realizado"
        required
      >
        <Textarea
          id="corrective-work"
          maxLength={5000}
          onChange={(event) => setWork(event.target.value)}
          placeholder="Ej.: se reajustaron los calipers y se verificó el torque de las ruedas."
          rows={4}
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p aria-live="polite" className="text-label text-ink-muted">
          {saving
            ? 'Guardando…'
            : dirty
              ? 'Cambios sin guardar.'
              : 'Sin cambios pendientes.'}
        </p>
        <Button disabled={!dirty || saving} type="submit">
          <FloppyDisk aria-hidden="true" size={16} />
          {saving ? 'Guardando…' : 'Guardar corrección'}
        </Button>
      </div>
    </form>
  )
}

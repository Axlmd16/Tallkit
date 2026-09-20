import { useState, type FormEvent, type RefObject } from 'react'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { useProductOptions } from '@/features/purchases/pickers'
import {
  ReferencePicker,
  type PickerOption,
} from '@/features/purchases/ReferencePicker'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import {
  Button,
  Drawer,
  Field,
  InlineNotice,
  Input,
  Select,
  Textarea,
} from '@/shared/ui'

import { useOperationMutations } from './hooks'
import {
  kindLabels,
  type AdminOperation,
  type ManualKind,
  type OperationReview,
} from './types'

const MANUAL: ManualKind[] = ['INITIAL_LOAD', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']

/**
 * Carga inicial y ajustes en un solo Drawer: preparar, revisar el efecto y confirmar
 * son pasos del mismo panel, de modo que nunca se superponen dos trampas de foco.
 */
export function AdjustmentDrawer({
  open,
  onClose,
  onDone,
  initialProduct = null,
  returnFocusRef,
}: {
  open: boolean
  onClose: () => void
  onDone: (message: string) => void
  initialProduct?: PickerOption | null
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useOperationMutations()
  const latest = useLatestReview<OperationReview>()
  const createTracker = useIntentTracker()
  const confirmTracker = useIntentTracker()
  const [kind, setKind] = useState<ManualKind>('ADJUSTMENT_OUT')
  const [product, setProduct] = useState<PickerOption | null>(initialProduct)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [operation, setOperation] = useState<AdminOperation | null>(null)
  const [pending, setPending] = useState(false)
  const entry = kind !== 'ADJUSTMENT_OUT'
  const dirty = Boolean(quantity || reason || notes || unitCost || product)

  function edit(action: () => void) {
    action()
    setOperation(null)
    latest.invalidate()
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!product) next.product_id = 'Seleccione un producto.'
    if (!/^\d+$/.test(quantity.trim()) || /^0+$/.test(quantity.trim()))
      next.quantity = 'Ingrese una cantidad entera mayor que cero.'
    if (entry && !/^\d+(\.\d{1,6})?$/.test(unitCost.trim()))
      next.unit_cost =
        'El costo inventariable de la entrada es obligatorio (hasta 6 decimales).'
    if (!reason.trim()) next.reason = 'El motivo es obligatorio.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function prepare(event: FormEvent) {
    event.preventDefault()
    if (pending || !validate() || !product) return
    setPending(true)
    setProblem(null)
    const data = {
      kind,
      product_id: product.id,
      quantity: quantity.trim(),
      ...(entry ? { unit_cost: unitCost.trim() } : {}),
      reason: reason.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }
    try {
      const created = await createTracker.run(data, (key) =>
        mutations.create.mutateAsync({ data, key }),
      )
      setOperation(created)
      await latest.request(() => mutations.preview.mutateAsync(created.id))
    } catch (error) {
      const view = describeProblem(error)
      setProblem(view)
      setErrors(view.fields)
    } finally {
      setPending(false)
    }
  }

  async function confirm() {
    const review = latest.review
    if (!operation || !review?.review_token || pending) return
    const payload = {
      id: operation.id,
      expectedVersion: operation.version,
      reviewToken: review.review_token,
    }
    setPending(true)
    try {
      await confirmTracker.run(payload, (key) =>
        mutations.confirm.mutateAsync({ ...payload, key }),
      )
      onDone(`${kindLabels[kind]} contabilizada: ${operation.reference}.`)
    } catch (error) {
      setProblem(describeProblem(error))
      if (error instanceof ProblemError && error.code === 'review_required') {
        await latest.request(() => mutations.preview.mutateAsync(operation.id))
      }
    } finally {
      setPending(false)
    }
  }

  const review = latest.review
  return (
    <Drawer
      description="Registre una carga inicial o un ajuste justificado. El sistema resuelve la bodega y valora las salidas al costo promedio vigente."
      hasUnsavedChanges={dirty && !operation}
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Carga inicial y ajustes"
    >
      <form className="space-y-4" onSubmit={(event) => void prepare(event)}>
        {problem && (
          <InlineNotice title="No se pudo completar" tone="danger">
            {problem.message}
          </InlineNotice>
        )}
        <Field id="adjust-kind" label="Tipo de operación">
          <Select
            disabled={operation !== null}
            id="adjust-kind"
            onChange={(event) =>
              edit(() => setKind(event.target.value as ManualKind))
            }
            value={kind}
          >
            {MANUAL.map((value) => (
              <option key={value} value={value}>
                {kindLabels[value]}
              </option>
            ))}
          </Select>
        </Field>
        <ReferencePicker
          disabled={operation !== null}
          error={errors.product_id}
          id="adjust-product"
          inactiveHelp="Producto inactivo: solo admite salidas justificadas."
          label="Producto"
          onSelect={(option) => edit(() => setProduct(option))}
          selected={product}
          useOptions={useProductOptions}
        />
        <Field
          error={errors.quantity}
          id="adjust-quantity"
          label="Cantidad de presentaciones"
        >
          <Input
            disabled={operation !== null}
            id="adjust-quantity"
            inputMode="numeric"
            onChange={(event) => edit(() => setQuantity(event.target.value))}
            value={quantity}
          />
        </Field>
        {entry && (
          <Field
            error={errors.unit_cost}
            hint="Costo inventariable explícito por presentación, en USD."
            id="adjust-cost"
            label="Costo unitario"
          >
            <Input
              disabled={operation !== null}
              id="adjust-cost"
              inputMode="decimal"
              onChange={(event) => edit(() => setUnitCost(event.target.value))}
              value={unitCost}
            />
          </Field>
        )}
        <Field error={errors.reason} id="adjust-reason" label="Motivo">
          <Textarea
            disabled={operation !== null}
            id="adjust-reason"
            maxLength={2000}
            onChange={(event) => edit(() => setReason(event.target.value))}
            value={reason}
          />
        </Field>
        <Field id="adjust-notes" label="Observación">
          <Textarea
            disabled={operation !== null}
            id="adjust-notes"
            maxLength={2000}
            onChange={(event) => edit(() => setNotes(event.target.value))}
            value={notes}
          />
        </Field>
        {!operation && (
          <Button disabled={pending} type="submit">
            {pending ? 'Preparando…' : 'Preparar y revisar'}
          </Button>
        )}
      </form>
      {operation && review && (
        <section aria-label="Revisión del efecto" className="mt-6 space-y-3">
          <h3 className="font-semibold text-ink">Revisión del efecto</h3>
          {review.issues.length > 0 && (
            <InlineNotice title="No se puede confirmar" tone="danger">
              <ul className="list-disc pl-5">
                {review.issues.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            </InlineNotice>
          )}
          {review.effects?.map((effect) => (
            <p key={effect.product_id}>
              Existencia actual {effect.current_quantity}; resultará{' '}
              <strong>{effect.resulting_quantity}</strong>.
            </p>
          ))}
          <p className="text-sm text-ink-muted">
            {operation.reference} queda preparada; abandonarla no cambia
            existencias.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending || !review.can_confirm}
              onClick={() => void confirm()}
              type="button"
            >
              {pending ? 'Confirmando…' : 'Confirmar operación'}
            </Button>
            <Button onClick={onClose} type="button" variant="secondary">
              Abandonar sin confirmar
            </Button>
          </div>
        </section>
      )}
    </Drawer>
  )
}

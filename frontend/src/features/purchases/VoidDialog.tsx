import { useEffect, useState, type RefObject } from 'react'
import { Link } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import {
  Button,
  Dialog,
  Field,
  InlineNotice,
  LoadingState,
  Textarea,
} from '@/shared/ui'

import { usePurchaseMutations } from './hooks'
import type { Purchase, VoidReview } from './types'

/**
 * Anulación con vista previa separada: explica el efecto compensatorio y, si no es
 * seguro, el producto y la referencia interna del primer movimiento que lo impide.
 */
export function VoidDialog({
  purchase,
  open,
  canOpenInventory,
  onClose,
  onDone,
  returnFocusRef,
}: {
  purchase: Purchase
  open: boolean
  canOpenInventory: boolean
  onClose: () => void
  onDone: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = usePurchaseMutations()
  const latest = useLatestReview<VoidReview>()
  const tracker = useIntentTracker()
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [pending, setPending] = useState(false)
  const { request } = latest
  const { mutateAsync: previewVoid } = mutations.voidPreview

  useEffect(() => {
    // La revisión se solicita al abrir; una edición del motivo no la invalida.
    if (open) void request(() => previewVoid(purchase.id))
  }, [open, purchase.id, request, previewVoid])

  const review = latest.review
  const reasonError =
    reason.trim().length === 0
      ? 'El motivo es obligatorio.'
      : reason.trim().length > 2000
        ? 'El motivo no puede exceder 2000 caracteres.'
        : undefined

  async function submit() {
    if (!review?.review_token || reasonError || pending) return
    const payload = {
      id: purchase.id,
      expectedVersion: purchase.version,
      reviewToken: review.review_token,
      reason: reason.trim(),
    }
    setPending(true)
    setProblem(null)
    try {
      await tracker.run(payload, (key) =>
        mutations.void.mutateAsync({ ...payload, key }),
      )
      onDone()
    } catch (error) {
      setProblem(describeProblem(error))
      void request(() => previewVoid(purchase.id))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      description="Ingreso del RUC comercial. Anular compensa exactamente su efecto en las existencias y conserva el original con su número. No representa una devolución física al proveedor."
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Anular ingreso de mercadería"
      tone="danger"
    >
      <div className="space-y-4">
        {latest.pending && !review && (
          <LoadingState label="Calculando el efecto…" />
        )}
        {problem && (
          <InlineNotice title="No se anuló el ingreso" tone="danger">
            {problem.message}
          </InlineNotice>
        )}
        {review && review.issues.length > 0 && (
          <InlineNotice title="No se puede anular este ingreso" tone="danger">
            <ul className="list-disc pl-5">
              {review.issues.map((issue) => (
                <li key={`${issue.product_id}-${issue.code}`}>
                  Producto{' '}
                  <strong>{issue.product_code ?? issue.product_id}</strong>:{' '}
                  {issue.message}
                  {issue.blocking_reference &&
                    (canOpenInventory ? (
                      <>
                        {' '}
                        Movimiento posterior:{' '}
                        <Link
                          className="font-mono font-semibold text-accent underline"
                          to={`/inventory/operations/${issue.blocking_reference.replace('INV-', '')}`}
                        >
                          {issue.blocking_reference}
                        </Link>
                        .
                      </>
                    ) : (
                      <> Movimiento posterior: {issue.blocking_reference}.</>
                    ))}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Si necesita corregir existencias, registre un ajuste justificado
              desde Inventario.
            </p>
          </InlineNotice>
        )}
        {review && review.effects.length > 0 && (
          <section aria-label="Efecto de la anulación">
            <h3 className="font-semibold text-ink">Efecto de la anulación</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {review.effects.map((effect) => (
                <li key={effect.product_id}>
                  <strong>{effect.code}</strong>: se restituyen las existencias
                  previas (actualmente {effect.current_quantity}; se retiran{' '}
                  {effect.quantity_to_remove}).
                </li>
              ))}
            </ul>
          </section>
        )}
        <Field
          error={reason ? reasonError : undefined}
          id="void-reason"
          label="Motivo de la anulación"
        >
          <Textarea
            id="void-reason"
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="secondary">
            Conservar ingreso
          </Button>
          <Button
            disabled={pending || !review?.can_void || Boolean(reasonError)}
            onClick={() => void submit()}
            type="button"
            variant="danger-solid"
          >
            {pending ? 'Anulando…' : 'Anular ingreso'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

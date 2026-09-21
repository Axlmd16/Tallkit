import { useEffect, useState, type RefObject } from 'react'
import { Link } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import { ProblemError } from '@/shared/api/client'
import { Button, Dialog, InlineNotice, LoadingState } from '@/shared/ui'

import { usd } from './format'
import { useSaleMutations } from './hooks'
import type { Sale, SaleReview } from './types'

/**
 * Revisión y confirmación de una venta guardada. La revisión es de solo lectura; el
 * usuario confirma con el token que devolvió. Ante ``review_required`` o ``stale_record``
 * conserva su captura y ofrece revisar de nuevo, sin sobrescritura automática.
 */
export function SaleReviewDialog({
  sale,
  open,
  onClose,
  onConfirmed,
  returnFocusRef,
}: {
  sale: Sale
  open: boolean
  onClose: () => void
  onConfirmed: (sale: Sale) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useSaleMutations()
  const latest = useLatestReview<SaleReview>()
  const tracker = useIntentTracker()
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [stale, setStale] = useState<'review_required' | 'stale_record' | null>(
    null,
  )
  const [pending, setPending] = useState(false)
  const { request } = latest
  const { mutateAsync: preview } = mutations.preview

  useEffect(() => {
    if (open) void request(() => preview(sale.id))
  }, [open, sale.id, request, preview])

  const review = latest.review

  async function confirm() {
    if (!review?.review_token || pending) return
    const payload = {
      id: sale.id,
      expectedVersion: sale.version,
      reviewToken: review.review_token,
    }
    setPending(true)
    setProblem(null)
    setStale(null)
    try {
      const confirmed = await tracker.run(payload, (key) =>
        mutations.confirm.mutateAsync({ ...payload, key }),
      )
      onConfirmed(confirmed)
    } catch (error) {
      setProblem(describeProblem(error))
      if (error instanceof ProblemError) {
        if (error.code === 'review_required') setStale('review_required')
        if (error.code === 'stale_record') setStale('stale_record')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      description="La revisión compara datos y existencias actuales. Confirmar descuenta el inventario, asigna el número interno y no registra ningún cobro."
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Revisar y confirmar venta"
    >
      <div className="space-y-4">
        {latest.pending && !review && (
          <LoadingState label="Revisando la venta…" />
        )}
        {problem && (
          <InlineNotice
            title={
              stale === 'review_required'
                ? 'Los datos cambiaron desde la revisión'
                : stale === 'stale_record'
                  ? 'La venta cambió desde que la abrió'
                  : 'No se confirmó la venta'
            }
            tone="danger"
          >
            <p>{problem.message}</p>
            {stale === 'review_required' && (
              <div className="mt-3">
                <Button
                  onClick={() => void request(() => preview(sale.id))}
                  type="button"
                  variant="secondary"
                >
                  Revisar de nuevo
                </Button>
              </div>
            )}
            {stale === 'stale_record' && (
              <p className="mt-2">
                Su captura no se sobrescribió. Recargue la venta guardada para
                revisar los cambios antes de continuar.
              </p>
            )}
          </InlineNotice>
        )}
        {review && review.issues.length > 0 && (
          <InlineNotice title="No se puede confirmar todavía" tone="danger">
            <ul className="list-disc pl-5">
              {review.issues.map((issue) => (
                <li key={`${issue.field}-${issue.code}`}>
                  {issue.field.startsWith('lines.')
                    ? `Línea ${Number(issue.field.split('.')[1]) + 1}: `
                    : ''}
                  {issue.message}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Corrija la venta o su configuración y revise de nuevo. Su borrador
              se conserva.
            </p>
          </InlineNotice>
        )}
        {review?.totals && (
          <section aria-label="Importes revisados">
            <h3 className="font-semibold text-ink">
              Importes según el servidor
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <dt>Base imponible</dt>
              <dd className="text-right">{usd(review.totals.base)}</dd>
              <dt>Impuesto</dt>
              <dd className="text-right">{usd(review.totals.tax)}</dd>
              <dt className="font-bold">Total</dt>
              <dd className="text-right font-bold">
                {usd(review.totals.total)}
              </dd>
            </dl>
          </section>
        )}
        {review && review.effects.length > 0 && (
          <section aria-label="Efecto en existencias">
            <h3 className="font-semibold text-ink">Efecto en existencias</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {review.effects.map((effect) => (
                <li key={effect.product_id}>
                  <strong>{effect.code}</strong>: {effect.current_quantity} →{' '}
                  {effect.resulting_quantity} (se venden{' '}
                  {effect.quantity_to_sell})
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
          {stale === 'stale_record' && (
            <Link
              className="underline"
              to={`/sales/${sale.id}/edit`}
              onClick={onClose}
            >
              Recargar venta guardada
            </Link>
          )}
          <Button
            disabled={pending || !review?.can_confirm}
            onClick={() => void confirm()}
            type="button"
          >
            {pending ? 'Confirmando…' : 'Confirmar venta'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

import { Warning } from '@phosphor-icons/react'
import { useRef, useState, type RefObject } from 'react'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import { Button, Dialog, InlineNotice, LoadingState } from '@/shared/ui'

import { documentDate, usd } from './format'
import { useIssuePreview, useProformaMutations } from './hooks'
import { issueText } from './issueLabel'
import type { Proforma } from './types'

/**
 * Revisión y emisión de un borrador guardado. La revisión es de solo lectura; se emite con
 * el token que devolvió. Si los valores cambian, exige revisar de nuevo sin emitir. Tras una
 * respuesta incierta, reintentar reutiliza la misma clave: no se emite otro documento.
 */
export function IssueDialog({
  proforma,
  open,
  onClose,
  onIssued,
  returnFocusRef,
}: {
  proforma: Proforma
  open: boolean
  onClose: () => void
  onIssued: (proforma: Proforma) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useProformaMutations()
  const tracker = useIntentTracker()
  const preview = useIssuePreview(proforma.id, proforma.version, open)
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [reviewRequired, setReviewRequired] = useState(false)
  const [pending, setPending] = useState(false)
  // Candado síncrono contra el doble clic, anterior al repintado del botón.
  const inFlight = useRef(false)
  const review = preview.data

  async function issue() {
    if (!review?.review_token || inFlight.current) return
    inFlight.current = true
    const payload = {
      id: proforma.id,
      expectedVersion: review.version,
      reviewToken: review.review_token,
    }
    setPending(true)
    setProblem(null)
    setReviewRequired(false)
    try {
      onIssued(
        await tracker.run(payload, (key) =>
          mutations.issue.mutateAsync({ ...payload, key }),
        ),
      )
    } catch (error) {
      setProblem(describeProblem(error))
      setReviewRequired(
        error instanceof ProblemError && error.code === 'review_required',
      )
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  const warnings = review?.warnings ?? []
  return (
    <Dialog
      description="Emitir asigna el número y conserva los valores actuales. No reserva inventario ni crea deuda."
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Revisar y emitir proforma"
    >
      <div className="space-y-4">
        {preview.isPending && <LoadingState label="Revisando la proforma…" />}
        {preview.isError && (
          <InlineNotice title="No se pudo revisar la proforma" tone="danger">
            Reintente en unos instantes. Su borrador se conserva.
          </InlineNotice>
        )}
        {problem && (
          <InlineNotice
            title={
              reviewRequired
                ? 'Los valores cambiaron desde la revisión'
                : problem.uncertain
                  ? 'No sabemos si la proforma se emitió'
                  : 'No se emitió la proforma'
            }
            tone="danger"
          >
            <p>{problem.message}</p>
            {reviewRequired && (
              <div className="mt-3">
                <Button
                  onClick={() => {
                    setProblem(null)
                    setReviewRequired(false)
                    void preview.refetch()
                  }}
                  type="button"
                  variant="secondary"
                >
                  Actualizar revisión
                </Button>
              </div>
            )}
          </InlineNotice>
        )}
        {review && review.issues.length > 0 && (
          <InlineNotice title="Todavía no se puede emitir" tone="danger">
            <ul className="list-disc pl-5">
              {review.issues.map((item) => (
                <li key={`${item.field}-${item.code}`}>{issueText(item)}</li>
              ))}
            </ul>
          </InlineNotice>
        )}
        {review?.totals && (
          <section aria-label="Valores revisados">
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt>Fecha de emisión</dt>
              <dd className="text-right">
                {review.issue_date ? documentDate(review.issue_date) : '—'}
              </dd>
              <dt>Vigente hasta</dt>
              <dd className="text-right">
                {review.valid_until ? documentDate(review.valid_until) : '—'}
              </dd>
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
        {warnings.length > 0 && (
          <ul aria-label="Avisos de disponibilidad" className="space-y-1">
            {warnings.map((warning) => (
              <li
                className="flex items-start gap-2 text-[13px] text-ink"
                key={warning.product_id}
              >
                <Warning
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-warning"
                  size={16}
                  weight="fill"
                />
                <span>
                  <span className="font-mono">{warning.product_code}</span>: hay{' '}
                  {warning.available} y se cotizan {warning.requested}. Se puede
                  emitir.
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button
            disabled={pending || reviewRequired || !review?.can_issue}
            onClick={() => void issue()}
            type="button"
          >
            {pending
              ? 'Emitiendo…'
              : problem?.uncertain
                ? 'Reintentar emisión'
                : 'Emitir proforma'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

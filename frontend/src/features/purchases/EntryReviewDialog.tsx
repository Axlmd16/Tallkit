import { Package } from '@phosphor-icons/react'
import { useEffect, useState, type RefObject } from 'react'

import { Button, InlineNotice, Modal } from '@/shared/ui'

import { count } from './format'
import type { EntryReview } from './types'

import './entry.css'

/**
 * Revisión corta antes de confirmar: cuánto entra y, solo si se informaron, proveedor,
 * referencia y observación. Nunca muestra costos. Un posible duplicado exige reconocerlo.
 */
export function EntryReviewDialog({
  review,
  pending,
  message,
  onConfirm,
  onClose,
  returnFocusRef,
}: {
  review: EntryReview | null
  pending: boolean
  message: string | null
  onConfirm: (acknowledgedEntryIds: number[]) => void
  onClose: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const needsAck = Boolean(review?.requires_acknowledgement)
  // Cada revisión nueva exige reconocer de nuevo la coincidencia.
  useEffect(() => setAcknowledged(false), [review])

  return (
    <Modal
      actions={
        review && (
          <>
            <Button onClick={onClose} type="button" variant="secondary">
              Cancelar
            </Button>
            <Button
              disabled={
                pending || !review.can_confirm || (needsAck && !acknowledged)
              }
              onClick={() =>
                onConfirm(
                  needsAck ? review.duplicates.map((d) => d.purchase_id) : [],
                )
              }
              type="button"
            >
              {pending ? 'Confirmando…' : 'Confirmar entrada'}
            </Button>
          </>
        )
      }
      description="Al confirmar, las unidades se suman a la existencia."
      onClose={onClose}
      open={review !== null}
      returnFocusRef={returnFocusRef}
      title="Confirmar entrada"
    >
      {review && (
        <div className="space-y-3">
          <p className="entry-review-total" role="status">
            <Package aria-hidden="true" size={20} weight="fill" />
            <span>
              Entran {count(review.summary.products, 'producto', 'productos')} ·{' '}
              {count(review.summary.units, 'unidad', 'unidades')}
            </span>
          </p>
          <ul aria-label="Productos que entran" className="entry-review-list">
            {review.lines.map((line) => (
              <li key={line.product_id}>
                <span className="min-w-0 truncate">
                  <span className="entry-product-code">{line.code}</span>{' '}
                  {line.name}
                </span>
                <span className="entry-review-qty">{line.quantity}</span>
              </li>
            ))}
          </ul>
          {(review.supplier || review.reference || review.observation) && (
            <dl className="entry-facts !px-0 !pb-0">
              {review.supplier && (
                <div>
                  <dt>Proveedor</dt>
                  <dd>{review.supplier.name}</dd>
                </div>
              )}
              {review.reference && (
                <div>
                  <dt>Referencia</dt>
                  <dd className="code">{review.reference}</dd>
                </div>
              )}
              {review.observation && (
                <div>
                  <dt>Observación</dt>
                  <dd>{review.observation}</dd>
                </div>
              )}
            </dl>
          )}
          {message && (
            <InlineNotice title="Revise nuevamente" tone="warning">
              {message}
            </InlineNotice>
          )}
          {review.issues.length > 0 && (
            <InlineNotice title="No se puede confirmar todavía" tone="danger">
              <ul className="list-disc pl-5">
                {review.issues.map((issue) => (
                  <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>
                ))}
              </ul>
            </InlineNotice>
          )}
          {needsAck && (
            <InlineNotice title="Parece una entrada repetida" tone="warning">
              Hoy ya se registró una igual:{' '}
              <strong className="code">
                {review.duplicates
                  .map((d) => d.internal_number ?? `#${d.purchase_id}`)
                  .join(', ')}
              </strong>
              .
              <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                <input
                  checked={acknowledged}
                  className="size-4 accent-accent"
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                Es otra entrada, continuar
              </label>
            </InlineNotice>
          )}
        </div>
      )}
    </Modal>
  )
}

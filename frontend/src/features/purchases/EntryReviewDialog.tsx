import { useState, type RefObject } from 'react'

import { Button, Dialog, InlineNotice } from '@/shared/ui'

import type { EntryReview } from './types'

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

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
  return (
    <Dialog
      description="Revise lo que entra antes de confirmar."
      onClose={onClose}
      open={review !== null}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Confirmar entrada"
    >
      {review && (
        <div className="space-y-4">
          <p className="text-lg font-semibold text-ink" role="status">
            Entran {plural(review.summary.products, 'producto', 'productos')} ·{' '}
            {plural(review.summary.units, 'unidad', 'unidades')}
          </p>
          <ul
            aria-label="Productos que entran"
            className="max-h-56 divide-y divide-line overflow-y-auto rounded-control border border-line text-sm"
          >
            {review.lines.map((line) => (
              <li
                className="flex items-center justify-between gap-3 px-3 py-2"
                key={line.product_id}
              >
                <span className="min-w-0 truncate">
                  <span className="font-mono font-semibold">{line.code}</span>{' '}
                  {line.name}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  × {line.quantity}
                </span>
              </li>
            ))}
          </ul>
          {(review.supplier || review.reference || review.observation) && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {review.supplier && (
                <>
                  <dt className="text-ink-muted">Proveedor</dt>
                  <dd className="font-medium">{review.supplier.name}</dd>
                </>
              )}
              {review.reference && (
                <>
                  <dt className="text-ink-muted">Referencia</dt>
                  <dd className="font-mono font-medium">{review.reference}</dd>
                </>
              )}
              {review.observation && (
                <>
                  <dt className="text-ink-muted">Observación</dt>
                  <dd className="font-medium">{review.observation}</dd>
                </>
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
              {review.duplicates
                .map((d) => d.internal_number ?? `#${d.purchase_id}`)
                .join(', ')}
              .
              <label className="mt-2 flex items-center gap-2">
                <input
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                Es otra entrada, continuar
              </label>
            </InlineNotice>
          )}
          <div className="flex flex-wrap justify-end gap-3">
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
          </div>
        </div>
      )}
    </Dialog>
  )
}

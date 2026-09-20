import { useState, type RefObject } from 'react'

import { Button, Dialog, InlineNotice } from '@/shared/ui'

import { documentTypeLabels, type PurchaseReview } from './types'
import { usd } from './format'

/**
 * Revisión previa a confirmar: importes y efectos entregados por el backend. Nombra
 * productos, cantidades y el efecto sobre el stock antes de pedir la confirmación.
 */
export function ReviewDialog({
  review,
  supplierName,
  documentType,
  pending,
  message,
  onConfirm,
  onClose,
  onReview,
  returnFocusRef,
}: {
  review: PurchaseReview | null
  supplierName: string
  documentType: keyof typeof documentTypeLabels
  pending: boolean
  message: string | null
  onConfirm: (acknowledgedMatches: number[]) => void
  onClose: () => void
  onReview: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const open = review !== null
  const needsAck = Boolean(review?.requires_acknowledgement)
  return (
    <Dialog
      description="Confirmar recibe todas las líneas completas en la bodega, asigna el número interno y actualiza existencias y costo promedio."
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Revisar y confirmar ingreso"
    >
      {review && (
        <div className="space-y-4">
          <p className="text-ink">
            {documentTypeLabels[documentType]} de{' '}
            <strong>{supplierName}</strong>.
          </p>
          {message && (
            <InlineNotice title="Revise nuevamente" tone="warning">
              {message}
            </InlineNotice>
          )}
          {review.issues.length > 0 && (
            <InlineNotice title="No se puede confirmar todavía" tone="danger">
              <ul className="list-disc pl-5">
                {review.issues.map((issue) => (
                  <li key={`${issue.field}-${issue.code}`}>
                    {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </InlineNotice>
          )}
          {review.totals && (
            <dl
              aria-label="Totales calculados por el sistema"
              className="grid grid-cols-2 gap-2 text-sm"
            >
              <dt>Base</dt>
              <dd className="font-semibold">{usd(review.totals.base)}</dd>
              <dt>Impuesto</dt>
              <dd className="font-semibold">{usd(review.totals.tax)}</dd>
              <dt>Total</dt>
              <dd className="font-semibold">{usd(review.totals.total)}</dd>
              <dt>Valor inventariable</dt>
              <dd className="font-semibold">
                {usd(review.totals.inventory_value)}
              </dd>
            </dl>
          )}
          <section aria-label="Efecto sobre las existencias">
            <h3 className="font-semibold text-ink">
              Efecto sobre las existencias
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {review.effects.map((effect) => (
                <li key={effect.product_id}>
                  <strong>{effect.code}</strong> {effect.name}: recibirá{' '}
                  {effect.quantity_to_receive} presentaciones; pasa de{' '}
                  {effect.current_quantity} a {effect.resulting_quantity}.
                </li>
              ))}
            </ul>
          </section>
          {needsAck && (
            <InlineNotice title="Posible compra repetida" tone="warning">
              Hay compras confirmadas con el mismo proveedor, fecha y contenido:{' '}
              {review.matches
                .map((m) => m.internal_number ?? `#${m.purchase_id}`)
                .join(', ')}
              . No se asume que sean la misma compra.
              <label className="mt-2 flex items-center gap-2">
                <input
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                Revisé las compras coincidentes y deseo continuar.
              </label>
            </InlineNotice>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={onClose} type="button" variant="secondary">
              Cancelar
            </Button>
            <Button onClick={onReview} type="button" variant="quiet">
              Volver a revisar
            </Button>
            <Button
              disabled={
                pending || !review.can_confirm || (needsAck && !acknowledged)
              }
              onClick={() =>
                onConfirm(
                  needsAck ? review.matches.map((m) => m.purchase_id) : [],
                )
              }
              type="button"
            >
              {pending ? 'Confirmando…' : 'Confirmar ingreso'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

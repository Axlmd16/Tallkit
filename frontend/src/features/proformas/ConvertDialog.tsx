import { Warning } from '@phosphor-icons/react'
import { useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Combobox,
  Dialog,
  InlineNotice,
  LoadingState,
  type ComboboxOption,
} from '@/shared/ui'

import { useConversionPreview, useProformaMutations } from './hooks'
import { issueText } from './issueLabel'
import { useCustomerPickerOptions } from './pickers'
import { QuoteComparison } from './QuoteComparison'
import type { LinkedSale, Proforma } from './types'

/**
 * Conversión de una oferta vigente en una venta en borrador. Muestra antes las diferencias
 * entre lo cotizado y los valores actuales. Un doble clic o un reintento reutilizan la
 * misma clave: nunca se crea otra venta, y el resultado enlaza siempre la misma.
 */
export function ConvertDialog({
  proforma,
  open,
  onClose,
  onConverted,
  returnFocusRef,
}: {
  proforma: Proforma
  open: boolean
  onClose: () => void
  onConverted: (proforma: Proforma) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const mutations = useProformaMutations()
  const tracker = useIntentTracker()
  // Sin cliente en la proforma, la venta lo exige: se elige aquí, antes de convertir.
  const needsCustomer = proforma.customer === null
  const [customer, setCustomer] = useState<ComboboxOption | null>(null)
  const preview = useConversionPreview(
    proforma.id,
    proforma.version,
    open,
    needsCustomer ? (customer?.id ?? null) : null,
  )
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [reviewRequired, setReviewRequired] = useState(false)
  const [existing, setExisting] = useState<LinkedSale | null>(null)
  const [pending, setPending] = useState(false)
  // Candado síncrono contra el doble clic, anterior al repintado del botón.
  const inFlight = useRef(false)
  const review = preview.data
  const sale = existing ?? review?.sale ?? null
  const blocking = (review?.issues ?? []).filter(
    (item) => !(needsCustomer && !customer && item.field === 'customer_id'),
  )

  async function convert() {
    if (!review?.review_token || inFlight.current) return
    inFlight.current = true
    const payload = {
      id: proforma.id,
      expectedVersion: review.version,
      reviewToken: review.review_token,
      ...(needsCustomer && customer ? { customerId: customer.id } : {}),
    }
    setPending(true)
    setProblem(null)
    setReviewRequired(false)
    try {
      onConverted(
        await tracker.run(payload, (key) =>
          mutations.convert.mutateAsync({ ...payload, key }),
        ),
      )
    } catch (error) {
      setProblem(describeProblem(error))
      if (error instanceof ProblemError) {
        setReviewRequired(error.code === 'review_required')
        const found = error.details?.sale as LinkedSale | undefined
        if (error.code === 'proforma_converted' && found) setExisting(found)
      }
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <Dialog
      description="Se crea una venta en borrador con el cliente y los productos. No confirma, no cobra ni reserva inventario."
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title="Convertir en venta"
    >
      <div className="space-y-4">
        {needsCustomer && (
          <div className="ui-field">
            <label
              className="block text-xs font-semibold text-ink"
              htmlFor="convert-customer"
            >
              Cliente de la venta
            </label>
            <div className="mt-1.5">
              <Combobox
                clearable
                id="convert-customer"
                inactiveHelp="El cliente está inactivo: elija otro."
                label="Cliente de la venta"
                onSelect={(option) => {
                  setCustomer(option)
                  setProblem(null)
                  setReviewRequired(false)
                }}
                placeholder="Buscar por nombre o identificación"
                selected={customer}
                useOptions={useCustomerPickerOptions}
              />
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              La proforma no tiene cliente; la venta sí lo necesita.
            </p>
          </div>
        )}
        {preview.isPending && <LoadingState label="Comparando valores…" />}
        {preview.isError && (
          <InlineNotice title="No se pudo revisar la conversión" tone="danger">
            Reintente en unos instantes. La proforma no cambió.
          </InlineNotice>
        )}
        {(review?.blocked_by || problem) && (
          <InlineNotice
            title={
              reviewRequired
                ? 'Los valores cambiaron desde la revisión'
                : problem?.uncertain
                  ? 'No sabemos si la venta se creó'
                  : 'No se puede convertir'
            }
            tone="danger"
          >
            <p>{problem?.message ?? review?.blocked_by?.message}</p>
            {sale && (
              <p className="mt-2">
                <Link
                  className="font-semibold text-accent underline"
                  onClick={onClose}
                  to={`/sales/${sale.id}`}
                >
                  Abrir la venta existente
                </Link>
              </p>
            )}
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
        {review && blocking.length > 0 && (
          <InlineNotice title="Resuelva antes de convertir" tone="danger">
            <ul className="list-disc pl-5">
              {blocking.map((item) => (
                <li key={`${item.field}-${item.code}`}>{issueText(item)}</li>
              ))}
            </ul>
          </InlineNotice>
        )}
        {review?.comparison && (
          <QuoteComparison
            comparison={review.comparison}
            currentLabel="Valores actuales"
          />
        )}
        {(review?.warnings ?? []).length > 0 && (
          <ul aria-label="Avisos de disponibilidad" className="space-y-1">
            {review?.warnings.map((warning) => (
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
                  {warning.available} y la oferta incluye {warning.requested}.
                  La venta no podrá confirmarse así.
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
            disabled={pending || reviewRequired || !review?.can_convert}
            onClick={() => void convert()}
            type="button"
          >
            {pending
              ? 'Convirtiendo…'
              : problem?.uncertain
                ? 'Reintentar conversión'
                : 'Convertir en venta'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

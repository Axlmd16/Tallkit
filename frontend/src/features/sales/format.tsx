import { StatusBadge } from '@/shared/ui'

import {
  paymentStateLabels,
  saleStateLabels,
  type PaymentState,
  type SaleOrigin,
  type SaleState,
} from './types'

export { documentDate, timestamp, usd } from '@/features/purchases/format'

const stateTone = {
  DRAFT: 'neutral',
  CONFIRMED: 'success',
  VOIDED: 'warning',
} as const
const paymentTone = {
  PENDING: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
} as const

export function SaleStateBadge({ state }: { state: SaleState }) {
  return <StatusBadge label={saleStateLabels[state]} tone={stateTone[state]} />
}

export function PaymentStateBadge({ state }: { state: PaymentState | null }) {
  if (!state) return <span aria-label="Sin estado de pago">—</span>
  return (
    <StatusBadge label={paymentStateLabels[state]} tone={paymentTone[state]} />
  )
}

/** Origen de la venta en listas: directa, mantenimiento con su orden o proforma con su número. */
export function SaleOriginLabel({
  origin,
}: {
  origin: SaleOrigin | undefined
}) {
  if (origin?.type === 'MAINTENANCE') {
    return (
      <span className="text-body">
        Mantenimiento <span className="code">{origin.order_number}</span>
      </span>
    )
  }
  if (origin?.type === 'PROFORMA') {
    return (
      <span className="text-body">
        Proforma <span className="code">{origin.proforma_number}</span>
      </span>
    )
  }
  return <>Directa</>
}

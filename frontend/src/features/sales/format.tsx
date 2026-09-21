import { StatusBadge } from '@/shared/ui'

import {
  paymentStateLabels,
  saleStateLabels,
  type PaymentState,
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

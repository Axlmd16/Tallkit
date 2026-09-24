import { StatusBadge } from '@/shared/ui'

import { orderStateLabels, type OrderState } from './types'

export { documentDate, timestamp, usd } from '@/features/purchases/format'

const stateTone = {
  REGISTERED: 'info',
  FINALIZED: 'success',
  REOPENED: 'warning',
} as const

export function OrderStateBadge({ state }: { state: OrderState }) {
  return <StatusBadge label={orderStateLabels[state]} tone={stateTone[state]} />
}

/** Kilometraje entero con separador de miles local. */
export const kilometers = (value: number) =>
  `${value.toLocaleString('es-EC')} km`

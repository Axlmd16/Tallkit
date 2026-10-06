import { StatusBadge } from '@/shared/ui'

import { proformaStateLabels, type ProformaState } from './types'

export { documentDate, usd } from '@/features/purchases/format'

const stateTone = {
  DRAFT: 'neutral',
  VALID: 'success',
  EXPIRED: 'warning',
  CONVERTED: 'info',
  VOIDED: 'danger',
} as const

/** El estado siempre se comunica con texto, no solo con color. */
export function ProformaStateBadge({ state }: { state: ProformaState }) {
  return (
    <StatusBadge label={proformaStateLabels[state]} tone={stateTone[state]} />
  )
}

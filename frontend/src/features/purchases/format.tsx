import { StatusBadge } from '@/shared/ui'

import { purchaseStateLabels, type PurchaseState } from './types'

/** Fecha ISO `AAAA-MM-DD` tal como se guardó; sin conversión de zona horaria. */
export const documentDate = (iso: string) => {
  const [year, month, day] = iso.split('-')
  return year && month && day ? `${day}/${month}/${year}` : iso
}

/** Marca temporal del servidor en la zona del navegador. */
export const timestamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-EC') : '—'

/** Importes tal como los calculó el backend: solo se antepone la moneda. */
export const usd = (value: string | null | undefined) =>
  value === null || value === undefined ? '—' : `USD ${value}`

const stateTone = {
  DRAFT: 'neutral',
  CONFIRMED: 'success',
  VOIDED: 'warning',
} as const

export function PurchaseStateBadge({ state }: { state: PurchaseState }) {
  return (
    <StatusBadge label={purchaseStateLabels[state]} tone={stateTone[state]} />
  )
}

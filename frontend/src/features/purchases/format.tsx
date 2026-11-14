import { StatusBadge } from '@/shared/ui'
import { formatMoney } from '@/shared/ui/business'

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
  value === null || value === undefined
    ? '—'
    : (formatMoney(value) ?? `USD ${value}`)

/** Cuenta con singular y plural: «1 producto», «3 productos». */
export const count = (value: number | string, one: string, many: string) => {
  const number = Number(value)
  return `${number} ${number === 1 ? one : many}`
}

/**
 * Costo unitario tal como lo guardó el servidor (hasta 6 decimales): se quitan los ceros
 * sobrantes pero nunca se redondea, y quedan al menos dos decimales.
 */
export function unitCost(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const match = value.trim().match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) return '—'
  const [, whole = '0', fraction = ''] = match
  const trimmed = fraction.replace(/0+$/, '').padEnd(2, '0')
  return `USD ${whole}.${trimmed}`
}

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

import { Field, Input } from '@/shared/ui'

import type { PartInput } from './types'

const AMOUNT = /^\d+(\.\d{1,2})?$/

/** Ayuda de interfaz: la autoridad de validación es el servidor. */
export function validAmount(text: string): boolean {
  return AMOUNT.test(text.trim()) && Number(text) > 0
}

export function toParts(cash: string, transfer: string): PartInput[] {
  const parts: PartInput[] = []
  if (cash.trim()) parts.push({ method: 'EFECTIVO', amount: cash.trim() })
  if (transfer.trim()) {
    parts.push({ method: 'TRANSFERENCIA', amount: transfer.trim() })
  }
  return parts
}

export function partsValid(cash: string, transfer: string): boolean {
  const parts = toParts(cash, transfer)
  return parts.length > 0 && parts.every((part) => validAmount(part.amount))
}

/** Suma solo para mostrarla junto a los campos; nunca se envía ni decide nada. */
export function partsTotal(cash: string, transfer: string): string {
  const cents = toParts(cash, transfer).reduce((sum, part) => {
    const [whole = '0', frac = ''] = part.amount.split('.')
    return sum + Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))
  }, 0)
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

export function PartsFields({
  idPrefix,
  cash,
  transfer,
  onChange,
}: {
  idPrefix: string
  cash: string
  transfer: string
  onChange: (next: { cash: string; transfer: string }) => void
}) {
  const cashError =
    cash && !validAmount(cash)
      ? 'Use un importe positivo con hasta 2 decimales.'
      : undefined
  const transferError =
    transfer && !validAmount(transfer)
      ? 'Use un importe positivo con hasta 2 decimales.'
      : undefined
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold text-ink">Medios de pago reales</legend>
      <Field error={cashError} id={`${idPrefix}-cash`} label="Efectivo (USD)">
        <Input
          id={`${idPrefix}-cash`}
          inputMode="decimal"
          onChange={(event) => onChange({ cash: event.target.value, transfer })}
          value={cash}
        />
      </Field>
      <Field
        error={transferError}
        id={`${idPrefix}-transfer`}
        label="Transferencia (USD)"
      >
        <Input
          id={`${idPrefix}-transfer`}
          inputMode="decimal"
          onChange={(event) => onChange({ cash, transfer: event.target.value })}
          value={transfer}
        />
      </Field>
      <p className="text-body text-ink-muted">
        Total de las partes: USD {partsTotal(cash, transfer)}
      </p>
    </fieldset>
  )
}

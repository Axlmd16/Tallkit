import type { PickerOption } from './ReferencePicker'
import type { SaleInput, SaleLine } from './types'

export interface LineDraft {
  key: string
  product: PickerOption | null
  quantity: string
}

export interface SaleDraft {
  customer: PickerOption | null
  condition: 'CONTADO' | 'CREDITO'
  notes: string
  lines: LineDraft[]
}

export const emptyLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  product: null,
  quantity: '1',
})

export const emptyDraft = (): SaleDraft => ({
  customer: null,
  condition: 'CREDITO',
  notes: '',
  lines: [emptyLine()],
})

export const WHOLE = /^[1-9]\d*$/

/** Solo entradas completas viajan al servidor; el resto se señala como incompleto. */
export function toInput(draft: SaleDraft): Partial<SaleInput> {
  return {
    ...(draft.customer ? { customer_id: draft.customer.id } : {}),
    condition: draft.condition,
    notes: draft.notes,
    lines: draft.lines
      .filter((line) => line.product)
      .map((line) => ({
        product_id: (line.product as PickerOption).id,
        quantity: line.quantity,
      })),
  }
}

/** Cambia solo cuando cambia algo relevante: cliente, condición, líneas o cantidades. */
export function signature(draft: SaleDraft): string {
  return JSON.stringify([
    draft.customer?.id ?? null,
    draft.condition,
    draft.lines.map((l) => [l.product?.id ?? null, l.quantity]),
  ])
}

export function fromSale(lines: SaleLine[]): LineDraft[] {
  return lines.map((line) => ({
    key: crypto.randomUUID(),
    product: {
      id: line.product_id,
      label: `${line.product_code ?? ''} — ${line.product_name ?? ''}`,
    },
    quantity: line.quantity,
  }))
}

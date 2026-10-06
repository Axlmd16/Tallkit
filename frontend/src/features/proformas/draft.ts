import type { ComboboxOption as PickerOption } from '@/shared/ui'

import type { Proforma, ProformaInput } from './types'

export interface LineDraft {
  key: string
  product: PickerOption | null
  quantity: string
}

export interface ProformaDraft {
  customer: PickerOption | null
  /** Cadena vacía: vigencia predeterminada de emisión más 7 días. */
  validUntil: string
  lines: LineDraft[]
}

export const emptyLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  product: null,
  quantity: '1',
})

export const emptyDraft = (): ProformaDraft => ({
  customer: null,
  validUntil: '',
  lines: [emptyLine()],
})

export const WHOLE = /^[1-9]\d*$/

/** Solo cliente, vigencia, productos y cantidades viajan al servidor; nunca importes. */
export function toInput(draft: ProformaDraft): Partial<ProformaInput> {
  return {
    ...(draft.customer ? { customer_id: draft.customer.id } : {}),
    valid_until: draft.validUntil || null,
    lines: draft.lines
      .filter((line) => line.product)
      .map((line) => ({
        product_id: (line.product as PickerOption).id,
        quantity: line.quantity,
      })),
  }
}

/** Cambia solo cuando cambia algo relevante: cliente, vigencia, productos o cantidades. */
export function signature(draft: ProformaDraft): string {
  return JSON.stringify([
    draft.customer?.id ?? null,
    draft.validUntil,
    draft.lines.map((line) => [line.product?.id ?? null, line.quantity]),
  ])
}

export function fromProforma(proforma: Proforma): ProformaDraft {
  return {
    customer: { id: proforma.customer.id, label: proforma.customer.name },
    validUntil: proforma.valid_until ?? '',
    lines: proforma.lines.map((line) => ({
      key: crypto.randomUUID(),
      product: {
        id: line.product_id as number,
        label: `${line.product_code ?? ''} — ${line.product_name ?? ''}`,
        ...(line.product_active === false ? { inactive: true } : {}),
      },
      quantity: line.quantity,
    })),
  }
}

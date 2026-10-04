import type { ComboboxOption } from '@/shared/ui'

import type { EntryInput } from './types'

/** Una línea de la entrada: el producto elegido y cuántas presentaciones llegaron. */
export interface EntryLine {
  productId: number
  code: string
  name: string
  unit: string
  /** Texto del campo: se valida como entero positivo antes de enviarse. */
  quantity: string
  /** Opcional: vacío significa «sin costo registrado», no cero. */
  cost: string
}

export interface EntryDraft {
  lines: EntryLine[]
  supplier: ComboboxOption | null
  reference: string
  observation: string
  /** Muestra el campo de costo por fila; apagado, ningún costo se envía. */
  costsOn: boolean
}

export interface ProductChoice {
  id: number
  code: string
  name: string
  unit: string
}

export const MAX_LINES = 200
const MAX_QUANTITY = 999_999_999_999n
const WHOLE = /^\d+$/
const COST = /^\d+(\.\d{1,6})?$/

export const emptyDraft = (): EntryDraft => ({
  lines: [],
  supplier: null,
  reference: '',
  observation: '',
  costsOn: false,
})

/** Elegir un producto ya presente suma una presentación en lugar de duplicar la línea. */
export function addProduct(
  lines: EntryLine[],
  product: ProductChoice,
): EntryLine[] {
  const existing = lines.find((line) => line.productId === product.id)
  if (existing) {
    return lines.map((line) =>
      line === existing
        ? { ...line, quantity: String(toCount(line.quantity) + 1) }
        : line,
    )
  }
  return [
    ...lines,
    {
      productId: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      quantity: '1',
      cost: '',
    },
  ]
}

function toCount(text: string): number {
  return WHOLE.test(text.trim()) ? Number(text.trim()) : 0
}

export function changeQuantity(
  lines: EntryLine[],
  productId: number,
  delta: number,
): EntryLine[] {
  return lines.map((line) =>
    line.productId === productId
      ? {
          ...line,
          quantity: String(Math.max(1, toCount(line.quantity) + delta)),
        }
      : line,
  )
}

export const setQuantity = (
  lines: EntryLine[],
  productId: number,
  quantity: string,
): EntryLine[] =>
  lines.map((line) =>
    line.productId === productId ? { ...line, quantity } : line,
  )

export const setCost = (
  lines: EntryLine[],
  productId: number,
  cost: string,
): EntryLine[] =>
  lines.map((line) => (line.productId === productId ? { ...line, cost } : line))

export const removeLine = (
  lines: EntryLine[],
  productId: number,
): EntryLine[] => lines.filter((line) => line.productId !== productId)

export function summarize(lines: EntryLine[]): {
  products: number
  units: number
} {
  return {
    products: lines.length,
    units: lines.reduce((sum, line) => sum + toCount(line.quantity), 0),
  }
}

/** Errores de campo con las mismas claves que devuelve el servidor (`lines.0.quantity`). */
export function validateDraft(draft: EntryDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (draft.lines.length === 0) errors.lines = 'Agregue al menos un producto.'
  if (draft.lines.length > MAX_LINES) {
    errors.lines = `Una entrada admite hasta ${MAX_LINES} productos.`
  }
  draft.lines.forEach((line, index) => {
    const quantity = line.quantity.trim()
    if (!WHOLE.test(quantity) || BigInt(quantity) < 1n) {
      errors[`lines.${index}.quantity`] = 'Use un número entero mayor que cero.'
    } else if (BigInt(quantity) > MAX_QUANTITY) {
      errors[`lines.${index}.quantity`] = 'La cantidad es demasiado grande.'
    }
    const cost = line.cost.trim()
    if (draft.costsOn && cost && !COST.test(cost)) {
      errors[`lines.${index}.unit_cost`] = 'Use un valor con hasta 6 decimales.'
    }
  })
  return errors
}

/** Solicitud al servidor: solo lo informado; lo opcional vacío no viaja. */
export function toInput(
  draft: EntryDraft,
  acknowledgedEntryIds: number[] = [],
): EntryInput {
  const reference = draft.reference.trim()
  const observation = draft.observation.trim()
  return {
    lines: draft.lines.map((line) => {
      const cost = line.cost.trim()
      return {
        product_id: line.productId,
        quantity: String(Number(line.quantity.trim())),
        ...(draft.costsOn && cost ? { unit_cost: cost } : {}),
      }
    }),
    ...(draft.supplier ? { supplier_id: draft.supplier.id } : {}),
    ...(reference ? { reference } : {}),
    ...(observation ? { observation } : {}),
    ...(acknowledgedEntryIds.length > 0
      ? { acknowledged_entry_ids: acknowledgedEntryIds }
      : {}),
  }
}

/** Hay algo escrito que se perdería al salir. */
export const isDirty = (draft: EntryDraft): boolean =>
  draft.lines.length > 0 ||
  draft.supplier !== null ||
  draft.reference.trim() !== '' ||
  draft.observation.trim() !== ''

/** Los detalles opcionales con contenido no deben quedar ocultos al usuario. */
export const hasOptionalDetails = (draft: EntryDraft): boolean =>
  draft.supplier !== null ||
  draft.reference.trim() !== '' ||
  draft.observation.trim() !== '' ||
  draft.costsOn

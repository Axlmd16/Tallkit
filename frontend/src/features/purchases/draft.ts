import type { ComboboxOption as PickerOption } from '@/shared/ui'
import type {
  DocumentType,
  LineInput,
  Purchase,
  PurchaseInput,
  TaxRecoverability,
} from './types'

/** Línea en edición: los decimales se conservan como cadenas tal como se capturan. */
export interface LineDraft {
  key: string
  product: PickerOption | null
  quantity: string
  unitCost: string
  taxDefinitionId: number | null
  recoverability: TaxRecoverability | ''
}

export interface PurchaseDraft {
  supplier: PickerOption | null
  documentType: DocumentType
  reference: string
  documentDate: string
  notes: string
  reason: string
  lines: LineDraft[]
}

let counter = 0
export const newLineKey = () => `line-${++counter}`

export const emptyLine = (): LineDraft => ({
  key: newLineKey(),
  product: null,
  quantity: '',
  unitCost: '',
  taxDefinitionId: null,
  recoverability: '',
})

export const emptyDraft = (): PurchaseDraft => ({
  supplier: null,
  documentType: 'FACTURA',
  reference: '',
  documentDate: '',
  notes: '',
  reason: '',
  lines: [],
})

export function draftFromPurchase(purchase: Purchase): PurchaseDraft {
  return {
    supplier: purchase.supplier.name
      ? {
          id: purchase.supplier.id,
          label: purchase.supplier.name,
          inactive: purchase.supplier.is_active === false,
        }
      : null,
    documentType: purchase.document.type,
    reference: purchase.document.reference,
    documentDate: purchase.document_date,
    notes: purchase.notes,
    reason: purchase.document.no_document_reason,
    lines: purchase.lines.map((line) => ({
      key: newLineKey(),
      product: {
        id: line.product.id,
        label: `${line.product.code ?? ''} — ${line.product.name ?? ''}`,
        inactive: line.product.is_active === false,
      },
      quantity: line.quantity,
      unitCost: line.unit_cost,
      taxDefinitionId: line.tax.definition_id,
      recoverability: line.tax_recoverability,
    })),
  }
}

/** Serializa lo capturado; no calcula ni envía importes derivados. */
export function toInput(draft: PurchaseDraft): PurchaseInput {
  const lines: LineInput[] = draft.lines.map((line) => ({
    product_id: line.product?.id ?? 0,
    quantity: line.quantity.trim(),
    unit_cost: line.unitCost.trim(),
    tax_definition_id: line.taxDefinitionId ?? 0,
    tax_recoverability: (line.recoverability ||
      'RECOVERABLE') as TaxRecoverability,
  }))
  return {
    supplier_id: draft.supplier?.id ?? 0,
    document_type: draft.documentType,
    supplier_reference:
      draft.documentType === 'SIN_DOCUMENTO' ? '' : draft.reference.trim(),
    document_date: draft.documentDate,
    notes: draft.notes.trim(),
    no_document_reason:
      draft.documentType === 'SIN_DOCUMENTO' ? draft.reason.trim() : '',
    lines,
  }
}

/** Errores locales que no requieren consultar al servidor. */
export function validateDraft(draft: PurchaseDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.supplier) errors.supplier_id = 'Seleccione un proveedor.'
  if (!draft.documentDate)
    errors.document_date = 'Indique la fecha del documento.'
  if (draft.documentType === 'SIN_DOCUMENTO') {
    if (!draft.reason.trim())
      errors.no_document_reason = 'Explique por qué no hay documento.'
  } else if (!draft.reference.trim()) {
    errors.supplier_reference = 'La referencia del documento es obligatoria.'
  }
  draft.lines.forEach((line, index) => {
    const prefix = `lines.${index}`
    if (!line.product)
      errors[`${prefix}.product_id`] = 'Seleccione un producto.'
    if (
      !/^\d+$/.test(line.quantity.trim()) ||
      /^0+$/.test(line.quantity.trim())
    )
      errors[`${prefix}.quantity`] =
        'Ingrese una cantidad entera mayor que cero.'
    if (!/^\d+(\.\d{1,6})?$/.test(line.unitCost.trim()))
      errors[`${prefix}.unit_cost`] = 'Costo sin impuesto, hasta 6 decimales.'
    if (line.taxDefinitionId === null)
      errors[`${prefix}.tax_definition_id`] = 'Seleccione el impuesto.'
    if (!line.recoverability)
      errors[`${prefix}.tax_recoverability`] =
        'Indique si el impuesto es recuperable.'
  })
  return errors
}

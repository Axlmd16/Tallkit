/** Contratos del backend de compras. Los decimales viajan siempre como cadenas. */

export type PurchaseState = 'DRAFT' | 'CONFIRMED' | 'VOIDED'
export type DocumentType =
  | 'FACTURA'
  | 'NOTA_DE_VENTA'
  | 'OTRO'
  | 'SIN_DOCUMENTO'
export type TaxRecoverability = 'RECOVERABLE' | 'NON_RECOVERABLE'

export const documentTypeLabels: Record<DocumentType, string> = {
  FACTURA: 'Factura',
  NOTA_DE_VENTA: 'Nota de venta',
  OTRO: 'Otro documento',
  SIN_DOCUMENTO: 'Sin documento',
}

export const purchaseStateLabels: Record<PurchaseState, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  VOIDED: 'Anulado',
}

export interface MoneyBlock {
  base: string
  tax: string
  total: string
  inventory_value: string
}

export interface PurchaseLine {
  id: number
  position: number
  product: {
    id: number
    code: string | null
    name: string | null
    unit_name: string | null
    unit_symbol: string | null
    is_active: boolean | null
  }
  quantity: string
  unit_cost: string
  tax_recoverability: TaxRecoverability
  tax: {
    definition_id: number
    code: string | null
    rate: string | null
    status: 'applicable' | 'missing' | 'ambiguous' | 'invalid_scope' | 'absent'
  }
  amounts: MoneyBlock | null
}

export interface Purchase {
  id: number
  state: PurchaseState
  version: number
  internal_number: string | null
  supplier: {
    id: number
    name: string | null
    identification_type: string | null
    identification: string | null
    is_active?: boolean | null
  }
  document: {
    type: DocumentType
    reference: string
    normalized_reference: string
    no_document_reason: string
  }
  document_date: string
  notes: string
  replaces_id: number | null
  replacements: {
    id: number
    state: PurchaseState
    internal_number: string | null
  }[]
  created_at: string
  updated_at: string
  confirmed_at: string | null
  voided_at: string | null
  void_reason: string
  inventory_operation_id: number | null
  void_operation_id: number | null
  totals: MoneyBlock | null
  totals_status: 'calculated' | 'not_calculable'
  lines: PurchaseLine[]
}

export interface PurchaseSummary {
  id: number
  state: PurchaseState
  version: number
  internal_number: string | null
  supplier: { id: number; name: string | null }
  document: { type: DocumentType; reference: string }
  document_date: string
  total: string | null
}

export interface PurchaseFilters {
  search?: string | undefined
  supplierId?: number | undefined
  state?: PurchaseState | undefined
  dateFrom?: string | undefined
  dateTo?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface LineInput {
  product_id: number
  quantity: string
  unit_cost: string
  tax_definition_id: number
  tax_recoverability: TaxRecoverability
}

export interface PurchaseInput {
  supplier_id: number
  document_type: DocumentType
  supplier_reference: string
  document_date: string
  notes: string
  no_document_reason: string
  lines: LineInput[]
}

export interface ReviewIssue {
  code: string
  field: string
  message: string
  product_id?: number
  product_code?: string | null
  blocking_reference?: string | null
}

export interface ReviewEffect {
  product_id: number
  code: string | null
  name?: string | null
  quantity_to_receive: string
  current_quantity: string
  resulting_quantity: string
}

export interface PurchaseReview {
  purchase_id: number
  state: PurchaseState
  version: number
  can_confirm: boolean
  issues: ReviewIssue[]
  review_token: string | null
  expires_in_seconds: number
  totals: MoneyBlock | null
  effects: ReviewEffect[]
  matches: {
    purchase_id: number
    state: PurchaseState
    internal_number: string | null
  }[]
  requires_acknowledgement: boolean
}

export interface VoidReview {
  purchase_id: number
  state: PurchaseState
  version: number
  can_void: boolean
  issues: ReviewIssue[]
  effects: {
    product_id: number
    code: string | null
    quantity_to_remove: string
    quantity_to_restore: string
    current_quantity: string
  }[]
  review_token: string | null
  expires_in_seconds: number
}

export interface CommercialTaxOption {
  id: number
  code: string
  name: string
  entity_type: string
  rate: string | null
  tax_status: 'applicable' | 'missing' | 'ambiguous'
}

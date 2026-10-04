/** Contratos del backend de entradas de stock y compras anteriores. Los decimales son texto. */

export type PurchaseState = 'DRAFT' | 'CONFIRMED' | 'VOIDED'
/** SIMPLE: entrada de stock. LEGACY: compra documentada anterior, solo lectura. */
export type PurchaseFlow = 'SIMPLE' | 'LEGACY'

export const purchaseStateLabels: Record<PurchaseState, string> = {
  DRAFT: 'Sin efecto',
  CONFIRMED: 'Registrada',
  VOIDED: 'Anulada',
}

export interface Person {
  id: number
  name: string | null
}

export interface MoneyBlock {
  base: string
  tax: string
  total: string
  inventory_value: string
}

/** Los campos económicos solo llegan a quien posee `productos.ver_costos`. */
export interface PurchaseLine {
  id: number
  position: number
  product: {
    id: number
    code: string | null
    name: string | null
    unit_name: string | null
    unit_symbol: string | null
  }
  quantity: string
  cost_registered?: boolean
  unit_cost?: string | null
  tax_recoverability?: string | null
  tax?: {
    definition_id: number | null
    code: string | null
    rate: string | null
  }
  amounts?: MoneyBlock | null
}

export interface LegacyData {
  document: { type: string; reference: string; no_document_reason: string }
  document_date: string | null
  replaces_id: number | null
  replacements: {
    id: number
    state: PurchaseState
    internal_number: string | null
  }[]
  totals: MoneyBlock | null
  is_pending_draft: boolean
}

export interface Purchase {
  id: number
  flow: PurchaseFlow
  state: PurchaseState
  version: number
  internal_number: string | null
  supplier: {
    id: number
    name: string | null
    identification_type?: string | null
    identification?: string | null
  } | null
  reference: string
  observation: string
  registered_by: Person | null
  created_at: string
  confirmed_at: string | null
  voided_at: string | null
  void_reason: string
  voided_by: Person | null
  inventory_operation_id: number | null
  void_operation_id: number | null
  lines: PurchaseLine[]
  legacy?: LegacyData
}

export interface PurchaseSummary {
  id: number
  flow: PurchaseFlow
  state: PurchaseState
  internal_number: string | null
  moment: string
  registered_by: Person | null
  product_count: number
  unit_count: string
  supplier: { id: number; name: string | null } | null
  total?: string
}

export interface PurchasePage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: PurchaseSummary[]
  registered_by_options: Person[]
}

export interface PurchaseFilters {
  search?: string | undefined
  state?: PurchaseState | undefined
  dateFrom?: string | undefined
  dateTo?: string | undefined
  registeredBy?: number | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface EntryLineInput {
  product_id: number
  quantity: string
  unit_cost?: string
}

export interface EntryInput {
  lines: EntryLineInput[]
  supplier_id?: number | null
  reference?: string
  observation?: string
  acknowledged_entry_ids?: number[]
}

export interface ReviewIssue {
  code: string
  field: string
  message: string
  product_id?: number
  product_code?: string | null
  blocking_reference?: string | null
}

export interface EntryReview {
  can_confirm: boolean
  issues: ReviewIssue[]
  summary: { products: number; units: number }
  supplier: { id: number; name: string } | null
  reference: string
  observation: string
  lines: {
    product_id: number
    code: string | null
    name: string | null
    unit_name: string | null
    unit_symbol: string | null
    quantity: string
  }[]
  duplicates: {
    purchase_id: number
    internal_number: string | null
    confirmed_at: string | null
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

export interface SupplierOption {
  id: number
  name: string
}

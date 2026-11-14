import type { Page } from '@/shared/api/catalog-resource'

/** Contratos del backend de inventario. Los decimales viajan como cadenas. */

export type OperationKind =
  | 'PURCHASE_RECEIPT'
  | 'INITIAL_LOAD'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'REVERSAL'
  | 'SALE_OUT'
  | 'CUSTOMER_RETURN_IN'
export type ManualKind = 'INITIAL_LOAD' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'
export type OperationState = 'PREPARED' | 'POSTED' | 'REVERSED'

export const kindLabels: Record<OperationKind, string> = {
  PURCHASE_RECEIPT: 'Ingreso de compra',
  INITIAL_LOAD: 'Carga inicial',
  ADJUSTMENT_IN: 'Ajuste de entrada',
  ADJUSTMENT_OUT: 'Ajuste de salida',
  REVERSAL: 'Compensación',
  SALE_OUT: 'Salida por venta',
  CUSTOMER_RETURN_IN: 'Reingreso por devolución de cliente',
}

export const operationStateLabels: Record<OperationState, string> = {
  PREPARED: 'Preparada',
  POSTED: 'Contabilizada',
  REVERSED: 'Revertida',
}

export interface StockProduct {
  id: number
  code: string
  manufacturer_code: string
  name: string
  category: { id: number; name: string }
  unit: { name: string; symbol: string }
  content_quantity: string
  is_active: boolean
}

export interface StockReservation {
  quantity: string
  sale_id: number | null
  order_id: number | null
  order_number: string | null
}

export interface StockRow {
  product: StockProduct
  quantity: string
  /** Reservado por ventas vinculadas abiertas; no es una salida. */
  reserved: string
  /** Existencia menos reservas vigentes. */
  available: string
  /** Solo en la ficha de un producto. */
  reservations?: StockReservation[]
  version: number
  last_ordinal: number
  /** Solo con `inventario.ver_valorizacion`. */
  cost_registered?: boolean
  /** `null` cuando el producto no tiene costo registrado: no es cero. */
  average_cost?: string | null
  inventory_value?: string | null
}

/** Existencias paginadas; `valuation` solo llega con `inventario.ver_valorizacion`. */
export interface StockPage extends Page<StockRow> {
  valuation?: { total_value: string; products_without_cost: number }
}

export interface StockFilters {
  search?: string | undefined
  categoryId?: number | undefined
  isActive?: 'true' | 'false' | 'all' | undefined
  stock?: 'all' | 'positive' | 'zero' | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

/** Existencia de un producto, sin costos ni valoración. */
export interface StockQuantity {
  product_id: number
  quantity: string
}

export interface KardexTotals {
  count: number
  quantity_in: string
  quantity_out: string
  value_in?: string
  value_out?: string
}

export interface KardexRow {
  ordinal: number
  effective_at: string
  movement_type: OperationKind
  source: { type: string; reference: string }
  actor_id: number
  quantity_in: string
  quantity_out: string
  quantity_before: string
  quantity_after: string
  presentation: {
    code: string | null
    name: string | null
    content_quantity: string | null
    unit_name: string | null
    unit_symbol: string | null
  }
  /** Falso cuando el movimiento ocurrió sin costo registrado. */
  cost_known?: boolean
  applied_unit_cost?: string | null
  value_delta?: string | null
  value_before?: string | null
  value_after?: string | null
  average_after?: string | null
  rounding_adjustment?: string
  /** Valor asignado a las unidades previas sin costo cuando esta entrada trajo el primero. */
  regularization_value?: string
}

export interface Kardex {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: KardexRow[]
  cut: { token: string; ordinal: number; expires_in_seconds: number }
  opening_quantity: string
  closing_quantity: string
  period_totals: KardexTotals
  matching_totals: KardexTotals
  page_opening_quantity: string | null
  opening_value?: string | null
  closing_value?: string | null
}

export interface KardexFilters {
  dateFrom?: string | undefined
  dateTo?: string | undefined
  movementType?: OperationKind | undefined
  sourceType?: string | undefined
  sourceId?: number | undefined
  actorId?: number | undefined
  page?: number | undefined
  pageSize?: number | undefined
  cutToken?: string | undefined
}

export interface OperationProjection {
  id: number
  reference: string
  kind: OperationKind
  state: OperationState
  version: number
  product: { id: number; code: string; name: string; is_active: boolean } | null
  quantity: string | null
  origin: { type: string; reference: string; origin_url?: string }
  reverses_reference: string | null
  created_at: string
  posted_at: string | null
  reason?: string
  unit_cost?: string | null
  entry_value?: string | null
  movements?: {
    ordinal: number
    product_id: number
    cost_known: boolean
    applied_unit_cost: string | null
    value_delta: string | null
    rounding_adjustment: string
    regularization_value: string
    value_after: string | null
    average_after: string | null
  }[]
}

export interface AdminOperation {
  id: number
  reference: string
  kind: OperationKind
  state: OperationState
  version: number
  product: { id: number; code: string | null; name: string | null } | null
  quantity: string | null
  unit_cost: string | null
  entry_value: string | null
  reason: string
  notes: string
  external_reference: string
  corrects_operation_id: number | null
  reverses_id: number | null
  created_at: string
  posted_at: string | null
}

export interface OperationInput {
  kind: ManualKind
  product_id: number
  quantity: string
  unit_cost?: string
  reason: string
  reference?: string
  notes?: string
  corrects_operation_id?: number
}

export interface OperationIssue {
  code: string
  field: string
  message: string
  product_id?: number
  blocking_reference?: string | null
}

export interface OperationReview {
  operation_id: number
  state: OperationState
  version: number
  can_confirm?: boolean
  can_reverse?: boolean
  issues: OperationIssue[]
  effects?: {
    product_id: string
    current_quantity: string
    resulting_quantity: string
    resulting_average: string
  }[]
  review_token: string | null
  expires_in_seconds: number
}

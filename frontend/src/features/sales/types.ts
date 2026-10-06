import type { QuoteComparison } from '@/features/proformas/types'

/** Contratos del backend de ventas. Los decimales viajan siempre como cadenas. */

export type SaleState = 'DRAFT' | 'CONFIRMED' | 'VOIDED'
export type SaleCondition = 'CONTADO' | 'CREDITO'
export type PaymentState = 'PENDING' | 'PARTIAL' | 'PAID'
export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA'

export const saleStateLabels: Record<SaleState, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmada',
  VOIDED: 'Anulada',
}
export const conditionLabels: Record<SaleCondition, string> = {
  CONTADO: 'Contado',
  CREDITO: 'Crédito',
}
export const paymentStateLabels: Record<PaymentState, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
}
export const methodLabels: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
}

export const INTERNAL_NOTICE =
  'Documento interno; no constituye una factura electrónica autorizada por el SRI.'

/** Derivado por el servidor: nunca se calcula ni se edita en la interfaz. */
export interface SaleMoney {
  exigible: string | null
  returned_total: string | null
  paid_total: string | null
  refunded_total: string | null
  applied: string | null
  balance: string | null
  refund_due: string | null
  /** Retenciones vigentes: bajan el saldo, pero nunca son dinero cobrado. */
  withheld_total?: string | null
  withheld_excess?: string | null
  payment_state: PaymentState | null
}

/** Orienta la pantalla de cobro; el servidor valida al registrar. */
export interface WithholdingContext {
  enabled: boolean
  customer_is_agent: boolean
}

export interface WithholdingInput {
  amount: string
  acknowledged?: boolean
}

export interface WithholdingWarning {
  percentage: string
  threshold: string
}

/** Retención recibida: el comprobante se completa después del cobro. */
export interface Withholding {
  id: number
  operation_id: string
  sale_id?: number
  service_operation_id?: number
  payment_id: number | null
  amount: string
  effective_at: string
  effective_date: string
  state: 'ACTIVE' | 'VOIDED'
  void_reason: string | null
  voided_at: string | null
  voucher_pending: boolean
  voucher_number: string | null
  voucher_date: string | null
  income_tax_amount: string | null
  vat_amount: string | null
  money?: SaleMoney
}

export interface PendingWithholding extends Withholding {
  sale_number?: string | null
  operation_number?: string | null
  order_id?: number
  order_number?: string | null
  customer: { id: number; name?: string; identification?: string }
  age_days: number
  fiscal_scope: 'COMERCIAL' | 'ARTESANAL'
}

export interface PendingWithholdingsPage {
  items: PendingWithholding[]
  total_count: number
  page: number
  page_size: number
  pending_total: string
}

export interface VoucherInput {
  voucherNumber: string
  voucherDate: string
  incomeTaxAmount?: string | null
  vatAmount?: string | null
}

export interface SaleCustomer {
  id: number
  name?: string
  identification_type?: string
  identification?: string
  phone?: string
  email?: string
  address?: string
  is_active?: boolean
}

export interface SaleLine {
  id: number
  position: number
  product_id: number
  product_code: string | null
  product_name: string | null
  quantity: string
  returned_quantity?: string
  unit_price?: string
  tax_rate?: string | null
  base_amount?: string | null
  tax_amount?: string | null
  total_amount?: string | null
}

export interface SalePaymentRow {
  id: number
  operation_id: string
  amount: string
  effective_date: string
  parts: { method: PaymentMethod; amount: string }[]
  state: 'ACTIVE' | 'CORRECTED'
  correction: { reason: string; replacement_payment_id: number | null } | null
}

export interface SaleReturnRow {
  id: number
  operation_id: string
  reason: string
  grand_total: string
  effective_date: string
}

export interface SaleRefundRow {
  id: number
  operation_id: string
  origin: 'RETURN' | 'VOID'
  sale_return_id: number | null
  amount: string
  effective_date: string
}

export type SaleOriginType = 'DIRECT' | 'MAINTENANCE' | 'PROFORMA'

/** Origen inmutable de la venta; las vinculadas conservan el número de su orden. */
export interface SaleOrigin {
  type: SaleOriginType
  order_id: number | null
  order_number: string | null
  /** Solo en ventas originadas por una proforma; el origen no se edita. */
  proforma_id?: number | null
  proforma_number?: string | null
}

export interface Sale {
  /** Comparación del servidor con lo cotizado; solo en origen proforma. */
  quote_comparison?: QuoteComparison | null
  id: number
  origin: SaleOrigin
  state: SaleState
  version: number
  condition: SaleCondition
  notes: string
  internal_number: string | null
  customer: SaleCustomer
  operational_date: string | null
  base_total: string | null
  tax_total: string | null
  grand_total: string | null
  created_at: string
  confirmed_at: string | null
  voided_at: string | null
  void_reason: string
  fiscal_scope: 'COMERCIAL'
  lines: SaleLine[]
  money: SaleMoney
  links?: { document: string }
  payments?: SalePaymentRow[]
  withholdings?: Withholding[]
  withholding_context?: WithholdingContext
  refunds?: SaleRefundRow[]
  returns?: SaleReturnRow[]
  /** Solo con el permiso de valoración. */
  /** Solo con `inventario.ver_valorizacion`; el costo ausente llega como `null`, no como cero. */
  costs?: {
    total_cost: string
    has_missing_cost: boolean
    lines: {
      position: number
      quantity: string
      cost_known: boolean
      published_unit_cost: string | null
      applied_value: string | null
    }[]
  }
}

export interface SaleSummary {
  id: number
  state: SaleState
  version: number
  internal_number: string | null
  customer: SaleCustomer
  origin: SaleOrigin
  sale_date: string
  condition: SaleCondition
  grand_total: string | null
  money: SaleMoney
  age_days?: number
}

export interface SaleFilters {
  customerId?: number | undefined
  origin?: SaleOriginType | undefined
  state?: SaleState | undefined
  paymentState?: PaymentState | undefined
  dateFrom?: string | undefined
  dateTo?: string | undefined
  minAgeDays?: number | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface ReceivablesPage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: SaleSummary[]
  receivable_total: string
  refund_due_total: string
}

export interface SaleLineInput {
  product_id: number
  quantity: string
}

export interface SaleInput {
  customer_id: number
  condition: SaleCondition
  notes: string
  lines: SaleLineInput[]
}

export interface Issue {
  code: string
  field: string
  message: string
}

export interface ReviewEffect {
  product_id: number
  code: string | null
  name: string | null
  quantity_to_sell: string
  current_quantity: string
  resulting_quantity: string
  current_average_cost?: string | null
}

export interface DocumentLine {
  position: number
  product_id?: number
  product_code: string | null
  product_name: string | null
  quantity: string
  unit_price: string | null
  tax_rate: string | null
  base_amount: string | null
  tax_amount: string | null
  total_amount: string | null
}

export interface Totals {
  base: string
  tax: string
  total: string
}

export interface SaleReview {
  sale_id: number
  state: SaleState
  version: number
  can_confirm: boolean
  issues: Issue[]
  review_token: string | null
  expires_in_seconds: number
  totals: Totals | null
  effects: ReviewEffect[]
  lines: DocumentLine[]
  quote_comparison?: QuoteComparison | null
}

export interface DraftPreview {
  status: 'DRAFT_PREVIEW'
  internal_number: null
  number_pending: boolean
  notice: string
  condition: SaleCondition | null
  customer: SaleCustomer | null
  fiscal_entity: { type: string; ruc: string; legal_name: string } | null
  issues: Issue[]
  can_confirm: false
  lines: DocumentLine[]
  totals: Totals | null
  operational_date: string
}

export interface PartInput {
  method: PaymentMethod
  amount: string
}

export interface MoneyReview {
  sale_id: number
  version: number
  issues: Issue[]
  review_token: string | null
  expires_in_seconds: number
  /** Presente cuando la retención supera el umbral y exige confirmación explícita. */
  warning?: WithholdingWarning | null
  can_register?: boolean
  can_correct?: boolean
  can_return?: boolean
  can_void?: boolean
  balance_before?: string
  balance_after?: string | null
  refund_due_before?: string
  refund_due_after?: string
  money_to_return?: string
  return_total?: string
  exigible_after?: string
  restock_quantity?: string
  lines?: {
    sale_line_id: number
    fit_quantity: string
    unfit_quantity: string
    still_returnable: string
    total_amount: string
  }[]
}

export interface Payment {
  id: number
  operation_id: string
  sale_id: number
  amount: string
  parts: PartInput[]
  state: 'ACTIVE' | 'CORRECTED'
  withholding?: Withholding | null
  money: SaleMoney
}

export interface SaleReturn {
  id: number
  operation_id: string
  sale_id: number
  reason: string
  grand_total: string
  restocked: boolean
  money: SaleMoney
}

export interface SaleRefund {
  id: number
  operation_id: string
  sale_id: number
  origin: 'RETURN' | 'VOID'
  amount: string
  money: SaleMoney
}

export interface SaleDocument {
  notice: string
  number: string | null
  state: SaleState
  voided: boolean
  void_reason: string
  voided_at: string | null
  issuer: { type: string; ruc: string; legal_name: string } | null
  series_code: string | null
  customer: SaleCustomer
  condition: SaleCondition
  operational_date: string | null
  lines: DocumentLine[]
  base_total: string | null
  tax_total: string | null
  grand_total: string | null
}

export interface OperationStatus {
  kind: 'payment' | 'return' | 'refund' | 'withholding'
  id: number
  result: Payment | SaleReturn | SaleRefund | Withholding
}

export interface CustomerOption {
  id: number
  name: string
  identification_type: string
  identification: string
  phone: string
}

export interface ProductOption {
  id: number
  code: string
  name: string
  unit_name: string
  unit_symbol: string
  unit_price: string
  is_kit: boolean
}

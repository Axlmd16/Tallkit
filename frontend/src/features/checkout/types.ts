export type CheckoutPaymentMode = 'CASH' | 'TRANSFER' | 'MIXED' | 'CREDIT'
export type CheckoutReceiverMode = 'CUSTOMER' | 'FINAL_CONSUMER'

export interface CheckoutLine {
  description: string
  quantity: string
  total: string
}

export interface CheckoutFiscalBlock {
  can_prepare_permission: boolean
  state: 'NONE' | 'DRAFT' | 'PREPARED' | 'CANCELLED'
  preparation_id: string | null
  can_prepare: boolean
  impediments: string[]
  can_use_final_consumer: boolean
}

export interface CheckoutWithholdingInfo {
  enabled: boolean
  alert_percentage: string | null
}

export interface CheckoutArtisanBlock {
  visible: boolean
  business_name: string
  has_pending_lines: boolean
  operation_id: number | null
  document_number: string | null
  lines: CheckoutLine[]
  total: string
  balance: string
  can_confirm: boolean
  can_collect: boolean
  action_needed: boolean
  issues: string[]
  fiscal: CheckoutFiscalBlock
  withholding: CheckoutWithholdingInfo
}

export interface CheckoutCommercialBlock {
  visible: boolean
  business_name: string
  pending_sale_id: number | null
  sale_id: number | null
  document_number: string | null
  lines: CheckoutLine[]
  total: string
  balance: string
  can_confirm: boolean
  can_collect: boolean
  action_needed: boolean
  issues: string[]
  fiscal: CheckoutFiscalBlock
  withholding: CheckoutWithholdingInfo
}

export interface CheckoutPreview {
  origin: {
    kind: 'MAINTENANCE' | 'SALE'
    id: number
    number: string
    state: string
    version: number
    vehicle_plate: string | null
    vehicle_label: string | null
  }
  customer: {
    id: number
    name: string
    identification_type: string
    identification: string
    email: string
    address: string
    is_withholding_agent: boolean
    can_save_email: boolean
  }
  artisan: CheckoutArtisanBlock
  commercial: CheckoutCommercialBlock
  closure: {
    can_close: boolean
    default_checked: boolean
    missing_requirements: string[]
  }
}

export interface CheckoutPaymentPartInput {
  method: 'EFECTIVO' | 'TRANSFERENCIA'
  amount: string
}

export interface CheckoutBusinessPaymentInput {
  parts?: CheckoutPaymentPartInput[]
  withholding?: { amount: string } | null
}

export interface CheckoutExecuteInput {
  origin_kind: 'MAINTENANCE' | 'SALE' | 'QUICK_SALE'
  order_id?: number
  sale_id?: number
  customer_id?: number
  lines?: { product_id: number; quantity: number }[]
  payment_mode: CheckoutPaymentMode
  partial?: boolean
  commercial_payment?: CheckoutBusinessPaymentInput | null
  artisan_payment?: CheckoutBusinessPaymentInput | null
  include_invoices: boolean
  receiver_mode?: CheckoutReceiverMode
  receiver_email?: string
  save_email_to_customer?: boolean
  credit_term_days?: number | null
  close_order?: boolean
}

export interface CheckoutBusinessExecutionResult {
  executed: boolean
  sale_id?: number | null
  operation_id?: number | null
  document_number?: string | null
  confirmed?: boolean
  paid?: boolean
  paid_amount?: string
  fiscal_state?: 'PREPARED' | 'FAILED' | 'SKIPPED'
  preparation_id?: string | null
  fiscal_error?: string | null
  error?: string | null
}

export interface CheckoutExecuteResponse {
  overall_status: 'completed' | 'partial'
  origin_kind: string
  commercial: CheckoutBusinessExecutionResult
  artisan: CheckoutBusinessExecutionResult
  customer_email_updated: boolean
  order_closure: {
    requested: boolean
    closed: boolean
    reason: string | null
  }
  replayed: boolean
}

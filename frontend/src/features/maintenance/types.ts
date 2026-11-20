import type { Page } from '@/shared/api/catalog-resource'
import type {
  PaymentState,
  Sale,
  SaleCondition,
  Withholding,
  WithholdingContext,
} from '@/features/sales/types'

export type OrderState = 'REGISTERED' | 'FINALIZED' | 'REOPENED'
export type BillingAction =
  | 'manage_parts'
  | 'document_services'
  | 'view_service_operations'
export type InterventionKind = 'INITIAL' | 'CORRECTIVE'
export type OrderAction =
  | 'edit'
  | 'edit_intervention'
  | 'manage_services'
  | 'change_price'
  | 'manage_photos'
  | 'finalize'
  | 'reopen'

export const orderStateLabels: Record<OrderState, string> = {
  REGISTERED: 'Registrada',
  FINALIZED: 'Finalizada',
  REOPENED: 'Reabierta',
}

export interface UserLabel {
  id: number
  name: string
}

export interface OrderCustomer {
  id: number
  name: string
  identification_type?: string
  identification: string
  is_active: boolean
}

export interface OrderVehicle {
  id: number
  plate: string
  brand: string
  model: string
  is_active: boolean
}

export interface ServiceSummary {
  names: string[]
  line_count: number
}

export interface OrderListItem {
  id: number
  number: string
  state: OrderState
  opened_on: string
  odometer_km: number
  customer: OrderCustomer
  vehicle: OrderVehicle
  services_total: string
  service_summary: ServiceSummary
  /** Cobro de cada negocio por separado; `null` si ese negocio no tiene nada en la orden. */
  billing?: OrderBilling
}

/** UNDOCUMENTED: hay trabajo de ese negocio sin comprobante confirmado. */
export type OrderBillingState = 'UNDOCUMENTED' | 'PENDING' | 'PARTIAL' | 'PAID'

export interface OrderBillingEntry {
  state: OrderBillingState
  balance: string
}

export interface OrderBilling {
  commercial: OrderBillingEntry | null
  artisan: OrderBillingEntry | null
}

export interface ServiceLine {
  id: number
  service_id: number
  service_code: string
  service_name: string
  service_is_active: boolean
  reference_price: string
  applied_price: string
  quantity: number
  /** Nota opcional del trabajo de esta línea; vacía si no la tiene. */
  detail: string
  subtotal: string
  tax_name: string
  no_charge: boolean
  /** Operación artesanal vigente que documenta la línea; ``null`` si está pendiente. */
  documented_by?: { id: number; number: string } | null
}

export interface Intervention {
  id: number
  kind: InterventionKind
  ordinal: number
  cause: string
  work_performed: string
  notes: string
  is_open: boolean
  opened_by: UserLabel
  opened_at: string
  closed_by: UserLabel | null
  closed_at: string | null
  lines: ServiceLine[]
  subtotal: string
}

export interface OrderPhoto {
  id: number
  intervention_id: number
  description: string
  content_type: string
  size_bytes: number
  width: number
  height: number
  uploaded_by: UserLabel
  uploaded_at: string
  file_url: string
  thumbnail_url: string
}

export interface Transition {
  id: number
  from_state: OrderState
  to_state: OrderState
  reason: string
  actor: UserLabel
  occurred_at: string
  intervention_id: number
}

export interface Requirement {
  code: string
  message: string
}

export interface MaintenanceOrder {
  id: number
  number: string
  state: OrderState
  version: number
  fiscal_entity: { ruc: string; legal_name: string }
  customer: OrderCustomer
  vehicle: OrderVehicle
  opened_on: string
  odometer_km: number
  odometer_confirmation: { by: UserLabel; at: string } | null
  diagnosis: string
  notes: string
  created_by: UserLabel
  created_at: string
  updated_by: UserLabel
  updated_at: string
  last_finalized_by: UserLabel | null
  last_finalized_at: string | null
  services_total: string
  interventions: Intervention[]
  photos: OrderPhoto[]
  transitions: Transition[]
  pending_requirements: Requirement[]
  allowed_actions: OrderAction[]
  /** Acciones económicas calculadas por el servidor según estado y permisos. */
  billing_actions?: BillingAction[]
}

/** `OPEN` reúne las órdenes registradas y las reabiertas. */
export type OrderStateFilter = OrderState | 'OPEN'

export interface OrderFilters {
  search?: string | undefined
  state?: OrderStateFilter | undefined
  dateFrom?: string | undefined
  dateTo?: string | undefined
  customerId?: number | undefined
  vehicleId?: number | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface OrderInput {
  customer_id: number
  vehicle_id: number
  opened_on: string
  odometer_km: number
  odometer_confirmed?: boolean
  diagnosis: string
  notes: string
}

export interface CustomerOption {
  id: number
  name: string
  identification_type: string
  identification: string
  phone: string
}

export interface VehicleOption {
  id: number
  plate: string
  brand: string
  model: string
  year: number | null
  color: string
  open_order: { id: number; number: string } | null
}

export interface ServiceOption {
  id: number
  name: string
  description: string
  reference_price: string
}

export interface OdometerWarning {
  last_known_km: number
  order_id: number
  order_number: string
}

// --- Integración económica: repuestos, operación artesanal, pagos y resumen -------------------

export interface LinkedSaleEstimate {
  lines: {
    position: number
    product_id: number
    product_code: string | null
    product_name: string | null
    quantity: string
    unit_price: string | null
    base_amount: string | null
    tax_amount: string | null
    total_amount: string | null
  }[]
  totals: { base: string; tax: string; total: string } | null
  availability: {
    product_id: number
    code: string | null
    name: string | null
    quantity_to_sell: string
    current_quantity: string
  }[]
}

/** Venta comercial vinculada; el borrador abierto trae ``estimate`` sin importes congelados. */
export type LinkedSale = Sale & { estimate?: LinkedSaleEstimate }

export interface PartProductOption {
  id: number
  code: string
  name: string
  content_quantity: string
  unit: { name: string; symbol: string }
  sale_price: string
  quantity: string
  reserved: string
  available: string
}

export interface CommercialDocument {
  id: number
  fiscal_entity: 'COMERCIAL'
  document_type: 'VENTA'
  internal_number: string | null
  state: 'CONFIRMED' | 'VOIDED'
  condition: SaleCondition
  grand_total: string | null
  paid: string | null
  withheld?: string | null
  balance: string | null
  payment_state: PaymentState | null
  lines: Sale['lines']
  allowed_actions: string[]
  can_open_sale: boolean
}

export type OperationState = 'CONFIRMED' | 'VOIDED'
export type ArtisanPaymentStatus = 'EFFECTIVE' | 'VOIDED' | 'REPLACED'

export interface OperationRef {
  id: number
  internal_number: string
}

export interface ArtisanPayment {
  id: number
  operation_id: string
  amount: string
  effective_at: string
  effective_date: string
  created_by: UserLabel | null
  status: ArtisanPaymentStatus
  parts: { method: 'EFECTIVO' | 'TRANSFERENCIA'; amount: string }[]
  correction: {
    reason: string
    created_by: UserLabel | null
    created_at: string
    replacement_payment_id: number | null
  } | null
}

export interface ServiceOperationSummary {
  id: number
  internal_number: string
  order_id: number
  state: OperationState
  condition: SaleCondition
  operational_date: string
  customer_snapshot: { name?: string; identification?: string }
  grand_total: string
  /** Solo dinero cobrado; lo retenido se informa aparte. */
  paid: string
  withheld?: string
  balance: string
  payment_state: PaymentState
  withholding_context?: WithholdingContext
  replaces: OperationRef | null
  replaced_by: OperationRef[]
  void_reason: string
  version: number
  allowed_actions?: string[]
  fiscal_entity?: 'ARTESANAL'
  document_type?: 'SERVICIO'
}

export interface ServiceOperationLine {
  id: number
  service_line_id: number | null
  position: number
  service_id: number
  service_code: string
  service_name: string
  quantity: number
  /** Copia de la nota de la línea al confirmar la operación; vacía en las anteriores. */
  detail: string
  reference_price: string
  applied_price: string
  tax_name: string | null
  tax_rate: string
  base_amount: string
  tax_amount: string
  total_amount: string
}

export interface ServiceOperation extends ServiceOperationSummary {
  order_number: string
  vehicle_snapshot: { plate?: string; brand?: string; model?: string }
  fiscal_snapshot: {
    entity: { type: string; ruc: string; legal_name: string }
    series_code: string
  }
  base_total: string
  tax_total: string
  lines: ServiceOperationLine[]
  payments: ArtisanPayment[]
  withholdings?: Withholding[]
  created_by: UserLabel | null
  created_at: string
  voided_by: UserLabel | null
  voided_at: string | null
  fiscal_notice: string
}

export interface ServiceOperationPreview {
  order_id: number
  order_number: string
  condition: SaleCondition
  operational_date: string
  lines: {
    service_line_id: number
    service_code: string
    service_name: string
    /** Nota de la línea que se copiará a la operación al confirmar. */
    detail: string
    quantity: number
    applied_price: string
    tax_rate: string | null
    base_amount: string | null
    tax_amount: string | null
    total_amount: string | null
  }[]
  totals: { base: string; tax: string; total: string } | null
  effects: {
    series: string
    creates_balance: boolean
    affects_inventory: boolean
    registers_payment: boolean
  }
  issues: { code: string; message: string }[]
  warnings: { code: string; message: string }[]
  review_digest: string
}

export interface VoidPreview {
  id: number
  internal_number: string
  grand_total: string
  paid: string
  can_void: boolean
  blockers: string[]
  version: number
}

export interface EconomicBlockPending {
  label: string
  line_count: number
  estimated_total: string | null
  sale_id?: number
}

export interface EconomicSummary {
  order_id: number
  order_number: string
  commercial: {
    visible: boolean
    documents: CommercialDocument[]
    pending: EconomicBlockPending | null
    confirmed_total: string
    balance_total: string
  }
  artisan: {
    visible: boolean
    documents: ServiceOperationSummary[]
    pending: EconomicBlockPending | null
    confirmed_total?: string
    balance_total?: string
  }
  combined: {
    informative: true
    confirmed_total: string
    pending_total: string
  } | null
  notice: string
}

export interface CommercialOrderView {
  id: number
  number: string
  state: OrderState
  opened_on: string
  customer: { name: string | null; identification: string | null }
  vehicle: { plate: string | null; brand: string | null; model: string | null }
  parts: LinkedSale[]
}

export interface ArtisanReceivableRow {
  id: number
  internal_number: string
  fiscal_entity: 'ARTESANAL'
  document_type: 'SERVICIO'
  order_id: number
  order_number: string
  customer_id: number
  customer_name: string
  condition: SaleCondition
  operational_date: string
  age_days: number
  grand_total: string
  paid: string
  withheld?: string
  balance: string
  payment_state: PaymentState
}

/** Número de mantenimientos de cada segmento con los mismos filtros, sin el de estado. */
export interface OrderStatusCounts {
  all: number
  open: number
  reopened?: number
  finalized: number
}

export interface OrderListPage extends Page<OrderListItem> {
  status_counts?: OrderStatusCounts
}

export interface ArtisanReceivablesPage {
  count: number
  page: number
  page_size: number
  total_pages: number
  totals: {
    grand_total: string
    paid: string
    withheld?: string
    balance: string
  }
  results: ArtisanReceivableRow[]
}

export interface ArtisanReceivableFilters {
  customerId?: number | undefined
  orderId?: number | undefined
  paymentState?: PaymentState | undefined
  condition?: 'CONTADO' | 'CREDITO' | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

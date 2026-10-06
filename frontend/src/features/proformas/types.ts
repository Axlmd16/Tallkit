/** Tipos del contrato de proformas. Importes y cantidades viajan como cadenas del servidor. */

export type ProformaState =
  | 'DRAFT'
  | 'VALID'
  | 'EXPIRED'
  | 'CONVERTED'
  | 'VOIDED'

export type ProformaAction =
  | 'edit'
  | 'issue'
  | 'convert'
  | 'void'
  | 'copy'
  | 'print'

export const proformaStateLabels: Record<ProformaState, string> = {
  DRAFT: 'Borrador',
  VALID: 'Vigente',
  EXPIRED: 'Vencida',
  CONVERTED: 'Convertida',
  VOIDED: 'Anulada',
}

export const QUOTE_TITLE = 'COTIZACIÓN'

export interface ProformaCustomer {
  id: number
  name: string
  identification_type: string
  identification: string
  phone: string
  email?: string
  address?: string
  is_active?: boolean
}

export interface ProformaReference {
  id: number
  number: string | null
  state: ProformaState
}

export interface LinkedSale {
  id: number
  internal_number: string | null
  state: 'DRAFT' | 'CONFIRMED' | 'VOIDED'
  can_open?: boolean
}

export interface ProformaTotals {
  base: string | null
  tax: string | null
  total: string | null
}

export interface ProformaLine {
  position: number
  product_id?: number
  product_code: string | null
  /** Código del fabricante; vacío si el producto no lo tiene. */
  manufacturer_code?: string | null
  /** Marca del producto; vacía si no tiene. */
  brand_name?: string | null
  product_name: string | null
  product_active?: boolean
  is_kit: boolean
  quantity: string
  unit_price: string | null
  tax_rate: string | null
  base_amount: string | null
  tax_amount: string | null
  total_amount: string | null
  /** Disponibilidad actual informativa (borrador). */
  availability?: string
  /** Disponibilidad informativa observada al emitir. */
  availability_at_issue?: string
  availability_sufficient: boolean
}

export interface AvailabilityWarning {
  code: string
  product_id: number
  product_code: string | null
  requested: string
  available: string
  message: string
}

export interface ProformaIssue {
  code: string
  field: string
  message: string
}

export interface ProformaSummary {
  id: number
  state: ProformaState
  version: number
  internal_number: string | null
  /** `null`: cotización sin cliente registrado. */
  customer: ProformaCustomer | null
  issue_date: string | null
  valid_until: string | null
  base_total: string | null
  tax_total: string | null
  grand_total: string | null
  origin: ProformaReference | null
  sale: LinkedSale | null
  allowed_actions: ProformaAction[]
  created_at: string
  issued_at: string | null
  converted_at: string | null
  voided_at: string | null
}

export interface Proforma extends ProformaSummary {
  derived: ProformaReference[]
  lines: ProformaLine[]
  totals: ProformaTotals | null
  suggested_valid_until?: string
  warnings?: AvailabilityWarning[]
}

export interface ProformaLineInput {
  product_id: number
  quantity: string
}

export interface ProformaInput {
  /** `null`: sin cliente; la venta lo exigirá al convertir. */
  customer_id: number | null
  /** `null`: vigencia predeterminada de emisión más 7 días. */
  valid_until: string | null
  lines: ProformaLineInput[]
}

export interface ProformaFilters {
  search?: string | undefined
  state?: ProformaState | undefined
  customerId?: number | undefined
  /** Solo vigentes que vencen en esos días, contando hoy. */
  expiresWithinDays?: number | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface PreviewValues {
  issues: ProformaIssue[]
  issue_date?: string
  valid_until?: string | null
  suggested_valid_until?: string
  lines?: ProformaLine[]
  totals?: ProformaTotals | null
  warnings?: AvailabilityWarning[]
  notice?: string
}

export interface DraftPreview extends PreviewValues {
  status: string
  internal_number: null
  customer: ProformaCustomer | null
  can_issue: false
}

export interface IssuePreview extends PreviewValues {
  proforma_id: number
  state: string
  version: number
  can_issue: boolean
  review_token: string | null
  expires_in_seconds: number
}

export type ComparisonChange = 'quantity' | 'unit_price' | 'tax_rate'

export interface ComparisonSide {
  quantity: string
  unit_price: string | null
  tax_rate: string | null
  base_amount: string | null
  tax_amount: string | null
  total_amount: string | null
}

export interface ComparisonProduct {
  product_id: number
  product_code: string | null
  product_name: string | null
  status: 'UNCHANGED' | 'CHANGED' | 'REMOVED' | 'ADDED'
  changes: ComparisonChange[]
  quoted: ComparisonSide | null
  current: ComparisonSide | null
}

/** Comparación calculada en el servidor entre lo cotizado y los valores actuales. */
export interface QuoteComparison {
  proforma_id?: number
  proforma_number?: string
  issue_date?: string
  valid_until?: string
  products: ComparisonProduct[]
  totals: {
    quoted: ProformaTotals | null
    current: ProformaTotals | null
    difference: string | null
  }
  has_differences: boolean
}

export interface ConversionPreview {
  proforma_id: number
  version: number
  can_convert: boolean
  /** La proforma no tiene cliente: hay que elegir uno para crear la venta. */
  requires_customer?: boolean
  blocked_by: { code: string; message: string } | null
  sale: LinkedSale | null
  issues: ProformaIssue[]
  warnings: AvailabilityWarning[]
  comparison: QuoteComparison | null
  review_token: string | null
  expires_in_seconds: number
}

export interface ProformaIssuer {
  id: number
  type: string
  ruc: string
  legal_name: string
  trade_name: string | null
  address: string | null
  phone: string | null
  email: string | null
}

export interface ProformaDocument {
  notice: string
  number: string
  state: ProformaState
  issue_date: string
  valid_until: string
  issuer: ProformaIssuer
  has_logo: boolean
  customer: ProformaCustomer | null
  lines: ProformaLine[]
  base_total: string
  tax_total: string
  grand_total: string
  availability_observed_at: string
  current_availability: {
    position: number
    product_code: string | null
    available: string | null
  }[]
  origin: ProformaReference | null
}

export interface ProformaProductOption {
  id: number
  code: string
  name: string
  unit_name: string
  unit_symbol: string
  content_quantity: string
  unit_price: string
  is_kit: boolean
  available: string | null
}

export interface ProformaCustomerOption {
  id: number
  name: string
  identification_type: string
  identification: string
  phone: string
}

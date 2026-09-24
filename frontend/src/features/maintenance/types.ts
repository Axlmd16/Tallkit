export type OrderState = 'REGISTERED' | 'FINALIZED' | 'REOPENED'
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
}

export interface ServiceLine {
  id: number
  service_id: number
  service_name: string
  service_is_active: boolean
  reference_price: string
  applied_price: string
  quantity: number
  subtotal: string
  tax_name: string
  no_charge: boolean
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
}

export interface OrderFilters {
  search?: string | undefined
  state?: OrderState | undefined
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

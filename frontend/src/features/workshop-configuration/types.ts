export interface WorkshopStatus {
  is_initialized: boolean
}

export interface InitializeWorkshopRequest {
  commercial_ruc: string
  commercial_legal_name: string
  artisanal_ruc: string
  artisanal_legal_name: string
  warehouse_name: string
}

export interface InitializeWorkshopResponse {
  installation_id: number
}

export type FiscalEntityType = 'COMERCIAL' | 'ARTESANAL'

export interface FiscalEntity {
  id: number
  entity_type: FiscalEntityType
  ruc: string
  legal_name: string
  trade_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  version: number
}

export interface FiscalEntityUpdateRequest {
  legal_name?: string
  ruc?: string
  trade_name?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  expected_version: number
}

export interface Warehouse {
  id: number
  name: string
  is_active: boolean
  version: number
}

export interface WarehouseUpdateRequest {
  name: string
  expected_version: number
}

export interface TaxDefinition {
  id: number
  code: string
  name: string
  fiscal_entity_id?: number
  entity_type?: FiscalEntityType
  current_rate?: string | null
  starts_on?: string | null
  ends_on?: string | null
}

export interface TaxDefinitionCreateRequest {
  entity_id: number
  code: string
  name: string
}

export interface TaxPeriod {
  id: number
  rate: string // Siempre string por contrato
  starts_on: string
  ends_on: string | null
  version: number
}

export interface TaxPeriodCreateRequest {
  rate: string
  starts_on: string
  ends_on?: string | null
}

export interface TaxPeriodUpdateRequest {
  rate?: string
  starts_on?: string
  ends_on?: string | null
  expected_version: number
}

export interface ScheduleSuccessorRequest {
  new_rate: string
  successor_starts_on: string
  expected_version: number
}

export interface DocumentSeries {
  id: number
  code: string
  is_active: boolean
  last_number: number
  version: number
  document_type?: string
  entity_type?: FiscalEntityType
}

export interface SeriesCodeUpdateRequest {
  code: string
  expected_version: number
}

export interface SeriesReplaceRequest {
  new_code: string
  expected_version: number
}

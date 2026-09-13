export interface VehicleBrandSummaryItem {
  id: number
  name: string
  is_active: boolean
}

export interface VehicleOwnerSummaryItem {
  id: number
  name: string
  identification: string
  is_active: boolean
}

export interface VehicleSummary {
  id: number
  plate: string
  model: string
  color: string
  year: number | null
  vin: string | null
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
  brand: VehicleBrandSummaryItem
  current_owner: VehicleOwnerSummaryItem | null
}

export type VehicleDetail = VehicleSummary

export interface VehiclePage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: VehicleSummary[]
}

export interface VehicleFilters {
  search?: string | undefined
  isActive?: boolean | null | undefined
  brandId?: number | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface VehicleCreate {
  owner_id: number
  brand_id: number
  plate: string
  model: string
  color?: string | undefined
  year?: number | null | undefined
  vin?: string | null | undefined
}

export interface VehicleUpdate {
  expected_version: number
  brand_id?: number | undefined
  plate?: string | undefined
  model?: string | undefined
  color?: string | undefined
  year?: number | null | undefined
  vin?: string | null | undefined
}

export interface OwnershipPeriod {
  id: number
  vehicle_id: number
  customer: VehicleOwnerSummaryItem
  started_at: string
  ended_at: string | null
  is_current: boolean
}

export interface OwnershipPeriodPage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: OwnershipPeriod[]
}

export interface VehicleChangeOwnerInput {
  owner_id: number
  expected_version: number
}

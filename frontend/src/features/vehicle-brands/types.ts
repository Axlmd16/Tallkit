export interface VehicleBrandSummary {
  id: number
  name: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface VehicleBrandPage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: VehicleBrandSummary[]
}

export interface VehicleBrandFilters {
  search?: string | undefined
  isActive?: boolean | null | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface VehicleBrandCreate {
  name: string
}

export interface VehicleBrandUpdate {
  name: string
  expected_version: number
}

export interface VehicleBrandState {
  expected_version: number
}

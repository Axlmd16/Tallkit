export interface MeasurementUnit {
  id: number
  name: string
  symbol: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface MeasurementUnitInput {
  name: string
  symbol?: string
}

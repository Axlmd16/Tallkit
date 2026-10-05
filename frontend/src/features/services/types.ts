import type { TaxProjection } from '@/features/products/types'

export interface Service {
  id: number
  /** Asignado por el sistema al crear; único, visible y de solo lectura. */
  code: string
  name: string
  description: string
  /** Precio referencial final en USD, como texto decimal de dos decimales. */
  reference_price: string
  tax: TaxProjection | null
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface ServiceInput {
  name: string
  description: string
  reference_price: string
  tax_definition_id: number
}

export type ServiceUpdate = Partial<ServiceInput> & { expected_version: number }

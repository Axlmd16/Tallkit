import type { BaseFilters } from '@/shared/api/catalog-resource'

export interface CatalogRef {
  id: number
  name: string
  is_active: boolean
}

export type TaxStatus = 'applicable' | 'missing' | 'ambiguous'

export interface TaxProjection {
  id: number
  code: string
  name: string
  entity_type: 'COMERCIAL' | 'ARTESANAL'
  rate: string | null
  tax_status: TaxStatus
}

export interface Product {
  id: number
  /** Código interno del taller: obligatorio, único e identificador principal. */
  code: string
  /** Código del fabricante / número de parte; referencia externa opcional (`''` si falta). */
  manufacturer_code: string
  name: string
  description: string
  category: CatalogRef | null
  unit: CatalogRef | null
  product_brand: CatalogRef | null
  vehicle_brands: CatalogRef[]
  /** Cantidad y precio viajan como texto decimal; nunca se calculan en el navegador. */
  content_quantity: string
  sale_price: string
  is_kit: boolean
  tax: TaxProjection | null
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface ProductFilters extends BaseFilters {
  categoryId?: number | undefined
  productBrandId?: number | undefined
  vehicleBrandId?: number | undefined
}

export interface ProductInput {
  code: string
  manufacturer_code: string
  name: string
  description: string
  category_id: number
  unit_id: number
  product_brand_id: number | null
  vehicle_brand_ids: number[]
  tax_definition_id: number
  content_quantity: string
  sale_price: string
  is_kit: boolean
}

export type ProductUpdate = Partial<ProductInput> & { expected_version: number }

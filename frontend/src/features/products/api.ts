import { ApiClient } from '@/shared/api/client'
import {
  buildQuery,
  createCatalogResource,
  type Page,
} from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  Product,
  ProductFilters,
  ProductLabelData,
  ProductLabelFilters,
  TaxProjection,
} from './types'

interface ProductLabelResponse {
  id: number
  code: string
  name: string
  manufacturer_code: string | null
  product_brand: { id: number; name: string } | null
}

export interface TaxOptionFilters {
  search?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export function createProductsApi(client: ApiClient) {
  return {
    ...createCatalogResource<Product, ProductFilters>(
      client,
      '/products',
      (filters) => ({
        category_id: filters.categoryId,
        product_brand_id: filters.productBrandId,
        vehicle_brand_id: filters.vehicleBrandId,
      }),
    ),
    /** Opciones tributarias del ámbito comercial; el ámbito no se puede elegir. */
    taxOptions(filters: TaxOptionFilters = {}): Promise<Page<TaxProjection>> {
      return client.request<Page<TaxProjection>>(
        `/products/tax-options/${buildQuery({
          search: filters.search,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    async labelData(filters: ProductLabelFilters): Promise<ProductLabelData[]> {
      const data = await client.request<ProductLabelResponse[]>(
        `/products/label-data/${buildQuery({
          search: filters.search,
          is_active: filters.isActive,
          category_id: filters.categoryId,
          product_brand_id: filters.productBrandId,
          vehicle_brand_id: filters.vehicleBrandId,
        })}`,
      )
      return data.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        manufacturerCode: product.manufacturer_code,
        productBrand: product.product_brand,
      }))
    },
  }
}

export const productsApi = createProductsApi(
  new ApiClient(environment.apiBaseUrl),
)

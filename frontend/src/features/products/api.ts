import { ApiClient } from '@/shared/api/client'
import {
  buildQuery,
  createCatalogResource,
  type Page,
} from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type { Product, ProductFilters, TaxProjection } from './types'

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
  }
}

export const productsApi = createProductsApi(
  new ApiClient(environment.apiBaseUrl),
)

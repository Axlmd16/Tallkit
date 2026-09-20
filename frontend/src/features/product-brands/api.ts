import { ApiClient } from '@/shared/api/client'
import { createCatalogResource } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type { ProductBrand } from './types'

export function createProductBrandApi(client: ApiClient) {
  return createCatalogResource<ProductBrand>(client, '/product-brands')
}

export const productBrandsApi = createProductBrandApi(
  new ApiClient(environment.apiBaseUrl),
)

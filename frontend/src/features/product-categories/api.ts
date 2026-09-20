import { ApiClient } from '@/shared/api/client'
import { createCatalogResource } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type { ProductCategory } from './types'

export function createProductCategoryApi(client: ApiClient) {
  return createCatalogResource<ProductCategory>(client, '/product-categories')
}

export const productCategoriesApi = createProductCategoryApi(
  new ApiClient(environment.apiBaseUrl),
)

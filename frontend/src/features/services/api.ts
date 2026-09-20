import { ApiClient } from '@/shared/api/client'
import {
  buildQuery,
  createCatalogResource,
  type Page,
} from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'
import type { TaxOptionFilters } from '@/features/products/api'
import type { TaxProjection } from '@/features/products/types'

import type { Service } from './types'

export function createServicesApi(client: ApiClient) {
  return {
    ...createCatalogResource<Service>(client, '/services'),
    /** Opciones tributarias del ámbito artesanal; solo requiere `servicios.gestionar`. */
    taxOptions(filters: TaxOptionFilters = {}): Promise<Page<TaxProjection>> {
      return client.request<Page<TaxProjection>>(
        `/services/tax-options/${buildQuery({
          search: filters.search,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
  }
}

export const servicesApi = createServicesApi(
  new ApiClient(environment.apiBaseUrl),
)

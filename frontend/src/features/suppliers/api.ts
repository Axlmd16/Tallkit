import { ApiClient } from '@/shared/api/client'
import { createCatalogResource } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type { Supplier, SupplierMatches } from './types'

export function createSuppliersApi(client: ApiClient) {
  return {
    ...createCatalogResource<Supplier>(client, '/suppliers'),
    /** Consulta consultiva de nombres coincidentes; no muta ni lleva clave. */
    matches(name: string, excludeId?: number): Promise<SupplierMatches> {
      return client.request<SupplierMatches>('/suppliers/matches/', {
        method: 'POST',
        body:
          excludeId === undefined ? { name } : { name, exclude_id: excludeId },
      })
    },
  }
}

export const suppliersApi = createSuppliersApi(
  new ApiClient(environment.apiBaseUrl),
)

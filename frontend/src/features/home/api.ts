import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type { HomeCollections, HomePending, HomeReceivables } from './types'

const BASE = '/home'

/**
 * Cliente del resumen de inicio. Solo lee: los conteos, saldos y cobros los calcula el
 * servidor, que además decide qué indicadores entrega según los permisos de la sesión.
 */
export function createHomeApi(client: ApiClient) {
  return {
    pending(): Promise<HomePending> {
      return client.request(`${BASE}/pending/`)
    },
    receivables(): Promise<HomeReceivables> {
      return client.request(`${BASE}/receivables/`)
    },
    collections(): Promise<HomeCollections> {
      return client.request(`${BASE}/collections/`)
    },
  }
}

export const homeApi = createHomeApi(new ApiClient(environment.apiBaseUrl))

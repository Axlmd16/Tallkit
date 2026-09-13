import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type {
  VehicleBrandCreate,
  VehicleBrandFilters,
  VehicleBrandPage,
  VehicleBrandState,
  VehicleBrandSummary,
  VehicleBrandUpdate,
} from './types'

export function createVehicleBrandsApi(client: ApiClient) {
  return {
    async list(filters: VehicleBrandFilters = {}): Promise<VehicleBrandPage> {
      const params = new URLSearchParams()
      if (filters.search?.trim()) {
        params.set('search', filters.search.trim())
      }
      if (typeof filters.isActive === 'boolean') {
        params.set('is_active', String(filters.isActive))
      }
      if (filters.page && filters.page > 1) {
        params.set('page', String(filters.page))
      }
      if (filters.pageSize) {
        params.set('page_size', String(filters.pageSize))
      }

      const query = params.toString()
      return client.request<VehicleBrandPage>(
        `/vehicle-brands/${query ? `?${query}` : ''}`,
      )
    },

    async get(id: number): Promise<VehicleBrandSummary> {
      return client.request<VehicleBrandSummary>(`/vehicle-brands/${id}/`)
    },

    async create(data: VehicleBrandCreate): Promise<VehicleBrandSummary> {
      return client.request<VehicleBrandSummary>('/vehicle-brands/', {
        method: 'POST',
        body: data,
      })
    },

    async update(
      id: number,
      data: VehicleBrandUpdate,
    ): Promise<VehicleBrandSummary> {
      return client.request<VehicleBrandSummary>(`/vehicle-brands/${id}/`, {
        method: 'PATCH',
        body: data,
      })
    },

    async activate(
      id: number,
      expectedVersion: number,
    ): Promise<VehicleBrandSummary> {
      const body: VehicleBrandState = { expected_version: expectedVersion }
      return client.request<VehicleBrandSummary>(
        `/vehicle-brands/${id}/activate/`,
        {
          method: 'POST',
          body,
        },
      )
    },

    async deactivate(
      id: number,
      expectedVersion: number,
    ): Promise<VehicleBrandSummary> {
      const body: VehicleBrandState = { expected_version: expectedVersion }
      return client.request<VehicleBrandSummary>(
        `/vehicle-brands/${id}/deactivate/`,
        {
          method: 'POST',
          body,
        },
      )
    },
  }
}

export const vehicleBrandsApi = createVehicleBrandsApi(
  new ApiClient(environment.apiBaseUrl),
)

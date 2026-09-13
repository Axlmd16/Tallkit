import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type {
  OwnershipPeriodPage,
  VehicleChangeOwnerInput,
  VehicleCreate,
  VehicleFilters,
  VehiclePage,
  VehicleSummary,
  VehicleUpdate,
} from './types'

export function createVehiclesApi(client: ApiClient) {
  return {
    async list(filters: VehicleFilters = {}): Promise<VehiclePage> {
      const params = new URLSearchParams()
      if (filters.search?.trim()) {
        params.set('search', filters.search.trim())
      }
      if (typeof filters.isActive === 'boolean') {
        params.set('is_active', String(filters.isActive))
      }
      if (filters.brandId) {
        params.set('brand_id', String(filters.brandId))
      }
      if (filters.page && filters.page > 1) {
        params.set('page', String(filters.page))
      }
      if (filters.pageSize) {
        params.set('page_size', String(filters.pageSize))
      }

      const query = params.toString()
      return client.request<VehiclePage>(
        `/vehicles/${query ? `?${query}` : ''}`,
      )
    },

    async get(id: number): Promise<VehicleSummary> {
      return client.request<VehicleSummary>(`/vehicles/${id}/`)
    },

    async create(data: VehicleCreate): Promise<VehicleSummary> {
      return client.request<VehicleSummary>('/vehicles/', {
        method: 'POST',
        body: data,
      })
    },

    async update(id: number, data: VehicleUpdate): Promise<VehicleSummary> {
      return client.request<VehicleSummary>(`/vehicles/${id}/`, {
        method: 'PATCH',
        body: data,
      })
    },

    async listByCustomer(
      customerId: number,
      page?: number,
      pageSize?: number,
    ): Promise<VehiclePage> {
      const params = new URLSearchParams()
      if (page && page > 1) {
        params.set('page', String(page))
      }
      if (pageSize) {
        params.set('page_size', String(pageSize))
      }
      const query = params.toString()
      return client.request<VehiclePage>(
        `/customers/${customerId}/vehicles/${query ? `?${query}` : ''}`,
      )
    },

    async changeOwner(
      id: number,
      data: VehicleChangeOwnerInput,
    ): Promise<VehicleSummary> {
      return client.request<VehicleSummary>(`/vehicles/${id}/change-owner/`, {
        method: 'POST',
        body: data,
      })
    },

    async listOwnershipPeriods(
      vehicleId: number,
      page?: number,
      pageSize?: number,
    ): Promise<OwnershipPeriodPage> {
      const params = new URLSearchParams()
      if (page && page > 1) {
        params.set('page', String(page))
      }
      if (pageSize) {
        params.set('page_size', String(pageSize))
      }
      const query = params.toString()
      return client.request<OwnershipPeriodPage>(
        `/vehicles/${vehicleId}/ownership/${query ? `?${query}` : ''}`,
      )
    },

    async activate(
      id: number,
      expectedVersion: number,
    ): Promise<VehicleSummary> {
      return client.request<VehicleSummary>(`/vehicles/${id}/activate/`, {
        method: 'POST',
        body: { expected_version: expectedVersion },
      })
    },

    async deactivate(
      id: number,
      expectedVersion: number,
    ): Promise<VehicleSummary> {
      return client.request<VehicleSummary>(`/vehicles/${id}/deactivate/`, {
        method: 'POST',
        body: { expected_version: expectedVersion },
      })
    },
  }
}

export const vehiclesApi = createVehiclesApi(
  new ApiClient(environment.apiBaseUrl),
)

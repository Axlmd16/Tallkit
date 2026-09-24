import { ApiClient } from '@/shared/api/client'
import { buildQuery, type Page } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  CustomerOption,
  MaintenanceOrder,
  OrderFilters,
  OrderInput,
  OrderListItem,
  ServiceOption,
  VehicleOption,
} from './types'

const BASE = '/maintenance-orders'

export interface LineInput {
  service_id: number
  quantity?: number
  applied_price?: string
}

export function createMaintenanceApi(client: ApiClient) {
  const get = <T>(path: string) => client.request<T>(`${BASE}${path}`)
  const send = <T>(method: 'POST' | 'PATCH', path: string, body: object) =>
    client.request<T>(`${BASE}${path}`, { method, body })

  return {
    list(filters: OrderFilters = {}): Promise<Page<OrderListItem>> {
      return get(
        `/${buildQuery({
          search: filters.search,
          state: filters.state,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          customer_id: filters.customerId,
          vehicle_id: filters.vehicleId,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    get(id: number): Promise<MaintenanceOrder> {
      return get(`/${id}/`)
    },
    create(data: OrderInput, key: string): Promise<MaintenanceOrder> {
      return send('POST', '/', { ...data, idempotency_key: key })
    },
    update(
      id: number,
      data: Partial<OrderInput>,
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('PATCH', `/${id}/`, {
        ...data,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    updateIntervention(
      id: number,
      data: { work_performed?: string; notes?: string },
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('PATCH', `/${id}/current-intervention/`, {
        ...data,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    addLine(
      id: number,
      data: LineInput,
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('POST', `/${id}/service-lines/`, {
        ...data,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    updateLine(
      id: number,
      lineId: number,
      data: { quantity?: number; applied_price?: string },
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('PATCH', `/${id}/service-lines/${lineId}/`, {
        ...data,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    removeLine(
      id: number,
      lineId: number,
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('POST', `/${id}/service-lines/${lineId}/remove/`, {
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    finalize(
      id: number,
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('POST', `/${id}/finalize/`, {
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    reopen(
      id: number,
      reason: string,
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('POST', `/${id}/reopen/`, {
        reason,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    uploadPhoto(
      id: number,
      file: File,
      description: string,
      key: string,
    ): Promise<MaintenanceOrder> {
      const form = new FormData()
      form.append('file', file)
      form.append('description', description)
      form.append('idempotency_key', key)
      return client.request(`${BASE}/${id}/photos/`, {
        method: 'POST',
        body: form,
      })
    },
    removePhoto(
      id: number,
      photoId: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('POST', `/${id}/photos/${photoId}/remove/`, {
        idempotency_key: key,
      })
    },
    customerOptions(term: string, page = 1): Promise<Page<CustomerOption>> {
      return get(`/customer-options/${buildQuery({ search: term, page })}`)
    },
    vehicleOptions(customerId: number): Promise<Page<VehicleOption>> {
      return get(`/vehicle-options/${buildQuery({ customer_id: customerId })}`)
    },
    serviceOptions(term: string, page = 1): Promise<Page<ServiceOption>> {
      return get(`/service-options/${buildQuery({ search: term, page })}`)
    },
  }
}

export type MaintenanceApi = ReturnType<typeof createMaintenanceApi>

export const maintenanceApi = createMaintenanceApi(
  new ApiClient(environment.apiBaseUrl),
)

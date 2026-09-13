import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type {
  CustomerDetail,
  CustomerFilters,
  CustomerMatch,
  CustomerMatchQuery,
  CustomerPage,
  CustomerSummary,
  CustomerWrite,
} from './types'

function query(filters: CustomerFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.isActive !== undefined)
    params.set('is_active', String(filters.isActive))
  params.set('page', String(filters.page ?? 1))
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export function createCustomersApi(client: ApiClient) {
  return {
    list: (filters: CustomerFilters) =>
      client.request<CustomerPage>(`/customers/${query(filters)}`),
    get: (id: number) => client.request<CustomerDetail>(`/customers/${id}/`),
    create: (data: CustomerWrite) =>
      client.request<CustomerSummary>('/customers/', {
        method: 'POST',
        body: data,
      }),
    update: (id: number, data: CustomerWrite) =>
      client.request<CustomerSummary>(`/customers/${id}/`, {
        method: 'PATCH',
        body: data,
      }),
    matches: (queryData: CustomerMatchQuery) =>
      client.request<CustomerMatch[]>('/customers/matches/', {
        method: 'POST',
        body: queryData,
      }),
    activate: (id: number, expectedVersion: number) =>
      client.request<CustomerSummary>(`/customers/${id}/activate/`, {
        method: 'POST',
        body: { expected_version: expectedVersion },
      }),
    deactivate: (id: number, expectedVersion: number) =>
      client.request<CustomerSummary>(`/customers/${id}/deactivate/`, {
        method: 'POST',
        body: { expected_version: expectedVersion },
      }),
  }
}

export type CustomersApi = ReturnType<typeof createCustomersApi>
export const customersApi = createCustomersApi(
  new ApiClient(environment.apiBaseUrl),
)

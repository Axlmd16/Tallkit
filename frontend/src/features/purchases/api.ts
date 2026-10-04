import { ApiClient } from '@/shared/api/client'
import { buildQuery, type Page } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  EntryInput,
  EntryReview,
  Purchase,
  PurchaseFilters,
  PurchasePage,
  SupplierOption,
  VoidReview,
} from './types'

const BASE = '/purchases'

export function createPurchasesApi(client: ApiClient) {
  const post = <T>(path: string, body: object) =>
    client.request<T>(`${BASE}${path}`, { method: 'POST', body })

  return {
    list(filters: PurchaseFilters = {}): Promise<PurchasePage> {
      return client.request(
        `${BASE}/${buildQuery({
          search: filters.search,
          state: filters.state,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          registered_by: filters.registeredBy,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    get(id: number): Promise<Purchase> {
      return client.request(`${BASE}/${id}/`)
    },
    /** Revisión de solo lectura: no lleva clave, no guarda y no devuelve costos. */
    reviewEntry(input: EntryInput): Promise<EntryReview> {
      return post('/entries/review/', input)
    },
    /** Registra y confirma la entrada en una sola acción. */
    registerEntry(input: EntryInput, key: string): Promise<Purchase> {
      return post('/entries/', { ...input, idempotency_key: key })
    },
    voidPreview(id: number): Promise<VoidReview> {
      return post(`/${id}/void-preview/`, {})
    },
    void(
      id: number,
      data: { expectedVersion: number; reviewToken: string; reason: string },
      key: string,
    ): Promise<Purchase> {
      return post(`/${id}/void/`, {
        expected_version: data.expectedVersion,
        review_token: data.reviewToken,
        reason: data.reason,
        idempotency_key: key,
      })
    },
    /** Proveedores activos para elegir uno: solo identificador y nombre. */
    supplierOptions(
      search: string,
      page: number,
    ): Promise<Page<SupplierOption>> {
      return client.request(
        `/suppliers/options/${buildQuery({ search, page, page_size: 10 })}`,
      )
    },
  }
}

export const purchasesApi = createPurchasesApi(
  new ApiClient(environment.apiBaseUrl),
)

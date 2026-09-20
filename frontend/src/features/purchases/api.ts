import { ApiClient } from '@/shared/api/client'
import { buildQuery, type Page } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  CommercialTaxOption,
  Purchase,
  PurchaseFilters,
  PurchaseInput,
  PurchaseReview,
  PurchaseSummary,
  VoidReview,
} from './types'

const BASE = '/purchases'

export function createPurchasesApi(client: ApiClient) {
  const post = <T>(path: string, body: object) =>
    client.request<T>(`${BASE}${path}`, { method: 'POST', body })

  return {
    list(filters: PurchaseFilters = {}): Promise<Page<PurchaseSummary>> {
      return client.request(
        `${BASE}/${buildQuery({
          search: filters.search,
          supplier_id: filters.supplierId,
          state: filters.state,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    get(id: number): Promise<Purchase> {
      return client.request(`${BASE}/${id}/`)
    },
    create(data: PurchaseInput, key: string): Promise<Purchase> {
      return post('/', { ...data, idempotency_key: key })
    },
    update(
      id: number,
      data: Partial<PurchaseInput>,
      expectedVersion: number,
      key: string,
    ): Promise<Purchase> {
      return client.request(`${BASE}/${id}/`, {
        method: 'PATCH',
        body: {
          ...data,
          expected_version: expectedVersion,
          idempotency_key: key,
        },
      })
    },
    /** Revisión de solo lectura: no lleva clave ni crea recibo. */
    preview(id: number): Promise<PurchaseReview> {
      return post(`/${id}/preview/`, {})
    },
    confirm(
      id: number,
      data: {
        expectedVersion: number
        reviewToken: string
        acknowledgedMatches?: number[] | undefined
      },
      key: string,
    ): Promise<Purchase> {
      return post(`/${id}/confirm/`, {
        expected_version: data.expectedVersion,
        review_token: data.reviewToken,
        ...(data.acknowledgedMatches
          ? { acknowledged_matches: data.acknowledgedMatches }
          : {}),
        idempotency_key: key,
      })
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
    replacement(id: number, key: string): Promise<Purchase> {
      return post(`/${id}/replacement/`, { idempotency_key: key })
    },
    taxOptions(
      documentDate: string,
      search?: string,
    ): Promise<Page<CommercialTaxOption>> {
      return client.request(
        `${BASE}/tax-options/${buildQuery({
          document_date: documentDate,
          search,
          page_size: 100,
        })}`,
      )
    },
  }
}

export const purchasesApi = createPurchasesApi(
  new ApiClient(environment.apiBaseUrl),
)

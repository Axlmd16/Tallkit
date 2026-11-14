import { ApiClient } from '@/shared/api/client'
import { buildQuery, type Page } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  AdminOperation,
  Kardex,
  KardexFilters,
  OperationInput,
  OperationProjection,
  OperationReview,
  StockFilters,
  StockPage,
  StockQuantity,
  StockRow,
} from './types'

const BASE = '/inventory'

export function createInventoryApi(client: ApiClient) {
  const post = <T>(path: string, body: object) =>
    client.request<T>(`${BASE}${path}`, { method: 'POST', body })

  return {
    stock(filters: StockFilters = {}): Promise<StockPage> {
      return client.request(
        `${BASE}/${buildQuery({
          search: filters.search,
          category_id: filters.categoryId,
          is_active: filters.isActive,
          stock: filters.stock,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    /** Existencia de hasta 100 productos; solo identificador y cantidad. */
    async quantities(productIds: readonly number[]): Promise<StockQuantity[]> {
      const body = await client.request<{ results: StockQuantity[] }>(
        `${BASE}/stock/quantities/${buildQuery({ product_ids: productIds.join(',') })}`,
      )
      return body.results
    },
    item(productId: number): Promise<StockRow> {
      return client.request(`${BASE}/products/${productId}/`)
    },
    kardex(productId: number, filters: KardexFilters = {}): Promise<Kardex> {
      return client.request(
        `${BASE}/products/${productId}/kardex/${buildQuery({
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          movement_type: filters.movementType,
          source_type: filters.sourceType,
          source_id: filters.sourceId,
          actor_id: filters.actorId,
          page: filters.page,
          page_size: filters.pageSize,
          cut_token: filters.cutToken,
        })}`,
      )
    },
    operation(id: number): Promise<OperationProjection> {
      return client.request(`${BASE}/operations/${id}/`)
    },
    operations(page = 1): Promise<Page<AdminOperation>> {
      return client.request(`${BASE}/operations/${buildQuery({ page })}`)
    },
    create(data: OperationInput, key: string): Promise<AdminOperation> {
      return post('/operations/', { ...data, idempotency_key: key })
    },
    preview(id: number): Promise<OperationReview> {
      return post(`/operations/${id}/preview/`, {})
    },
    confirm(
      id: number,
      data: { expectedVersion: number; reviewToken: string },
      key: string,
    ): Promise<AdminOperation> {
      return post(`/operations/${id}/confirm/`, {
        expected_version: data.expectedVersion,
        review_token: data.reviewToken,
        idempotency_key: key,
      })
    },
    reversePreview(id: number): Promise<OperationReview> {
      return post(`/operations/${id}/reverse-preview/`, {})
    },
    reverse(
      id: number,
      data: { expectedVersion: number; reviewToken: string; reason: string },
      key: string,
    ): Promise<AdminOperation> {
      return post(`/operations/${id}/reverse/`, {
        expected_version: data.expectedVersion,
        review_token: data.reviewToken,
        reason: data.reason,
        idempotency_key: key,
      })
    },
  }
}

export const inventoryApi = createInventoryApi(
  new ApiClient(environment.apiBaseUrl),
)

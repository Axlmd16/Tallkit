import type { ApiClient } from './client'

export interface Page<T> {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: T[]
}

export type ActiveFilter = 'true' | 'false' | 'all'

export interface BaseFilters {
  search?: string | undefined
  isActive?: ActiveFilter | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

type QueryValue = string | number | null | undefined

export function buildQuery(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const text = typeof value === 'string' ? value.trim() : String(value)
    if (text) query.set(name, text)
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export function baseParams(filters: BaseFilters): Record<string, QueryValue> {
  return {
    search: filters.search,
    is_active: filters.isActive,
    page: filters.page,
    page_size: filters.pageSize,
  }
}

/**
 * Cliente de un recurso de catálogo con lista paginada, ficha, alta, edición
 * parcial y estado. Toda escritura recibe su clave de idempotencia.
 */
export function createCatalogResource<
  Item,
  Filters extends BaseFilters = BaseFilters,
>(
  client: ApiClient,
  base: string,
  extraParams: (filters: Filters) => Record<string, QueryValue> = () => ({}),
) {
  return {
    list(filters: Filters = {} as Filters): Promise<Page<Item>> {
      const query = buildQuery({
        ...baseParams(filters),
        ...extraParams(filters),
      })
      return client.request<Page<Item>>(`${base}/${query}`)
    },
    get(id: number): Promise<Item> {
      return client.request<Item>(`${base}/${id}/`)
    },
    create<Data extends object>(data: Data, key: string): Promise<Item> {
      return client.request<Item>(`${base}/`, {
        method: 'POST',
        body: { ...data, idempotency_key: key },
      })
    },
    update<Data extends object>(
      id: number,
      data: Data,
      key: string,
    ): Promise<Item> {
      return client.request<Item>(`${base}/${id}/`, {
        method: 'PATCH',
        body: { ...data, idempotency_key: key },
      })
    },
    setActive(
      id: number,
      active: boolean,
      expectedVersion: number,
      key: string,
    ): Promise<Item> {
      return client.request<Item>(
        `${base}/${id}/${active ? 'activate' : 'deactivate'}/`,
        {
          method: 'POST',
          body: { expected_version: expectedVersion, idempotency_key: key },
        },
      )
    },
  }
}

export type CatalogResource<
  Item,
  Filters extends BaseFilters = BaseFilters,
> = ReturnType<typeof createCatalogResource<Item, Filters>>

import { ApiClient } from '@/shared/api/client'
import { buildQuery, type Page } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  ConversionPreview,
  DraftPreview,
  IssuePreview,
  Proforma,
  ProformaCustomerOption,
  ProformaDocument,
  ProformaFilters,
  ProformaInput,
  ProformaProductOption,
  ProformaSummary,
} from './types'

const BASE = '/proformas'

export interface ReviewedCommand {
  expectedVersion: number
  reviewToken: string
}

export interface ConvertCommand extends ReviewedCommand {
  /** Cliente de la venta cuando la proforma no tiene cliente. */
  customerId?: number | undefined
}

/**
 * Cliente del contrato de proformas. No calcula importes, estados ni permisos: envía
 * cliente, vigencia, productos y cantidades, y muestra lo que el servidor decide.
 */
export function createProformasApi(client: ApiClient) {
  const get = <T>(path: string) => client.request<T>(`${BASE}${path}`)
  const post = <T>(path: string, body: object) =>
    client.request<T>(`${BASE}${path}`, { method: 'POST', body })
  const reviewed = (data: ReviewedCommand, key: string) => ({
    expected_version: data.expectedVersion,
    review_token: data.reviewToken,
    idempotency_key: key,
  })

  return {
    list(filters: ProformaFilters = {}): Promise<Page<ProformaSummary>> {
      return get(
        `/${buildQuery({
          search: filters.search,
          state: filters.state,
          customer_id: filters.customerId,
          expires_within_days: filters.expiresWithinDays,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    get(id: number): Promise<Proforma> {
      return get(`/${id}/`)
    },
    create(data: ProformaInput, key: string): Promise<Proforma> {
      return post('/', { ...data, idempotency_key: key })
    },
    update(
      id: number,
      data: Partial<ProformaInput>,
      expectedVersion: number,
      key: string,
    ): Promise<Proforma> {
      return client.request(`${BASE}/${id}/`, {
        method: 'PATCH',
        body: {
          ...data,
          expected_version: expectedVersion,
          idempotency_key: key,
        },
      })
    },
    /** Consulta de solo lectura: no guarda, no numera ni crea recibo. */
    draftPreview(
      data: Partial<ProformaInput>,
      signal?: AbortSignal,
    ): Promise<DraftPreview> {
      return client.request(`${BASE}/draft-preview/`, {
        method: 'POST',
        body: data,
        ...(signal ? { signal } : {}),
      })
    },
    issuePreview(id: number): Promise<IssuePreview> {
      return get(`/${id}/issue-preview/`)
    },
    issue(id: number, data: ReviewedCommand, key: string): Promise<Proforma> {
      return post(`/${id}/issue/`, reviewed(data, key))
    },
    void(id: number, expectedVersion: number, key: string): Promise<Proforma> {
      return post(`/${id}/void/`, {
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    copy(id: number, key: string): Promise<Proforma> {
      return post(`/${id}/copy/`, { idempotency_key: key })
    },
    conversionPreview(
      id: number,
      customerId?: number,
    ): Promise<ConversionPreview> {
      return get(
        `/${id}/conversion-preview/${buildQuery({ customer_id: customerId })}`,
      )
    },
    convert(id: number, data: ConvertCommand, key: string): Promise<Proforma> {
      return post(`/${id}/convert/`, {
        ...reviewed(data, key),
        ...(data.customerId ? { customer_id: data.customerId } : {}),
      })
    },
    document(id: number): Promise<ProformaDocument> {
      return get(`/${id}/document/`)
    },
    customerOptions(
      search: string,
      page: number,
    ): Promise<Page<ProformaCustomerOption>> {
      return get(`/customer-options/${buildQuery({ search, page })}`)
    },
    productOptions(
      search: string,
      page: number,
    ): Promise<Page<ProformaProductOption>> {
      return get(`/product-options/${buildQuery({ search, page })}`)
    },
  }
}

/** Logo histórico de la oferta emitida; nunca el logo vigente de la configuración. */
export function proformaLogoUrl(id: number): string {
  return `${environment.apiBaseUrl}${BASE}/${id}/document/logo/`
}

export const proformasApi = createProformasApi(
  new ApiClient(environment.apiBaseUrl),
)

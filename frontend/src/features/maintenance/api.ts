import { ApiClient } from '@/shared/api/client'
import { buildQuery, type Page } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  ArtisanReceivableFilters,
  ArtisanReceivablesPage,
  CommercialOrderView,
  CustomerOption,
  EconomicSummary,
  LinkedSale,
  MaintenanceOrder,
  PartProductOption,
  ServiceOperation,
  ServiceOperationPreview,
  VoidPreview,
  OrderFilters,
  OrderInput,
  OrderListItem,
  ServiceOption,
  VehicleOption,
} from './types'

const BASE = '/maintenance-orders'
const OPERATIONS = '/service-operations'

export interface PaymentPartInput {
  method: 'EFECTIVO' | 'TRANSFERENCIA'
  amount: string
}

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
    // --- Repuestos: venta comercial vinculada --------------------------------------------
    parts(id: number): Promise<LinkedSale[]> {
      return get(`/${id}/parts/`)
    },
    partProductOptions(
      id: number,
      term: string,
      page = 1,
    ): Promise<Page<PartProductOption>> {
      return get(
        `/${id}/parts/product-options/${buildQuery({ search: term, page })}`,
      )
    },
    addPart(
      id: number,
      data: { product_id: number; quantity: string },
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('POST', `/${id}/parts/`, {
        ...data,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    changePart(
      id: number,
      lineId: number,
      quantity: string,
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('PATCH', `/${id}/parts/${lineId}/`, {
        quantity,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    removePart(
      id: number,
      lineId: number,
      expectedVersion: number,
      key: string,
    ): Promise<MaintenanceOrder> {
      return send('POST', `/${id}/parts/${lineId}/remove/`, {
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    economicSummary(id: number): Promise<EconomicSummary> {
      return get(`/${id}/economic-summary/`)
    },
    commercialView(id: number): Promise<CommercialOrderView> {
      return get(`/${id}/commercial-view/`)
    },
    // --- Operación artesanal de servicios ------------------------------------------------
    previewServiceOperation(
      id: number,
      condition: string,
    ): Promise<ServiceOperationPreview> {
      return send('POST', `/${id}/service-operations/preview/`, { condition })
    },
    confirmServiceOperation(
      id: number,
      data: { condition: string; review_digest: string },
      expectedVersion: number,
      key: string,
    ): Promise<ServiceOperation> {
      return send('POST', `/${id}/service-operations/`, {
        ...data,
        expected_version: expectedVersion,
        idempotency_key: key,
      })
    },
    serviceOperation(operationId: number): Promise<ServiceOperation> {
      return client.request(`${OPERATIONS}/${operationId}/`)
    },
    serviceOperationDocument(operationId: number): Promise<ServiceOperation> {
      return client.request(`${OPERATIONS}/${operationId}/document/`)
    },
    voidPreview(operationId: number): Promise<VoidPreview> {
      return client.request(`${OPERATIONS}/${operationId}/void-preview/`)
    },
    voidServiceOperation(
      operationId: number,
      reason: string,
      expectedVersion: number,
      key: string,
    ): Promise<ServiceOperation> {
      return client.request(`${OPERATIONS}/${operationId}/void/`, {
        method: 'POST',
        body: {
          reason,
          expected_version: expectedVersion,
          idempotency_key: key,
        },
      })
    },
    registerArtisanPayment(
      operationId: number,
      parts: PaymentPartInput[],
      factId: string,
      key: string,
    ): Promise<ServiceOperation> {
      return client.request(`${OPERATIONS}/${operationId}/payments/`, {
        method: 'POST',
        body: { operation_id: factId, parts, idempotency_key: key },
      })
    },
    correctArtisanPayment(
      operationId: number,
      paymentId: number,
      data: {
        reason: string
        replacement?: { operation_id: string; parts: PaymentPartInput[] }
      },
      factId: string,
      key: string,
    ): Promise<ServiceOperation> {
      return client.request(
        `${OPERATIONS}/${operationId}/payments/${paymentId}/corrections/`,
        {
          method: 'POST',
          body: { ...data, operation_id: factId, idempotency_key: key },
        },
      )
    },
    artisanReceivables(
      filters: ArtisanReceivableFilters = {},
    ): Promise<ArtisanReceivablesPage> {
      return client.request(
        `${OPERATIONS}/${buildQuery({
          customer_id: filters.customerId,
          order_id: filters.orderId,
          payment_state: filters.paymentState,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
  }
}

export type MaintenanceApi = ReturnType<typeof createMaintenanceApi>

export const maintenanceApi = createMaintenanceApi(
  new ApiClient(environment.apiBaseUrl),
)

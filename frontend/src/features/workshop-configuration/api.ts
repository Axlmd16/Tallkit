import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type {
  DocumentSeries,
  FiscalEntity,
  FiscalEntityUpdateRequest,
  InitializeWorkshopRequest,
  InitializeWorkshopResponse,
  ScheduleSuccessorRequest,
  SeriesCodeUpdateRequest,
  SeriesReplaceRequest,
  TaxDefinition,
  TaxDefinitionCreateRequest,
  TaxPeriod,
  TaxPeriodCreateRequest,
  TaxPeriodUpdateRequest,
  Warehouse,
  WarehouseUpdateRequest,
  WorkshopStatus,
} from './types'

const BASE = '/workshop-configuration'

export function createWorkshopConfigApi(client: ApiClient) {
  return {
    getStatus: () => client.request<WorkshopStatus>(`${BASE}/status/`),

    initialize: (data: InitializeWorkshopRequest, idempotencyKey: string) =>
      client.request<InitializeWorkshopResponse>(`${BASE}/initialize/`, {
        method: 'POST',
        body: { ...data, idempotency_key: idempotencyKey },
      }),

    getEntities: () => client.request<FiscalEntity[]>(`${BASE}/entities/`),

    getEntity: (id: number) =>
      client.request<FiscalEntity>(`${BASE}/entities/${id}/`),

    updateEntity: (id: number, data: FiscalEntityUpdateRequest) =>
      client.request<FiscalEntity>(`${BASE}/entities/${id}/`, {
        method: 'PATCH',
        body: data,
      }),

    getWarehouse: () => client.request<Warehouse>(`${BASE}/warehouse/`),

    updateWarehouse: (data: WarehouseUpdateRequest) =>
      client.request<Warehouse>(`${BASE}/warehouse/`, {
        method: 'PATCH',
        body: data,
      }),

    getTaxDefinitions: (entityId?: number) =>
      client.request<TaxDefinition[]>(
        entityId ? `${BASE}/taxes/?entity_id=${entityId}` : `${BASE}/taxes/`,
      ),

    getAllTaxDefinitions: () =>
      client.request<TaxDefinition[]>(`${BASE}/taxes/`),

    createTaxDefinition: (data: TaxDefinitionCreateRequest) =>
      client.request<TaxDefinition>(`${BASE}/taxes/`, {
        method: 'POST',
        body: data,
      }),

    getTaxPeriods: (taxDefId: number) =>
      client.request<TaxPeriod[]>(`${BASE}/taxes/${taxDefId}/periods/`),

    createTaxPeriod: (taxDefId: number, data: TaxPeriodCreateRequest) =>
      client.request<TaxPeriod>(`${BASE}/taxes/${taxDefId}/periods/`, {
        method: 'POST',
        body: data,
      }),

    updateTaxPeriod: (periodId: number, data: TaxPeriodUpdateRequest) =>
      client.request<TaxPeriod>(`${BASE}/periods/${periodId}/`, {
        method: 'PATCH',
        body: data,
      }),

    scheduleSuccessor: (periodId: number, data: ScheduleSuccessorRequest) =>
      client.request<TaxPeriod>(
        `${BASE}/periods/${periodId}/schedule-successor/`,
        {
          method: 'POST',
          body: data,
        },
      ),

    getDocumentSeries: (scopeId?: number) =>
      client.request<DocumentSeries[]>(
        scopeId ? `${BASE}/series/?scope_id=${scopeId}` : `${BASE}/series/`,
      ),

    getAllSeries: () => client.request<DocumentSeries[]>(`${BASE}/series/`),

    getSeries: (seriesId: number) =>
      client.request<DocumentSeries>(`${BASE}/series/${seriesId}/`),

    updateSeriesCode: (seriesId: number, data: SeriesCodeUpdateRequest) =>
      client.request<DocumentSeries>(`${BASE}/series/${seriesId}/`, {
        method: 'PATCH',
        body: data,
      }),

    replaceSeries: (seriesId: number, data: SeriesReplaceRequest) =>
      client.request<DocumentSeries>(`${BASE}/series/${seriesId}/replace/`, {
        method: 'POST',
        body: data,
      }),
  }
}

export const workshopConfigApi = createWorkshopConfigApi(
  new ApiClient(environment.apiBaseUrl),
)

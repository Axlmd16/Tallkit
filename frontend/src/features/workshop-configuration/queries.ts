import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workshopConfigApi } from './api'
import type {
  FiscalEntityUpdateRequest,
  InitializeWorkshopRequest,
  ScheduleSuccessorRequest,
  SeriesCodeUpdateRequest,
  SeriesReplaceRequest,
  TaxDefinitionCreateRequest,
  TaxPeriodCreateRequest,
  TaxPeriodUpdateRequest,
  WarehouseUpdateRequest,
} from './types'

export const workshopKeys = {
  all: ['workshop-configuration'] as const,
  status: () => [...workshopKeys.all, 'status'] as const,
  entities: () => [...workshopKeys.all, 'entities'] as const,
  entity: (id: number) => [...workshopKeys.entities(), id] as const,
  warehouse: () => [...workshopKeys.all, 'warehouse'] as const,
  taxDefinitions: (entityId: number) =>
    [...workshopKeys.all, 'taxes', 'definitions', entityId] as const,
  taxPeriods: (taxDefId: number) =>
    [...workshopKeys.all, 'taxes', 'periods', taxDefId] as const,
  seriesList: (scopeId: number) =>
    [...workshopKeys.all, 'series', scopeId] as const,
  seriesDetail: (seriesId: number) =>
    [...workshopKeys.all, 'series', 'detail', seriesId] as const,
}

export function useWorkshopStatus() {
  return useQuery({
    queryKey: workshopKeys.status(),
    queryFn: workshopConfigApi.getStatus,
  })
}

export function useInitializeWorkshop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: InitializeWorkshopRequest
      idempotencyKey: string
    }) => workshopConfigApi.initialize(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workshopKeys.all })
    },
  })
}

export function useFiscalEntities() {
  return useQuery({
    queryKey: workshopKeys.entities(),
    queryFn: workshopConfigApi.getEntities,
  })
}

export function useFiscalEntity(id: number) {
  return useQuery({
    queryKey: workshopKeys.entity(id),
    queryFn: () => workshopConfigApi.getEntity(id),
    enabled: !!id,
  })
}

export function useUpdateFiscalEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: FiscalEntityUpdateRequest
    }) => workshopConfigApi.updateEntity(id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(workshopKeys.entity(data.id), data)
      queryClient.invalidateQueries({ queryKey: workshopKeys.entities() })
    },
  })
}

export function useWarehouse() {
  return useQuery({
    queryKey: workshopKeys.warehouse(),
    queryFn: workshopConfigApi.getWarehouse,
  })
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: WarehouseUpdateRequest) =>
      workshopConfigApi.updateWarehouse(data),
    onSuccess: (data) => {
      queryClient.setQueryData(workshopKeys.warehouse(), data)
    },
  })
}

export function useTaxDefinitions(entityId: number) {
  return useQuery({
    queryKey: workshopKeys.taxDefinitions(entityId),
    queryFn: () => workshopConfigApi.getTaxDefinitions(entityId),
    enabled: !!entityId,
  })
}

export function useAllTaxDefinitions() {
  return useQuery({
    queryKey: [...workshopKeys.all, 'taxes', 'all'],
    queryFn: workshopConfigApi.getAllTaxDefinitions,
  })
}

export function useCreateTaxDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: TaxDefinitionCreateRequest) =>
      workshopConfigApi.createTaxDefinition(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workshopKeys.taxDefinitions(variables.entity_id),
      })
      queryClient.invalidateQueries({
        queryKey: [...workshopKeys.all, 'taxes'],
      })
    },
  })
}

export function useTaxPeriods(taxDefId: number) {
  return useQuery({
    queryKey: workshopKeys.taxPeriods(taxDefId),
    queryFn: () => workshopConfigApi.getTaxPeriods(taxDefId),
    enabled: !!taxDefId,
  })
}

export function useCreateTaxPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taxDefId,
      data,
    }: {
      taxDefId: number
      data: TaxPeriodCreateRequest
    }) => workshopConfigApi.createTaxPeriod(taxDefId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workshopKeys.taxPeriods(variables.taxDefId),
      })
      queryClient.invalidateQueries({
        queryKey: [...workshopKeys.all, 'taxes'],
      })
    },
  })
}

export function useUpdateTaxPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      periodId,
      data,
    }: {
      periodId: number
      data: TaxPeriodUpdateRequest
    }) => workshopConfigApi.updateTaxPeriod(periodId, data),
    onSuccess: () => {
      // Could be more specific if we knew the taxDefId, but since we don't always, invalidate all periods
      queryClient.invalidateQueries({
        queryKey: [...workshopKeys.all, 'taxes', 'periods'],
      })
    },
  })
}

export function useScheduleSuccessor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      periodId,
      data,
    }: {
      periodId: number
      data: ScheduleSuccessorRequest
    }) => workshopConfigApi.scheduleSuccessor(periodId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...workshopKeys.all, 'taxes', 'periods'],
      })
    },
  })
}

export function useDocumentSeriesList(scopeId: number) {
  return useQuery({
    queryKey: workshopKeys.seriesList(scopeId),
    queryFn: () => workshopConfigApi.getDocumentSeries(scopeId),
    enabled: !!scopeId,
  })
}

export function useAllDocumentSeries() {
  return useQuery({
    queryKey: [...workshopKeys.all, 'series', 'all'],
    queryFn: workshopConfigApi.getAllSeries,
  })
}

export function useUpdateSeriesCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      seriesId,
      data,
    }: {
      seriesId: number
      data: SeriesCodeUpdateRequest
    }) => workshopConfigApi.updateSeriesCode(seriesId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(workshopKeys.seriesDetail(data.id), data)
      queryClient.invalidateQueries({
        queryKey: [...workshopKeys.all, 'series'],
      })
    },
  })
}

export function useReplaceSeries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      seriesId,
      data,
    }: {
      seriesId: number
      data: SeriesReplaceRequest
    }) => workshopConfigApi.replaceSeries(seriesId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...workshopKeys.all, 'series'],
      })
    },
  })
}

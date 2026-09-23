import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getStatus: vi.fn(),
  initialize: vi.fn(),
  getEntities: vi.fn(),
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  getWarehouse: vi.fn(),
  updateWarehouse: vi.fn(),
  getTaxDefinitions: vi.fn(),
  getAllTaxDefinitions: vi.fn(),
  createTaxDefinition: vi.fn(),
  getTaxPeriods: vi.fn(),
  createTaxPeriod: vi.fn(),
  updateTaxPeriod: vi.fn(),
  scheduleSuccessor: vi.fn(),
  getDocumentSeries: vi.fn(),
  getAllSeries: vi.fn(),
  updateSeriesCode: vi.fn(),
  replaceSeries: vi.fn(),
}))

vi.mock('../api', () => ({ workshopConfigApi: api }))

import {
  useAllDocumentSeries,
  useAllTaxDefinitions,
  useCreateTaxDefinition,
  useCreateTaxPeriod,
  useDocumentSeriesList,
  useFiscalEntities,
  useFiscalEntity,
  useInitializeWorkshop,
  useReplaceSeries,
  useScheduleSuccessor,
  useTaxDefinitions,
  useTaxPeriods,
  useUpdateFiscalEntity,
  useUpdateSeriesCode,
  useUpdateTaxPeriod,
  useUpdateWarehouse,
  useWarehouse,
  useWorkshopStatus,
  workshopKeys,
} from '../queries'

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

const entity = {
  id: 2,
  entity_type: 'COMERCIAL' as const,
  ruc: '1150696977001',
  legal_name: 'Repuestos VVH',
  trade_name: null,
  address: null,
  phone: null,
  email: null,
  version: 3,
}
const warehouse = {
  id: 1,
  name: 'Bodega principal',
  is_active: true,
  version: 2,
}
const series = {
  id: 8,
  code: 'COM-VEN',
  is_active: true,
  last_number: 4,
  version: 2,
}

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  api.getStatus.mockResolvedValue({ is_initialized: true })
  api.getEntities.mockResolvedValue([entity])
  api.getEntity.mockResolvedValue(entity)
  api.getWarehouse.mockResolvedValue(warehouse)
  api.getTaxDefinitions.mockResolvedValue([{ id: 5, code: 'IVA' }])
  api.getAllTaxDefinitions.mockResolvedValue([{ id: 5, code: 'IVA' }])
  api.getTaxPeriods.mockResolvedValue([{ id: 6, rate: '15' }])
  api.getDocumentSeries.mockResolvedValue([series])
  api.getAllSeries.mockResolvedValue([series])
})

it('loads every configuration collection with its identifier and stable query key', async () => {
  const status = renderHook(() => useWorkshopStatus(), { wrapper })
  const entities = renderHook(() => useFiscalEntities(), { wrapper })
  const detail = renderHook(() => useFiscalEntity(2), { wrapper })
  const warehouseQuery = renderHook(() => useWarehouse(), { wrapper })
  const definitions = renderHook(() => useTaxDefinitions(2), { wrapper })
  const allDefinitions = renderHook(() => useAllTaxDefinitions(), { wrapper })
  const periods = renderHook(() => useTaxPeriods(5), { wrapper })
  const scopedSeries = renderHook(() => useDocumentSeriesList(2), { wrapper })
  const allSeries = renderHook(() => useAllDocumentSeries(), { wrapper })

  await waitFor(() => expect(allSeries.result.current.isSuccess).toBe(true))

  expect(status.result.current.data).toEqual({ is_initialized: true })
  expect(entities.result.current.data).toEqual([entity])
  expect(detail.result.current.data).toEqual(entity)
  expect(warehouseQuery.result.current.data).toEqual(warehouse)
  expect(definitions.result.current.data).toEqual([{ id: 5, code: 'IVA' }])
  expect(allDefinitions.result.current.data).toEqual([{ id: 5, code: 'IVA' }])
  expect(periods.result.current.data).toEqual([{ id: 6, rate: '15' }])
  expect(scopedSeries.result.current.data).toEqual([series])
  expect(api.getEntity).toHaveBeenCalledWith(2)
  expect(api.getTaxDefinitions).toHaveBeenCalledWith(2)
  expect(api.getTaxPeriods).toHaveBeenCalledWith(5)
  expect(api.getDocumentSeries).toHaveBeenCalledWith(2)
  expect(workshopKeys.seriesDetail(8)).toEqual([
    'workshop-configuration',
    'series',
    'detail',
    8,
  ])
})

it('does not request identifier-scoped resources until an identifier exists', () => {
  renderHook(() => useFiscalEntity(0), { wrapper })
  renderHook(() => useTaxDefinitions(0), { wrapper })
  renderHook(() => useTaxPeriods(0), { wrapper })
  renderHook(() => useDocumentSeriesList(0), { wrapper })

  expect(api.getEntity).not.toHaveBeenCalled()
  expect(api.getTaxDefinitions).not.toHaveBeenCalled()
  expect(api.getTaxPeriods).not.toHaveBeenCalled()
  expect(api.getDocumentSeries).not.toHaveBeenCalled()
})

it('executes initialization and basic updates while refreshing the owned cache', async () => {
  api.initialize.mockResolvedValue({ installation_id: 1 })
  api.updateEntity.mockResolvedValue(entity)
  api.updateWarehouse.mockResolvedValue(warehouse)
  const invalidations = vi.spyOn(client, 'invalidateQueries')
  const initialize = renderHook(() => useInitializeWorkshop(), { wrapper })
  const updateEntity = renderHook(() => useUpdateFiscalEntity(), { wrapper })
  const updateWarehouse = renderHook(() => useUpdateWarehouse(), { wrapper })

  await act(async () => {
    await initialize.result.current.mutateAsync({
      data: {
        commercial_ruc: '1150696977001',
        commercial_legal_name: 'Comercial',
        artisanal_ruc: '1104018559001',
        artisanal_legal_name: 'Artesanal',
        warehouse_name: 'Bodega',
      },
      idempotencyKey: 'operation-1',
    })
    await updateEntity.result.current.mutateAsync({
      id: 2,
      data: { legal_name: 'Repuestos VVH', expected_version: 2 },
    })
    await updateWarehouse.result.current.mutateAsync({
      name: 'Bodega principal',
      expected_version: 1,
    })
  })

  expect(api.initialize).toHaveBeenCalledWith(
    expect.objectContaining({ warehouse_name: 'Bodega' }),
    'operation-1',
  )
  expect(api.updateEntity).toHaveBeenCalledWith(2, {
    legal_name: 'Repuestos VVH',
    expected_version: 2,
  })
  expect(client.getQueryData(workshopKeys.entity(2))).toEqual(entity)
  expect(client.getQueryData(workshopKeys.warehouse())).toEqual(warehouse)
  expect(invalidations).toHaveBeenCalledWith({ queryKey: workshopKeys.all })
  expect(invalidations).toHaveBeenCalledWith({
    queryKey: workshopKeys.entities(),
  })
})

it('executes tax and series mutations and invalidates every affected projection', async () => {
  api.createTaxDefinition.mockResolvedValue({ id: 5 })
  api.createTaxPeriod.mockResolvedValue({ id: 6 })
  api.updateTaxPeriod.mockResolvedValue({ id: 6 })
  api.scheduleSuccessor.mockResolvedValue({ id: 7 })
  api.updateSeriesCode.mockResolvedValue(series)
  api.replaceSeries.mockResolvedValue({ ...series, id: 9, code: 'COM-NUE' })
  const invalidations = vi.spyOn(client, 'invalidateQueries')
  const createDefinition = renderHook(() => useCreateTaxDefinition(), {
    wrapper,
  })
  const createPeriod = renderHook(() => useCreateTaxPeriod(), { wrapper })
  const updatePeriod = renderHook(() => useUpdateTaxPeriod(), { wrapper })
  const scheduleSuccessor = renderHook(() => useScheduleSuccessor(), {
    wrapper,
  })
  const updateSeries = renderHook(() => useUpdateSeriesCode(), { wrapper })
  const replaceSeries = renderHook(() => useReplaceSeries(), { wrapper })

  await act(async () => {
    await createDefinition.result.current.mutateAsync({
      entity_id: 2,
      code: 'IVA',
      name: 'IVA',
    })
    await createPeriod.result.current.mutateAsync({
      taxDefId: 5,
      data: { rate: '15', starts_on: '2026-09-23' },
    })
    await updatePeriod.result.current.mutateAsync({
      periodId: 6,
      data: { rate: '12', expected_version: 1 },
    })
    await scheduleSuccessor.result.current.mutateAsync({
      periodId: 6,
      data: {
        new_rate: '13',
        successor_starts_on: '2026-10-01',
        expected_version: 2,
      },
    })
    await updateSeries.result.current.mutateAsync({
      seriesId: 8,
      data: { code: 'COM-VEN', expected_version: 1 },
    })
    await replaceSeries.result.current.mutateAsync({
      seriesId: 8,
      data: { new_code: 'COM-NUE', expected_version: 2 },
    })
  })

  expect(api.createTaxPeriod).toHaveBeenCalledWith(5, {
    rate: '15',
    starts_on: '2026-09-23',
  })
  expect(api.scheduleSuccessor).toHaveBeenCalledWith(
    6,
    expect.objectContaining({ new_rate: '13' }),
  )
  expect(api.updateSeriesCode).toHaveBeenCalledWith(8, {
    code: 'COM-VEN',
    expected_version: 1,
  })
  expect(client.getQueryData(workshopKeys.seriesDetail(8))).toEqual(series)

  const invalidatedKeys = invalidations.mock.calls.map(
    ([filters]) => filters?.queryKey,
  )
  expect(invalidatedKeys).toEqual(
    expect.arrayContaining([
      ['products'],
      ['services'],
      workshopKeys.taxDefinitions(2),
      workshopKeys.taxPeriods(5),
      ['workshop-configuration', 'taxes'],
      ['workshop-configuration', 'taxes', 'periods'],
      ['workshop-configuration', 'series'],
    ]),
  )
})

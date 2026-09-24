import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  finalize: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateIntervention: vi.fn(),
  addLine: vi.fn(),
  updateLine: vi.fn(),
  removeLine: vi.fn(),
  reopen: vi.fn(),
  uploadPhoto: vi.fn(),
  removePhoto: vi.fn(),
  customerOptions: vi.fn(),
  serviceOptions: vi.fn(),
  vehicleOptions: vi.fn(),
}))
vi.mock('./api', () => ({ maintenanceApi: api }))

import {
  maintenanceKeys,
  useCustomerPickerOptions,
  useMaintenanceMutations,
  useMaintenanceOrder,
  useMaintenanceOrders,
  useServicePickerOptions,
  useVehicleOptions,
} from './hooks'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

let client: QueryClient
beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

describe('maintenance hooks', () => {
  it('no consulta el detalle ni los vehículos sin identificador', () => {
    renderHook(() => useMaintenanceOrder(null), { wrapper: wrapper(client) })
    renderHook(() => useVehicleOptions(null), { wrapper: wrapper(client) })
    expect(api.get).not.toHaveBeenCalled()
    expect(api.vehicleOptions).not.toHaveBeenCalled()
  })

  it('una mutación guarda el detalle devuelto e invalida las listas', async () => {
    const order = { id: 5, version: 3 }
    api.finalize.mockResolvedValue(order)
    client.setQueryData(maintenanceKeys.list({}), { results: [] })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useMaintenanceMutations(), {
      wrapper: wrapper(client),
    })
    await act(() =>
      result.current.finalize.mutateAsync({
        id: 5,
        expectedVersion: 2,
        key: 'k-1',
      }),
    )
    expect(api.finalize).toHaveBeenCalledWith(5, 2, 'k-1')
    expect(client.getQueryData(maintenanceKeys.detail(5))).toEqual(order)
    expect(invalidate).toHaveBeenCalled()
    expect(client.getQueryState(maintenanceKeys.list({}))?.isInvalidated).toBe(
      true,
    )
  })

  it('los selectores adaptan opciones al combobox', async () => {
    api.customerOptions.mockResolvedValue({
      total_pages: 1,
      results: [
        {
          id: 1,
          name: 'Ana',
          identification_type: 'CI',
          identification: '171',
          phone: '099',
        },
      ],
    })
    api.serviceOptions.mockResolvedValue({
      total_pages: 1,
      results: [{ id: 2, name: 'Alineación', reference_price: '25.00' }],
    })
    const customers = renderHook(() => useCustomerPickerOptions('an', 1), {
      wrapper: wrapper(client),
    })
    const services = renderHook(() => useServicePickerOptions('al', 1), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(customers.result.current.data).toBeDefined())
    await waitFor(() => expect(services.result.current.data).toBeDefined())
    expect(customers.result.current.data?.options[0]).toEqual({
      id: 1,
      label: 'Ana',
      detail: 'CI 171 · 099',
    })
    expect(services.result.current.data?.options[0]?.detail).toBe(
      'Precio referencial USD 25.00',
    )
  })

  it('cada mutación delega en su operación de la API', async () => {
    const order = { id: 5, version: 3 }
    for (const fn of Object.values(api)) fn.mockResolvedValue(order)
    const { result } = renderHook(() => useMaintenanceMutations(), {
      wrapper: wrapper(client),
    })
    const m = result.current
    const base = { id: 5, expectedVersion: 2, key: 'k' }
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    await act(async () => {
      await m.create.mutateAsync({ data: {} as never, key: 'k' })
      await m.update.mutateAsync({ ...base, data: { notes: 'n' } })
      await m.updateIntervention.mutateAsync({ ...base, data: { notes: 'n' } })
      await m.addLine.mutateAsync({ ...base, data: { service_id: 1 } })
      await m.updateLine.mutateAsync({
        ...base,
        lineId: 8,
        data: { quantity: 2 },
      })
      await m.removeLine.mutateAsync({ ...base, lineId: 8 })
      await m.reopen.mutateAsync({ ...base, reason: 'r' })
      await m.uploadPhoto.mutateAsync({
        id: 5,
        file,
        description: 'd',
        key: 'k',
      })
      await m.removePhoto.mutateAsync({ id: 5, photoId: 9, key: 'k' })
    })
    expect(api.update).toHaveBeenCalledWith(5, { notes: 'n' }, 2, 'k')
    expect(api.updateIntervention).toHaveBeenCalledWith(
      5,
      { notes: 'n' },
      2,
      'k',
    )
    expect(api.addLine).toHaveBeenCalledWith(5, { service_id: 1 }, 2, 'k')
    expect(api.updateLine).toHaveBeenCalledWith(5, 8, { quantity: 2 }, 2, 'k')
    expect(api.removeLine).toHaveBeenCalledWith(5, 8, 2, 'k')
    expect(api.reopen).toHaveBeenCalledWith(5, 'r', 2, 'k')
    expect(api.uploadPhoto).toHaveBeenCalledWith(5, file, 'd', 'k')
    expect(api.removePhoto).toHaveBeenCalledWith(5, 9, 'k')
  })

  it('consulta listas, detalle y vehículos cuando hay identificador', async () => {
    api.list.mockResolvedValue({ results: [] })
    api.get.mockResolvedValue({ id: 5 })
    api.vehicleOptions.mockResolvedValue({ results: [] })
    const list = renderHook(() => useMaintenanceOrders({ page: 2 }), {
      wrapper: wrapper(client),
    })
    const detail = renderHook(() => useMaintenanceOrder(5), {
      wrapper: wrapper(client),
    })
    const vehicles = renderHook(() => useVehicleOptions(3), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(vehicles.result.current.isSuccess).toBe(true))
    expect(api.list).toHaveBeenCalledWith({ page: 2 })
    expect(api.get).toHaveBeenCalledWith(5)
    expect(api.vehicleOptions).toHaveBeenCalledWith(3)
  })
})

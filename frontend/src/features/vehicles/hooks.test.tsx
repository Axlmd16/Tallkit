import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

import type { createVehiclesApi } from './api'
import {
  useCustomerVehicles,
  useVehicle,
  useVehicleMutations,
  useVehicleOwnershipPeriods,
  useVehicles,
} from './hooks'
import type { OwnershipPeriodPage, VehicleSummary } from './types'

type VehiclesApi = ReturnType<typeof createVehiclesApi>

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const vehicle: VehicleSummary = {
    id: 1,
    plate: 'ABC-1234',
    model: 'Corolla',
    color: 'Blanco',
    year: 2023,
    vin: 'VIN001',
    is_active: true,
    version: 1,
    created_at: '2026-09-13T00:00:00Z',
    updated_at: '2026-09-13T00:00:00Z',
    brand: { id: 2, name: 'Toyota', is_active: true },
    current_owner: {
      id: 3,
      name: 'Carlos Vera',
      identification: '0912345678',
      is_active: true,
    },
  }
  const periods: OwnershipPeriodPage = {
    count: 1,
    page: 1,
    page_size: 20,
    total_pages: 1,
    results: [
      {
        id: 10,
        vehicle_id: 1,
        customer: {
          id: 3,
          name: 'Carlos Vera',
          identification: '0912345678',
          is_active: true,
        },
        started_at: '2026-09-13T00:00:00Z',
        ended_at: null,
        is_current: true,
      },
    ],
  }
  const api = {
    list: vi.fn().mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [vehicle],
    }),
    get: vi.fn().mockResolvedValue(vehicle),
    create: vi.fn().mockResolvedValue(vehicle),
    update: vi
      .fn()
      .mockResolvedValue({ ...vehicle, color: 'Negro', version: 2 }),
    listByCustomer: vi.fn().mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [vehicle],
    }),
    changeOwner: vi.fn().mockResolvedValue({
      ...vehicle,
      current_owner: {
        id: 5,
        name: 'Nuevo Dueño',
        identification: '0987654321',
        is_active: true,
      },
      version: 2,
    }),
    listOwnershipPeriods: vi.fn().mockResolvedValue(periods),
    activate: vi.fn().mockResolvedValue({ ...vehicle, is_active: true }),
    deactivate: vi.fn().mockResolvedValue({ ...vehicle, is_active: false }),
  } as unknown as VehiclesApi

  return { api, client, vehicle, wrapper }
}

it('loads vehicles list, individual vehicle, and customer vehicles', async () => {
  const { api, wrapper } = setup()
  const listHook = renderHook(() => useVehicles({ search: 'ABC' }, api), {
    wrapper,
  })
  const detailHook = renderHook(() => useVehicle(1, api), { wrapper })
  const customerVehiclesHook = renderHook(
    () => useCustomerVehicles(3, 1, 20, api),
    { wrapper },
  )

  await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true))
  await waitFor(() => expect(detailHook.result.current.isSuccess).toBe(true))
  await waitFor(() =>
    expect(customerVehiclesHook.result.current.isSuccess).toBe(true),
  )

  expect(listHook.result.current.data?.results).toHaveLength(1)
  expect(detailHook.result.current.data?.plate).toBe('ABC-1234')
  expect(customerVehiclesHook.result.current.data?.results).toHaveLength(1)
})

it('useVehicle is disabled when id is null', async () => {
  const { api, wrapper } = setup()
  const hook = renderHook(() => useVehicle(null, api), { wrapper })
  expect(hook.result.current.fetchStatus).toBe('idle')
  expect(api.get).not.toHaveBeenCalled()
})

it('useCustomerVehicles is disabled when customerId is null', async () => {
  const { api, wrapper } = setup()
  const hook = renderHook(() => useCustomerVehicles(null, 1, 20, api), {
    wrapper,
  })
  expect(hook.result.current.fetchStatus).toBe('idle')
  expect(api.listByCustomer).not.toHaveBeenCalled()
})

it('useVehicleOwnershipPeriods loads periods and is disabled for null vehicleId', async () => {
  const { api, wrapper } = setup()

  const disabledHook = renderHook(
    () => useVehicleOwnershipPeriods(null, 1, 20, api),
    { wrapper },
  )
  expect(disabledHook.result.current.fetchStatus).toBe('idle')

  const enabledHook = renderHook(
    () => useVehicleOwnershipPeriods(1, 1, 20, api),
    { wrapper },
  )
  await waitFor(() => expect(enabledHook.result.current.isSuccess).toBe(true))
  expect(enabledHook.result.current.data?.results).toHaveLength(1)
  expect(enabledHook.result.current.data?.results[0]?.is_current).toBe(true)
})

it('executes create and update mutations', async () => {
  const { api, client, wrapper } = setup()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useVehicleMutations(api), {
    wrapper,
  })

  await act(async () => {
    await result.current.createVehicle.mutateAsync({
      owner_id: 3,
      brand_id: 2,
      plate: 'ABC-1234',
      model: 'Corolla',
    })
  })
  expect(api.create).toHaveBeenCalledWith({
    owner_id: 3,
    brand_id: 2,
    plate: 'ABC-1234',
    model: 'Corolla',
  })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ['customer-vehicles', 3],
  })

  await act(async () => {
    await result.current.updateVehicle.mutateAsync({
      id: 1,
      data: { color: 'Negro', expected_version: 1 },
    })
  })
  expect(api.update).toHaveBeenCalledWith(1, {
    color: 'Negro',
    expected_version: 1,
  })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles', 1] })
})

it('changeOwner mutation invalidates vehicles, periods and both owner caches', async () => {
  const { api, client, wrapper } = setup()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useVehicleMutations(api), { wrapper })

  await act(async () => {
    await result.current.changeOwner.mutateAsync({
      id: 1,
      data: { owner_id: 5, expected_version: 1 },
      previousOwnerId: 3,
    })
  })

  expect(api.changeOwner).toHaveBeenCalledWith(1, {
    owner_id: 5,
    expected_version: 1,
  })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles', 1] })
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ['vehicle-ownership-periods', 1],
  })
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ['customer-vehicles', 3],
  })
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ['customer-vehicles', 5],
  })
})

it('changeOwner without previousOwnerId does not invalidate old owner cache', async () => {
  const { api, client, wrapper } = setup()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useVehicleMutations(api), { wrapper })

  await act(async () => {
    await result.current.changeOwner.mutateAsync({
      id: 1,
      data: { owner_id: 5, expected_version: 1 },
    })
  })

  expect(invalidateSpy).not.toHaveBeenCalledWith({
    queryKey: ['customer-vehicles', 3],
  })
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ['customer-vehicles', 5],
  })
})

it('activate and deactivate mutations invalidate vehicles and customer cache', async () => {
  const { api, client, wrapper } = setup()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useVehicleMutations(api), { wrapper })

  await act(async () => {
    await result.current.activateVehicle.mutateAsync({
      id: 1,
      expectedVersion: 1,
    })
  })
  expect(api.activate).toHaveBeenCalledWith(1, 1)
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles', 1] })
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ['customer-vehicles', 3],
  })

  invalidateSpy.mockClear()

  await act(async () => {
    await result.current.deactivateVehicle.mutateAsync({
      id: 1,
      expectedVersion: 1,
    })
  })
  expect(api.deactivate).toHaveBeenCalledWith(1, 1)
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles', 1] })
})

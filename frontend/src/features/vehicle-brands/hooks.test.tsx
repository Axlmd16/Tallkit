import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

import type { createVehicleBrandsApi } from './api'
import {
  useVehicleBrand,
  useVehicleBrandMutations,
  useVehicleBrands,
} from './hooks'
import type { VehicleBrandSummary } from './types'

type VehicleBrandsApi = ReturnType<typeof createVehicleBrandsApi>

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const brand: VehicleBrandSummary = {
    id: 1,
    name: 'Toyota',
    is_active: true,
    version: 1,
    created_at: '2026-09-13T00:00:00Z',
    updated_at: '2026-09-13T00:00:00Z',
  }
  const api = {
    list: vi.fn().mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [brand],
    }),
    get: vi.fn().mockResolvedValue(brand),
    create: vi.fn().mockResolvedValue(brand),
    update: vi
      .fn()
      .mockResolvedValue({ ...brand, name: 'Toyota Motor', version: 2 }),
    activate: vi
      .fn()
      .mockResolvedValue({ ...brand, is_active: true, version: 3 }),
    deactivate: vi
      .fn()
      .mockResolvedValue({ ...brand, is_active: false, version: 2 }),
  } as unknown as VehicleBrandsApi

  return { api, brand, client, wrapper }
}

it('loads vehicle brands list and individual brand detail', async () => {
  const { api, wrapper } = setup()
  const listHook = renderHook(() => useVehicleBrands({ search: 'Toy' }, api), {
    wrapper,
  })
  const detailHook = renderHook(() => useVehicleBrand(1, api), { wrapper })

  await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true))
  await waitFor(() => expect(detailHook.result.current.isSuccess).toBe(true))

  expect(listHook.result.current.data?.results).toHaveLength(1)
  expect(detailHook.result.current.data?.name).toBe('Toyota')
})

it('executes create, update, activate, and deactivate mutations', async () => {
  const { api, client, wrapper } = setup()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useVehicleBrandMutations(api), {
    wrapper,
  })

  await act(async () => {
    await result.current.createBrand.mutateAsync({ name: 'Toyota' })
  })
  expect(api.create).toHaveBeenCalledWith({ name: 'Toyota' })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicle-brands'] })

  await act(async () => {
    await result.current.updateBrand.mutateAsync({
      id: 1,
      data: { name: 'Toyota Motor', expected_version: 1 },
    })
  })
  expect(api.update).toHaveBeenCalledWith(1, {
    name: 'Toyota Motor',
    expected_version: 1,
  })

  await act(async () => {
    await result.current.deactivateBrand.mutateAsync({
      id: 1,
      expectedVersion: 2,
    })
  })
  expect(api.deactivate).toHaveBeenCalledWith(1, 2)

  await act(async () => {
    await result.current.activateBrand.mutateAsync({
      id: 1,
      expectedVersion: 3,
    })
  })
  expect(api.activate).toHaveBeenCalledWith(1, 3)
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
})

import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createVehiclesApi } from './api'

it('maps filters, queries, and mutations to explicit vehicles API routes', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createVehiclesApi({ request } as unknown as ApiClient)

  await api.list({
    search: 'ABC',
    isActive: true,
    brandId: 4,
    page: 2,
    pageSize: 10,
  })
  await api.get(7)
  await api.create({
    owner_id: 1,
    brand_id: 4,
    plate: 'ABC-1234',
    model: 'Corolla',
    color: 'Blanco',
    year: 2023,
    vin: 'VIN123',
  })
  await api.update(7, {
    expected_version: 1,
    color: 'Negro',
  })
  await api.listByCustomer(1, 2, 15)

  expect(request).toHaveBeenNthCalledWith(
    1,
    '/vehicles/?search=ABC&is_active=true&brand_id=4&page=2&page_size=10',
  )
  expect(request).toHaveBeenNthCalledWith(2, '/vehicles/7/')
  expect(request).toHaveBeenNthCalledWith(3, '/vehicles/', {
    method: 'POST',
    body: {
      owner_id: 1,
      brand_id: 4,
      plate: 'ABC-1234',
      model: 'Corolla',
      color: 'Blanco',
      year: 2023,
      vin: 'VIN123',
    },
  })
  expect(request).toHaveBeenNthCalledWith(4, '/vehicles/7/', {
    method: 'PATCH',
    body: {
      expected_version: 1,
      color: 'Negro',
    },
  })
  expect(request).toHaveBeenNthCalledWith(
    5,
    '/customers/1/vehicles/?page=2&page_size=15',
  )
})

it('maps changeOwner, listOwnershipPeriods, activate and deactivate to correct routes', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createVehiclesApi({ request } as unknown as ApiClient)

  await api.changeOwner(5, { owner_id: 9, expected_version: 2 })
  await api.listOwnershipPeriods(5, 1, 20)
  await api.activate(5, 3)
  await api.deactivate(5, 3)

  expect(request).toHaveBeenNthCalledWith(1, '/vehicles/5/change-owner/', {
    method: 'POST',
    body: { owner_id: 9, expected_version: 2 },
  })
  expect(request).toHaveBeenNthCalledWith(
    2,
    '/vehicles/5/ownership/?page_size=20',
  )
  expect(request).toHaveBeenNthCalledWith(3, '/vehicles/5/activate/', {
    method: 'POST',
    body: { expected_version: 3 },
  })
  expect(request).toHaveBeenNthCalledWith(4, '/vehicles/5/deactivate/', {
    method: 'POST',
    body: { expected_version: 3 },
  })
})

it('api.list with no filters uses no query string', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createVehiclesApi({ request } as unknown as ApiClient)

  await api.list({})
  expect(request).toHaveBeenCalledWith('/vehicles/')
})

it('listByCustomer with page 1 omits page param', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createVehiclesApi({ request } as unknown as ApiClient)

  await api.listByCustomer(3, 1, 20)
  // page=1 is omitted, only page_size
  expect(request).toHaveBeenCalledWith('/customers/3/vehicles/?page_size=20')
})

it('listOwnershipPeriods with page > 1 includes both params', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createVehiclesApi({ request } as unknown as ApiClient)

  await api.listOwnershipPeriods(7, 2, 10)
  expect(request).toHaveBeenCalledWith(
    '/vehicles/7/ownership/?page=2&page_size=10',
  )
})

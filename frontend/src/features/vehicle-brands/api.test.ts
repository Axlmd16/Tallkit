import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createVehicleBrandsApi } from './api'

it('maps filters, queries, and mutations to explicit vehicle brands API routes', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createVehicleBrandsApi({ request } as unknown as ApiClient)

  await api.list({ search: 'Toy', isActive: true, page: 2, pageSize: 10 })
  await api.get(3)
  await api.create({ name: 'Toyota' })
  await api.update(3, { name: 'Toyota Motor', expected_version: 1 })
  await api.activate(3, 2)
  await api.deactivate(3, 3)

  expect(request).toHaveBeenNthCalledWith(
    1,
    '/vehicle-brands/?search=Toy&is_active=true&page=2&page_size=10',
  )
  expect(request).toHaveBeenNthCalledWith(2, '/vehicle-brands/3/')
  expect(request).toHaveBeenNthCalledWith(3, '/vehicle-brands/', {
    method: 'POST',
    body: { name: 'Toyota' },
  })
  expect(request).toHaveBeenNthCalledWith(4, '/vehicle-brands/3/', {
    method: 'PATCH',
    body: { name: 'Toyota Motor', expected_version: 1 },
  })
  expect(request).toHaveBeenNthCalledWith(5, '/vehicle-brands/3/activate/', {
    method: 'POST',
    body: { expected_version: 2 },
  })
  expect(request).toHaveBeenNthCalledWith(6, '/vehicle-brands/3/deactivate/', {
    method: 'POST',
    body: { expected_version: 3 },
  })
})

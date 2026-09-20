import { expect, it, vi } from 'vitest'

import type { ApiClient } from './client'
import { buildQuery, createCatalogResource } from './catalog-resource'

it('serializa solo parámetros presentes y conserva el orden', () => {
  expect(
    buildQuery({ search: ' aceite ', is_active: 'all', page: 1, empty: '' }),
  ).toBe('?search=aceite&is_active=all&page=1')
  expect(buildQuery({ page: undefined, x: null })).toBe('')
})

it('mapea rutas y añade la clave de idempotencia sin mutar el payload', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createCatalogResource<{ name: string }>(
    { request } as unknown as ApiClient,
    '/things',
  )
  const data = { name: 'A' }

  await api.list({ search: 'a', isActive: 'false', page: 2, pageSize: 10 })
  await api.get(4)
  await api.create(data, 'key-create-1')
  await api.update(4, { name: 'B', expected_version: 1 }, 'key-update-1')
  await api.setActive(4, true, 2, 'key-on-0001')
  await api.setActive(4, false, 3, 'key-off-001')

  expect(data).toEqual({ name: 'A' })
  expect(request.mock.calls).toEqual([
    ['/things/?search=a&is_active=false&page=2&page_size=10'],
    ['/things/4/'],
    [
      '/things/',
      { method: 'POST', body: { name: 'A', idempotency_key: 'key-create-1' } },
    ],
    [
      '/things/4/',
      {
        method: 'PATCH',
        body: {
          name: 'B',
          expected_version: 1,
          idempotency_key: 'key-update-1',
        },
      },
    ],
    [
      '/things/4/activate/',
      {
        method: 'POST',
        body: { expected_version: 2, idempotency_key: 'key-on-0001' },
      },
    ],
    [
      '/things/4/deactivate/',
      {
        method: 'POST',
        body: { expected_version: 3, idempotency_key: 'key-off-001' },
      },
    ],
  ])
})

import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createCustomersApi } from './api'

it('maps filters, queries, and mutations to explicit customer API routes', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createCustomersApi({ request } as unknown as ApiClient)

  await api.list({ search: '0912345678', isActive: true, page: 2 })
  await api.get(5)
  await api.create({
    person_type: 'NATURAL',
    identification_type: 'CI',
    identification: '0912345678',
    name: 'Carlos Vera',
    phone: '0991234567',
  })
  await api.update(5, {
    person_type: 'NATURAL',
    identification_type: 'CI',
    identification: '0912345678',
    name: 'Carlos Vera',
    phone: '0997654321',
    expected_version: 1,
  })
  await api.matches({ name: 'Carlos', phone: '0991234567', exclude_id: 5 })
  await api.activate(5, 2)
  await api.deactivate(5, 3)

  expect(request).toHaveBeenNthCalledWith(
    1,
    '/customers/?search=0912345678&is_active=true&page=2',
  )
  expect(request).toHaveBeenNthCalledWith(2, '/customers/5/')
  expect(request).toHaveBeenNthCalledWith(3, '/customers/', {
    method: 'POST',
    body: {
      person_type: 'NATURAL',
      identification_type: 'CI',
      identification: '0912345678',
      name: 'Carlos Vera',
      phone: '0991234567',
    },
  })
  expect(request).toHaveBeenNthCalledWith(4, '/customers/5/', {
    method: 'PATCH',
    body: {
      person_type: 'NATURAL',
      identification_type: 'CI',
      identification: '0912345678',
      name: 'Carlos Vera',
      phone: '0997654321',
      expected_version: 1,
    },
  })
  expect(request).toHaveBeenNthCalledWith(5, '/customers/matches/', {
    method: 'POST',
    body: {
      name: 'Carlos',
      phone: '0991234567',
      exclude_id: 5,
    },
  })
  expect(request).toHaveBeenNthCalledWith(6, '/customers/5/activate/', {
    method: 'POST',
    body: { expected_version: 2 },
  })
  expect(request).toHaveBeenNthCalledWith(7, '/customers/5/deactivate/', {
    method: 'POST',
    body: { expected_version: 3 },
  })
})

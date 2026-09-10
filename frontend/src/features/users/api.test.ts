import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createUsersApi } from './api'

it('maps filters and sensitive actions to explicit API routes', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createUsersApi({ request } as unknown as ApiClient)

  await api.list({ search: 'ana', isActive: true, role: 'VENDEDOR', page: 2 })
  await api.roles()
  await api.create({
    username: 'ana',
    first_name: '',
    last_name: '',
    email: '',
    roles: ['VENDEDOR'],
  })
  await api.update(7, {
    username: 'ana',
    first_name: '',
    last_name: '',
    email: '',
    roles: ['VENDEDOR'],
  })
  await api.activate(7)
  await api.deactivate(7)
  await api.resetPassword(7, 'operation-id')

  expect(request).toHaveBeenNthCalledWith(
    1,
    '/users/?search=ana&is_active=true&role=VENDEDOR&page=2',
  )
  expect(request).toHaveBeenCalledWith('/roles/')
  expect(request).toHaveBeenCalledWith('/users/7/activate/', { method: 'POST' })
  expect(request).toHaveBeenNthCalledWith(6, '/users/7/deactivate/', {
    method: 'POST',
  })
  expect(request).toHaveBeenNthCalledWith(7, '/users/7/reset-password/', {
    method: 'POST',
    body: { operation_id: 'operation-id' },
  })
})

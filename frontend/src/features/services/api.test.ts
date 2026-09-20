import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createServicesApi } from './api'

it('usa solo las rutas de servicios, incluida la de opciones artesanales', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createServicesApi({ request } as unknown as ApiClient)

  await api.list({ search: 'alineación', isActive: 'true' })
  await api.taxOptions({ pageSize: 20 })
  await api.setActive(9, false, 2, 'key-service-1')

  const urls = request.mock.calls.map((call) => call[0])
  expect(urls).toEqual([
    '/services/?search=alineaci%C3%B3n&is_active=true',
    '/services/tax-options/?page_size=20',
    '/services/9/deactivate/',
  ])
  expect(urls.some((url) => String(url).includes('/configuration'))).toBe(false)
})

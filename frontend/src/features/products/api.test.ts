import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createProductsApi } from './api'

it('mapea filtros combinados y opciones tributarias a rutas explícitas', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createProductsApi({ request } as unknown as ApiClient)

  await api.list({
    search: 'aceite',
    isActive: 'all',
    categoryId: 3,
    productBrandId: 4,
    vehicleBrandId: 5,
    page: 2,
    pageSize: 50,
  })
  await api.taxOptions({ search: 'iva', page: 1 })

  expect(request.mock.calls[0]).toEqual([
    '/products/?search=aceite&is_active=all&page=2&page_size=50&category_id=3&product_brand_id=4&vehicle_brand_id=5',
  ])
  expect(request.mock.calls[1]).toEqual([
    '/products/tax-options/?search=iva&page=1',
  ])
})

it('conserva importes como cadenas al enviar el alta', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createProductsApi({ request } as unknown as ApiClient)

  await api.create(
    { sale_price: '10.50', content_quantity: '0.500000' },
    'k-1234567',
  )

  expect(request).toHaveBeenCalledWith('/products/', {
    method: 'POST',
    body: {
      sale_price: '10.50',
      content_quantity: '0.500000',
      idempotency_key: 'k-1234567',
    },
  })
})

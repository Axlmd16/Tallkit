import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createSuppliersApi } from './api'

it('consulta coincidencias sin clave de idempotencia y excluye el registro actual', async () => {
  const request = vi.fn().mockResolvedValue({ results: [], has_more: false })
  const api = createSuppliersApi({ request } as unknown as ApiClient)

  await api.matches('Repuestos Sur')
  await api.matches('Repuestos Sur', 7)

  expect(request.mock.calls).toEqual([
    [
      '/suppliers/matches/',
      { method: 'POST', body: { name: 'Repuestos Sur' } },
    ],
    [
      '/suppliers/matches/',
      { method: 'POST', body: { name: 'Repuestos Sur', exclude_id: 7 } },
    ],
  ])
})

it('permite borrar la identificación enviando el par nulo', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createSuppliersApi({ request } as unknown as ApiClient)

  await api.update(
    2,
    { identification_type: null, identification: null, expected_version: 1 },
    'key-supplier-1',
  )

  expect(request).toHaveBeenCalledWith('/suppliers/2/', {
    method: 'PATCH',
    body: {
      identification_type: null,
      identification: null,
      expected_version: 1,
      idempotency_key: 'key-supplier-1',
    },
  })
})

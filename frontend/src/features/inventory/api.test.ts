import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createInventoryApi } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  return { client: { request } as unknown as ApiClient, request }
}

describe('inventoryApi', () => {
  it('la lista de existencias traduce filtros a la consulta', async () => {
    const { client, request } = fakeClient()
    await createInventoryApi(client).stock({
      search: 'aceite',
      categoryId: 2,
      isActive: 'all',
      stock: 'positive',
      page: 3,
    })
    expect(request).toHaveBeenCalledWith(
      '/inventory/?search=aceite&category_id=2&is_active=all&stock=positive&page=3',
    )
  })

  it('el Kardex envía filtros y el token de corte sin alterarlos', async () => {
    const { client, request } = fakeClient()
    await createInventoryApi(client).kardex(9, {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      movementType: 'ADJUSTMENT_OUT',
      sourceType: 'PURCHASE',
      sourceId: 4,
      actorId: 1,
      page: 2,
      pageSize: 50,
      cutToken: 'abc:def',
    })
    expect(request).toHaveBeenCalledWith(
      '/inventory/products/9/kardex/?date_from=2026-09-01&date_to=2026-09-30&movement_type=ADJUSTMENT_OUT&source_type=PURCHASE&source_id=4&actor_id=1&page=2&page_size=50&cut_token=abc%3Adef',
    )
  })

  it('las operaciones manuales envían clave, versión y token', async () => {
    const { client, request } = fakeClient()
    const api = createInventoryApi(client)
    await api.create(
      {
        kind: 'ADJUSTMENT_IN',
        product_id: 1,
        quantity: '3',
        unit_cost: '2.50',
        reason: 'Hallazgo',
      },
      'k1',
    )
    expect(request).toHaveBeenLastCalledWith('/inventory/operations/', {
      method: 'POST',
      body: {
        kind: 'ADJUSTMENT_IN',
        product_id: 1,
        quantity: '3',
        unit_cost: '2.50',
        reason: 'Hallazgo',
        idempotency_key: 'k1',
      },
    })
    await api.confirm(4, { expectedVersion: 1, reviewToken: 't' }, 'k2')
    expect(request).toHaveBeenLastCalledWith(
      '/inventory/operations/4/confirm/',
      {
        method: 'POST',
        body: { expected_version: 1, review_token: 't', idempotency_key: 'k2' },
      },
    )
    await api.reverse(
      4,
      { expectedVersion: 2, reviewToken: 't', reason: 'Error' },
      'k3',
    )
    expect(request).toHaveBeenLastCalledWith(
      '/inventory/operations/4/reverse/',
      {
        method: 'POST',
        body: {
          expected_version: 2,
          review_token: 't',
          reason: 'Error',
          idempotency_key: 'k3',
        },
      },
    )
  })
})

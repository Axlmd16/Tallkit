import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createPurchasesApi } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  return { client: { request } as unknown as ApiClient, request }
}

describe('purchasesApi', () => {
  it('lista con filtros de estado, período y usuario en snake_case', async () => {
    const { client, request } = fakeClient()
    await createPurchasesApi(client).list({
      state: 'CONFIRMED',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      registeredBy: 4,
      page: 2,
    })
    expect(request).toHaveBeenCalledWith(
      '/purchases/?state=CONFIRMED&date_from=2026-01-01&date_to=2026-01-31&registered_by=4&page=2',
    )
  })

  it('la revisión no lleva clave y el registro sí, sin convertir decimales', async () => {
    const { client, request } = fakeClient()
    const api = createPurchasesApi(client)
    const input = {
      lines: [{ product_id: 1, quantity: '2', unit_cost: '0.335000' }],
      supplier_id: 3,
      reference: 'F-1',
    }
    await api.reviewEntry(input)
    expect(request).toHaveBeenLastCalledWith('/purchases/entries/review/', {
      method: 'POST',
      body: input,
    })
    await api.registerEntry(input, 'key-1')
    expect(request).toHaveBeenLastCalledWith('/purchases/entries/', {
      method: 'POST',
      body: { ...input, idempotency_key: 'key-1' },
    })
  })

  it('una entrada mínima solo envía productos y cantidades', async () => {
    const { client, request } = fakeClient()
    await createPurchasesApi(client).registerEntry(
      { lines: [{ product_id: 9, quantity: '1' }] },
      'k',
    )
    expect(request).toHaveBeenCalledWith('/purchases/entries/', {
      method: 'POST',
      body: { lines: [{ product_id: 9, quantity: '1' }], idempotency_key: 'k' },
    })
  })

  it('la anulación usa la revisión firmada y su clave', async () => {
    const { client, request } = fakeClient()
    const api = createPurchasesApi(client)
    await api.voidPreview(1)
    expect(request).toHaveBeenLastCalledWith('/purchases/1/void-preview/', {
      method: 'POST',
      body: {},
    })
    await api.void(
      1,
      { expectedVersion: 2, reviewToken: 't', reason: 'Error' },
      'k',
    )
    expect(request).toHaveBeenLastCalledWith('/purchases/1/void/', {
      method: 'POST',
      body: {
        expected_version: 2,
        review_token: 't',
        reason: 'Error',
        idempotency_key: 'k',
      },
    })
  })

  it('los proveedores se piden a la selección mínima y no al catálogo', async () => {
    const { client, request } = fakeClient()
    await createPurchasesApi(client).supplierOptions('andi', 2)
    expect(request).toHaveBeenCalledWith(
      '/suppliers/options/?search=andi&page=2&page_size=10',
    )
  })

  it('ya no existen las rutas del flujo anterior', () => {
    const { client } = fakeClient()
    const api = createPurchasesApi(client) as Record<string, unknown>
    for (const retired of [
      'create',
      'update',
      'preview',
      'confirm',
      'replacement',
      'taxOptions',
    ]) {
      expect(api[retired]).toBeUndefined()
    }
  })
})

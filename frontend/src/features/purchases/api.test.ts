import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createPurchasesApi } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  return { client: { request } as unknown as ApiClient, request }
}

describe('purchasesApi', () => {
  it('lista con filtros de proveedor, estado y período en snake_case', async () => {
    const { client, request } = fakeClient()
    await createPurchasesApi(client).list({
      supplierId: 3,
      state: 'CONFIRMED',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 2,
    })
    expect(request).toHaveBeenCalledWith(
      '/purchases/?supplier_id=3&state=CONFIRMED&date_from=2026-01-01&date_to=2026-01-31&page=2',
    )
  })

  it('las escrituras llevan la clave y las lecturas de revisión no', async () => {
    const { client, request } = fakeClient()
    const api = createPurchasesApi(client)
    await api.preview(7)
    expect(request).toHaveBeenLastCalledWith('/purchases/7/preview/', {
      method: 'POST',
      body: {},
    })
    await api.confirm(
      7,
      { expectedVersion: 2, reviewToken: 'tok', acknowledgedMatches: [4] },
      'key-1',
    )
    expect(request).toHaveBeenLastCalledWith('/purchases/7/confirm/', {
      method: 'POST',
      body: {
        expected_version: 2,
        review_token: 'tok',
        acknowledged_matches: [4],
        idempotency_key: 'key-1',
      },
    })
  })

  it('la edición envía versión esperada y clave sin convertir decimales', async () => {
    const { client, request } = fakeClient()
    await createPurchasesApi(client).update(
      5,
      {
        lines: [
          {
            product_id: 1,
            quantity: '2',
            unit_cost: '0.335000',
            tax_definition_id: 9,
            tax_recoverability: 'RECOVERABLE',
          },
        ],
      },
      3,
      'key-2',
    )
    expect(request).toHaveBeenCalledWith('/purchases/5/', {
      method: 'PATCH',
      body: {
        lines: [
          {
            product_id: 1,
            quantity: '2',
            unit_cost: '0.335000',
            tax_definition_id: 9,
            tax_recoverability: 'RECOVERABLE',
          },
        ],
        expected_version: 3,
        idempotency_key: 'key-2',
      },
    })
  })

  it('anulación, reemplazo y opciones tributarias usan sus rutas', async () => {
    const { client, request } = fakeClient()
    const api = createPurchasesApi(client)
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
    await api.replacement(1, 'k2')
    expect(request).toHaveBeenLastCalledWith('/purchases/1/replacement/', {
      method: 'POST',
      body: { idempotency_key: 'k2' },
    })
    await api.taxOptions('2026-01-15')
    expect(request).toHaveBeenLastCalledWith(
      '/purchases/tax-options/?document_date=2026-01-15&page_size=100',
    )
  })
})

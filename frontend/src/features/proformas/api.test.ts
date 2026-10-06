import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createProformasApi, proformaLogoUrl } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  return { client: { request } as unknown as ApiClient, request }
}

describe('proformasApi', () => {
  it('lista con búsqueda, estado efectivo, cliente y página', async () => {
    const { client, request } = fakeClient()
    await createProformasApi(client).list({
      search: ' COM-PRO ',
      state: 'EXPIRED',
      customerId: 4,
      page: 2,
    })
    expect(request).toHaveBeenCalledWith(
      '/proformas/?search=COM-PRO&state=EXPIRED&customer_id=4&page=2',
    )
  })

  it('crea y guarda solo cliente, vigencia, productos y cantidades', async () => {
    const { client, request } = fakeClient()
    const api = createProformasApi(client)
    const data = {
      customer_id: 7,
      valid_until: null,
      lines: [{ product_id: 3, quantity: '2' }],
    }
    await api.create(data, 'key-1')
    expect(request).toHaveBeenLastCalledWith('/proformas/', {
      method: 'POST',
      body: { ...data, idempotency_key: 'key-1' },
    })
    await api.update(9, { lines: [] }, 4, 'key-2')
    expect(request).toHaveBeenLastCalledWith('/proformas/9/', {
      method: 'PATCH',
      body: { lines: [], expected_version: 4, idempotency_key: 'key-2' },
    })
    for (const [, options] of request.mock.calls) {
      const body = JSON.stringify((options as { body: object }).body)
      expect(body).not.toMatch(/price|total|tax|discount|condition/)
    }
  })

  it('las revisiones son lecturas sin clave de intento', async () => {
    const { client, request } = fakeClient()
    const api = createProformasApi(client)
    await api.issuePreview(5)
    expect(request).toHaveBeenLastCalledWith('/proformas/5/issue-preview/')
    await api.conversionPreview(5)
    expect(request).toHaveBeenLastCalledWith('/proformas/5/conversion-preview/')
    await api.draftPreview({ customer_id: 1, lines: [] })
    expect(request).toHaveBeenLastCalledWith('/proformas/draft-preview/', {
      method: 'POST',
      body: { customer_id: 1, lines: [] },
    })
  })

  it('emitir y convertir envían versión, revisión y la clave del intento', async () => {
    const { client, request } = fakeClient()
    const api = createProformasApi(client)
    const reviewed = { expectedVersion: 2, reviewToken: 'tok' }
    const body = {
      expected_version: 2,
      review_token: 'tok',
      idempotency_key: 'key-3',
    }
    await api.issue(5, reviewed, 'key-3')
    expect(request).toHaveBeenLastCalledWith('/proformas/5/issue/', {
      method: 'POST',
      body,
    })
    await api.convert(5, reviewed, 'key-3')
    expect(request).toHaveBeenLastCalledWith('/proformas/5/convert/', {
      method: 'POST',
      body,
    })
  })

  it('anular y copiar conservan la clave del intento', async () => {
    const { client, request } = fakeClient()
    const api = createProformasApi(client)
    await api.void(5, 3, 'key-4')
    expect(request).toHaveBeenLastCalledWith('/proformas/5/void/', {
      method: 'POST',
      body: { expected_version: 3, idempotency_key: 'key-4' },
    })
    await api.copy(5, 'key-5')
    expect(request).toHaveBeenLastCalledWith('/proformas/5/copy/', {
      method: 'POST',
      body: { idempotency_key: 'key-5' },
    })
  })

  it('consulta documento y selectores propios de proformas', async () => {
    const { client, request } = fakeClient()
    const api = createProformasApi(client)
    await api.document(5)
    expect(request).toHaveBeenLastCalledWith('/proformas/5/document/')
    await api.customerOptions('ana', 1)
    expect(request).toHaveBeenLastCalledWith(
      '/proformas/customer-options/?search=ana&page=1',
    )
    await api.productOptions('filtro', 2)
    expect(request).toHaveBeenLastCalledWith(
      '/proformas/product-options/?search=filtro&page=2',
    )
  })

  it('el logo del documento es el histórico de la oferta', () => {
    expect(proformaLogoUrl(12)).toMatch(/\/proformas\/12\/document\/logo\/$/)
    expect(proformaLogoUrl(12)).not.toContain('entity-logos')
  })

  it('la conversión de una proforma sin cliente envía el cliente elegido', async () => {
    const { client, request } = fakeClient()
    const api = createProformasApi(client)
    await api.conversionPreview(5, 3)
    expect(request).toHaveBeenLastCalledWith(
      '/proformas/5/conversion-preview/?customer_id=3',
    )
    await api.convert(
      5,
      { expectedVersion: 2, reviewToken: 'tok', customerId: 3 },
      'key-9',
    )
    expect(request).toHaveBeenLastCalledWith('/proformas/5/convert/', {
      method: 'POST',
      body: {
        expected_version: 2,
        review_token: 'tok',
        idempotency_key: 'key-9',
        customer_id: 3,
      },
    })
  })
})

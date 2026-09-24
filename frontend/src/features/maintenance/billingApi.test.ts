import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createMaintenanceApi } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  return { client: { request } as unknown as ApiClient, request }
}

describe('maintenanceApi: integración económica', () => {
  it('los repuestos se gestionan desde la orden con versión y clave', async () => {
    const { client, request } = fakeClient()
    const api = createMaintenanceApi(client)
    await api.addPart(3, { product_id: 7, quantity: '2' }, 4, 'k-1')
    expect(request).toHaveBeenLastCalledWith('/maintenance-orders/3/parts/', {
      method: 'POST',
      body: {
        product_id: 7,
        quantity: '2',
        expected_version: 4,
        idempotency_key: 'k-1',
      },
    })
    await api.changePart(3, 11, '4', 5, 'k-2')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/parts/11/',
      {
        method: 'PATCH',
        body: { quantity: '4', expected_version: 5, idempotency_key: 'k-2' },
      },
    )
    await api.removePart(3, 11, 6, 'k-3')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/parts/11/remove/',
      { method: 'POST', body: { expected_version: 6, idempotency_key: 'k-3' } },
    )
    await api.partProductOptions(3, 'fil', 2)
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/parts/product-options/?search=fil&page=2',
    )
  })

  it('la operación artesanal exige vista previa y huella al confirmar', async () => {
    const { client, request } = fakeClient()
    const api = createMaintenanceApi(client)
    await api.previewServiceOperation(3, 'CREDITO')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/service-operations/preview/',
      { method: 'POST', body: { condition: 'CREDITO' } },
    )
    await api.confirmServiceOperation(
      3,
      { condition: 'CREDITO', review_digest: 'abc' },
      7,
      'k-4',
    )
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/service-operations/',
      {
        method: 'POST',
        body: {
          condition: 'CREDITO',
          review_digest: 'abc',
          expected_version: 7,
          idempotency_key: 'k-4',
        },
      },
    )
  })

  it('los cobros artesanales van a una sola operación con identidad del hecho', async () => {
    const { client, request } = fakeClient()
    const api = createMaintenanceApi(client)
    await api.registerArtisanPayment(
      9,
      [{ method: 'EFECTIVO', amount: '10.00' }],
      'uuid-1',
      'k-5',
    )
    expect(request).toHaveBeenLastCalledWith(
      '/service-operations/9/payments/',
      {
        method: 'POST',
        body: {
          operation_id: 'uuid-1',
          parts: [{ method: 'EFECTIVO', amount: '10.00' }],
          idempotency_key: 'k-5',
        },
      },
    )
    await api.correctArtisanPayment(9, 2, { reason: 'Error' }, 'uuid-2', 'k-6')
    expect(request).toHaveBeenLastCalledWith(
      '/service-operations/9/payments/2/corrections/',
      {
        method: 'POST',
        body: {
          reason: 'Error',
          operation_id: 'uuid-2',
          idempotency_key: 'k-6',
        },
      },
    )
    await api.voidServiceOperation(9, 'Precio', 1, 'k-7')
    expect(request).toHaveBeenLastCalledWith('/service-operations/9/void/', {
      method: 'POST',
      body: { reason: 'Precio', expected_version: 1, idempotency_key: 'k-7' },
    })
  })

  it('consulta resumen, vista comercial y cuentas por cobrar artesanales', async () => {
    const { client, request } = fakeClient()
    const api = createMaintenanceApi(client)
    await api.economicSummary(3)
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/economic-summary/',
    )
    await api.commercialView(3)
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/commercial-view/',
    )
    await api.artisanReceivables({ customerId: 4, paymentState: 'PARTIAL' })
    expect(request).toHaveBeenLastCalledWith(
      '/service-operations/?customer_id=4&payment_state=PARTIAL',
    )
  })
})

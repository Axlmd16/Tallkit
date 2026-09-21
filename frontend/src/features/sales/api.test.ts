import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createSalesApi } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  return { client: { request } as unknown as ApiClient, request }
}

describe('salesApi', () => {
  it('lista con filtros de cliente, estado, pago y período en snake_case', async () => {
    const { client, request } = fakeClient()
    await createSalesApi(client).list({
      customerId: 3,
      state: 'CONFIRMED',
      paymentState: 'PENDING',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 2,
    })
    expect(request).toHaveBeenCalledWith(
      '/sales/?customer_id=3&state=CONFIRMED&payment_state=PENDING&date_from=2026-01-01&date_to=2026-01-31&page=2',
    )
  })

  it('las cuentas por cobrar filtran por antigüedad', async () => {
    const { client, request } = fakeClient()
    await createSalesApi(client).receivables({ minAgeDays: 10, customerId: 4 })
    expect(request).toHaveBeenCalledWith(
      '/sales/receivables/?customer_id=4&min_age_days=10',
    )
  })

  it('las escrituras llevan la clave y las revisiones de solo lectura no', async () => {
    const { client, request } = fakeClient()
    const api = createSalesApi(client)
    await api.preview(7)
    expect(request).toHaveBeenLastCalledWith('/sales/7/preview/', {
      method: 'POST',
      body: {},
    })
    await api.confirm(7, { expectedVersion: 2, reviewToken: 'tok' }, 'key-1')
    expect(request).toHaveBeenLastCalledWith('/sales/7/confirm/', {
      method: 'POST',
      body: {
        expected_version: 2,
        review_token: 'tok',
        idempotency_key: 'key-1',
      },
    })
    await api.paymentPreview(7, {
      operationId: 'op-1',
      parts: [{ method: 'EFECTIVO', amount: '40.00' }],
    })
    expect(request).toHaveBeenLastCalledWith('/sales/7/payments/preview/', {
      method: 'POST',
      body: {
        operation_id: 'op-1',
        parts: [{ method: 'EFECTIVO', amount: '40.00' }],
      },
    })
  })

  it('el cobro conserva los importes como cadenas y usa el UUID de la operación', async () => {
    const { client, request } = fakeClient()
    await createSalesApi(client).registerPayment(
      7,
      {
        operationId: 'op-1',
        parts: [
          { method: 'EFECTIVO', amount: '40.00' },
          { method: 'TRANSFERENCIA', amount: '60.00' },
        ],
        reviewToken: 'tok',
      },
      'pay-key-1',
    )
    const body = request.mock.calls[0]?.[1].body
    expect(
      body.parts.every(
        (p: { amount: unknown }) => typeof p.amount === 'string',
      ),
    ).toBe(true)
    expect(body).toMatchObject({
      operation_id: 'op-1',
      idempotency_key: 'pay-key-1',
    })
  })

  it('la captura reactiva no lleva clave de idempotencia ni token', async () => {
    const { client, request } = fakeClient()
    await createSalesApi(client).draftPreview({ customer_id: 1, lines: [] })
    const call = request.mock.calls[0]
    expect(call?.[0]).toBe('/sales/draft-preview/')
    expect(call?.[1].body).not.toHaveProperty('idempotency_key')
    expect(call?.[1].method).toBe('POST')
  })

  it('la anulación con dinero envía el desembolso con su UUID y su partes', async () => {
    const { client, request } = fakeClient()
    await createSalesApi(client).void(
      7,
      {
        reason: 'Error',
        expectedVersion: 3,
        reviewToken: 'tok',
        refund: {
          operationId: 'op-r',
          parts: [{ method: 'EFECTIVO', amount: '10.00' }],
        },
      },
      'void-key-1',
    )
    expect(request.mock.calls[0]?.[1].body).toEqual({
      reason: 'Error',
      refund: {
        operation_id: 'op-r',
        parts: [{ method: 'EFECTIVO', amount: '10.00' }],
      },
      expected_version: 3,
      review_token: 'tok',
      idempotency_key: 'void-key-1',
    })
  })

  it('consulta el estado de una operación por UUID y los selectores paginados', async () => {
    const { client, request } = fakeClient()
    const api = createSalesApi(client)
    await api.operation('abc')
    expect(request).toHaveBeenLastCalledWith('/sales/operations/abc/')
    await api.customerOptions('ana', 2)
    expect(request).toHaveBeenLastCalledWith(
      '/sales/customer-options/?search=ana&page=2&page_size=20',
    )
    await api.productOptions('', 1)
    expect(request).toHaveBeenLastCalledWith(
      '/sales/product-options/?page=1&page_size=20',
    )
  })
})

describe('salesApi (resto de rutas)', () => {
  it('lecturas: ficha, comprobante, historial de cobros y cuentas por cobrar', async () => {
    const { client, request } = fakeClient()
    const api = createSalesApi(client)
    await api.get(4)
    expect(request).toHaveBeenLastCalledWith('/sales/4/')
    await api.document(4)
    expect(request).toHaveBeenLastCalledWith('/sales/4/document/')
    await api.payments(4)
    expect(request).toHaveBeenLastCalledWith('/sales/4/payments/')
    await api.receivables({ paymentState: 'PARTIAL', page: 2 })
    expect(request).toHaveBeenLastCalledWith(
      '/sales/receivables/?payment_state=PARTIAL&page=2',
    )
  })

  it('crear y editar llevan la clave; editar además la versión esperada', async () => {
    const { client, request } = fakeClient()
    const api = createSalesApi(client)
    const data = {
      customer_id: 1,
      condition: 'CREDITO' as const,
      notes: '',
      lines: [],
    }
    await api.create(data, 'k1')
    expect(request).toHaveBeenLastCalledWith('/sales/', {
      method: 'POST',
      body: { ...data, idempotency_key: 'k1' },
    })
    await api.update(4, { notes: 'x' }, 3, 'k2')
    expect(request).toHaveBeenLastCalledWith('/sales/4/', {
      method: 'PATCH',
      body: { notes: 'x', expected_version: 3, idempotency_key: 'k2' },
    })
  })

  it('correcciones, devoluciones y reembolsos usan operation_id y conservan las partes', async () => {
    const { client, request } = fakeClient()
    const api = createSalesApi(client)
    const parts = [{ method: 'EFECTIVO' as const, amount: '5.00' }]
    await api.correctionPreview(4, 9, {
      operationId: 'c1',
      reason: 'Error',
      replacement: { operationId: 'r1', parts },
    })
    expect(request).toHaveBeenLastCalledWith(
      '/sales/4/payments/9/correction-preview/',
      {
        method: 'POST',
        body: {
          operation_id: 'c1',
          reason: 'Error',
          replacement: { operation_id: 'r1', parts },
        },
      },
    )
    await api.correctPayment(
      4,
      9,
      {
        operationId: 'c1',
        reason: 'Error',
        reviewToken: 't',
        replacement: null,
      },
      'k',
    )
    expect(request.mock.calls.at(-1)?.[1].body).toEqual({
      operation_id: 'c1',
      reason: 'Error',
      review_token: 't',
      idempotency_key: 'k',
    })
    await api.returnPreview(4, {
      operationId: 'x1',
      reason: 'R',
      lines: [{ sale_line_id: 1, fit_quantity: '1', unfit_quantity: '0' }],
    })
    expect(request.mock.calls.at(-1)?.[0]).toBe('/sales/4/returns/preview/')
    await api.registerReturn(
      4,
      { operationId: 'x1', reason: 'R', lines: [], reviewToken: 't' },
      'k',
    )
    expect(request.mock.calls.at(-1)?.[1].body).toMatchObject({
      operation_id: 'x1',
      review_token: 't',
      idempotency_key: 'k',
    })
    await api.refundPreview(4, {
      operationId: 'f1',
      saleReturnId: 2,
      reason: 'R',
      parts,
    })
    expect(request.mock.calls.at(-1)?.[1].body).toMatchObject({
      sale_return_id: 2,
    })
    await api.registerRefund(
      4,
      {
        operationId: 'f1',
        saleReturnId: 2,
        reason: 'R',
        parts,
        reviewToken: 't',
      },
      'k',
    )
    expect(request.mock.calls.at(-1)?.[0]).toBe('/sales/4/refunds/')
    await api.voidPreview(4, { reason: 'x', refund: null })
    expect(request.mock.calls.at(-1)?.[1].body).toEqual({ reason: 'x' })
  })
})

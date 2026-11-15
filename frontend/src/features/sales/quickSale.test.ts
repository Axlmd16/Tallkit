import { describe, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

import { runQuickSale, type QuickSaleSteps } from './quickSale'

const draft = { id: 31, version: 1, state: 'DRAFT', internal_number: null }
const confirmed = {
  id: 31,
  version: 2,
  state: 'CONFIRMED',
  internal_number: 'COM-VEN-000031',
  money: { balance: '46.00' },
}

function steps(overrides: Partial<QuickSaleSteps> = {}): QuickSaleSteps {
  let key = 0
  return {
    create: vi.fn().mockResolvedValue(draft),
    preview: vi.fn().mockResolvedValue({
      can_confirm: true,
      review_token: 'r1',
      issues: [],
    }),
    confirm: vi.fn().mockResolvedValue(confirmed),
    paymentPreview: vi.fn().mockResolvedValue({
      review_token: 'p1',
      issues: [],
    }),
    registerPayment: vi.fn().mockResolvedValue({ id: 5 }),
    operationId: vi.fn().mockReturnValue('op-31'),
    settled: vi.fn(),
    newKey: () => `k${++key}`,
    ...overrides,
  } as unknown as QuickSaleSteps
}

const input = {
  customerId: 3,
  lines: [{ product_id: 7, quantity: '2' }],
}

describe('venta rápida al contado', () => {
  it('crea, confirma y cobra el saldo que calcula el servidor con la forma de pago elegida', async () => {
    const s = steps()
    const result = await runQuickSale(s, { ...input, method: 'EFECTIVO' })

    expect(s.create).toHaveBeenCalledWith(
      { customer_id: 3, condition: 'CONTADO', notes: '', lines: input.lines },
      'k1',
    )
    expect(s.confirm).toHaveBeenCalledWith({
      id: 31,
      expectedVersion: 1,
      reviewToken: 'r1',
      key: 'k2',
    })
    expect(s.paymentPreview).toHaveBeenCalledWith(31, {
      operationId: 'op-31',
      parts: [{ method: 'EFECTIVO', amount: '46.00' }],
    })
    expect(s.registerPayment).toHaveBeenCalledWith({
      id: 31,
      operationId: 'op-31',
      parts: [{ method: 'EFECTIVO', amount: '46.00' }],
      reviewToken: 'p1',
      key: 'k3',
    })
    expect(s.settled).toHaveBeenCalledWith(31)
    expect(result).toEqual({ status: 'paid', sale: confirmed })
  })

  it('por transferencia usa ese medio', async () => {
    const s = steps()
    await runQuickSale(s, { ...input, method: 'TRANSFERENCIA' })
    expect(s.registerPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        parts: [{ method: 'TRANSFERENCIA', amount: '46.00' }],
      }),
    )
  })
})

describe('venta rápida a crédito', () => {
  it('«Queda debiendo» confirma a crédito y no registra ningún cobro', async () => {
    const s = steps()
    const result = await runQuickSale(s, { ...input, method: 'CREDITO' })
    expect(s.create).toHaveBeenCalledWith(
      expect.objectContaining({ condition: 'CREDITO' }),
      'k1',
    )
    expect(s.confirm).toHaveBeenCalled()
    expect(s.paymentPreview).not.toHaveBeenCalled()
    expect(s.registerPayment).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'credit', sale: confirmed })
  })
})

describe('cuando algo no se completa', () => {
  it('si la revisión no habilita confirmar, la venta queda en borrador y se dice por qué', async () => {
    const s = steps({
      preview: vi.fn().mockResolvedValue({
        can_confirm: false,
        review_token: null,
        issues: [{ code: 'stock', field: 'lines', message: 'Sin existencia.' }],
      }),
    })
    const result = await runQuickSale(s, { ...input, method: 'EFECTIVO' })
    expect(s.confirm).not.toHaveBeenCalled()
    expect(s.registerPayment).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'draft',
      sale: draft,
      message: 'Sin existencia.',
    })
  })

  it('si falla la confirmación, la venta queda en borrador con el motivo del servidor', async () => {
    const s = steps({
      confirm: vi
        .fn()
        .mockRejectedValue(
          new ProblemError('La revisión venció.', 409, 'review_required'),
        ),
    })
    const result = await runQuickSale(s, { ...input, method: 'EFECTIVO' })
    expect(result.status).toBe('draft')
    expect(s.paymentPreview).not.toHaveBeenCalled()
  })

  it('si el cobro no pasa la revisión, la venta queda confirmada sin cobro y se avisa', async () => {
    const s = steps({
      paymentPreview: vi.fn().mockResolvedValue({
        review_token: null,
        issues: [
          {
            code: 'x',
            field: 'parts',
            message: 'El cliente retiene impuestos.',
          },
        ],
      }),
    })
    const result = await runQuickSale(s, { ...input, method: 'EFECTIVO' })
    expect(s.registerPayment).not.toHaveBeenCalled()
    expect(s.settled).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'unpaid',
      sale: confirmed,
      message: 'El cliente retiene impuestos.',
    })
  })

  it('si falla el registro del cobro, la venta queda confirmada sin cobro y conserva la intención', async () => {
    const s = steps({
      registerPayment: vi
        .fn()
        .mockRejectedValue(new ProblemError('Sin conexión.', 0, 'network')),
    })
    const result = await runQuickSale(s, { ...input, method: 'EFECTIVO' })
    expect(result.status).toBe('unpaid')
    expect(result.sale).toBe(confirmed)
    // La intención de cobro no se borra: un reintento desde la venta usa el mismo UUID.
    expect(s.settled).not.toHaveBeenCalled()
  })

  it('si no se pudo crear, no confirma ni cobra y deja pasar el error', async () => {
    const s = steps({
      create: vi.fn().mockRejectedValue(new Error('caído')),
    })
    await expect(
      runQuickSale(s, { ...input, method: 'EFECTIVO' }),
    ).rejects.toThrow('caído')
    expect(s.confirm).not.toHaveBeenCalled()
  })

  it('una venta confirmada sin saldo no registra un cobro de cero', async () => {
    const s = steps({
      confirm: vi
        .fn()
        .mockResolvedValue({ ...confirmed, money: { balance: '0.00' } }),
    })
    const result = await runQuickSale(s, { ...input, method: 'EFECTIVO' })
    expect(s.registerPayment).not.toHaveBeenCalled()
    expect(result.status).toBe('paid')
  })
})

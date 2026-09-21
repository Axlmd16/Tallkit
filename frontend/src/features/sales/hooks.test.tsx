import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  confirm: vi.fn(),
  registerPayment: vi.fn(),
  correctPayment: vi.fn(),
  registerReturn: vi.fn(),
  registerRefund: vi.fn(),
  void: vi.fn(),
  preview: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  receivables: vi.fn(),
  operation: vi.fn(),
  document: vi.fn(),
  customerOptions: vi.fn(),
  productOptions: vi.fn(),
}))
vi.mock('./api', () => ({ salesApi: api }))

import {
  saleKeys,
  useCustomerOptions,
  useOperationStatus,
  useProductOptions,
  useReceivables,
  useSale,
  useSaleDocument,
  useSaleMutations,
  useSales,
} from './hooks'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

let client: QueryClient
beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

describe('consultas', () => {
  it('lista y ficha usan claves propias por filtro e ID', async () => {
    api.list.mockResolvedValue({ count: 0, results: [] })
    api.get.mockResolvedValue({ id: 5 })
    const list = renderHook(() => useSales({ state: 'DRAFT' }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const detail = renderHook(() => useSale(5), { wrapper: wrapper(client) })
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true))
    expect(client.getQueryData(saleKeys.list({ state: 'DRAFT' }))).toBeDefined()
    expect(client.getQueryData(saleKeys.detail(5))).toEqual({ id: 5 })
  })

  it('la consulta de estado por UUID no reintenta y solo corre con un UUID', async () => {
    api.operation.mockRejectedValue(new Error('404'))
    const idle = renderHook(() => useOperationStatus(null), {
      wrapper: wrapper(client),
    })
    expect(idle.result.current.fetchStatus).toBe('idle')
    const active = renderHook(() => useOperationStatus('abc'), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(active.result.current.isError).toBe(true))
    expect(api.operation).toHaveBeenCalledTimes(1)
  })
})

describe('mutaciones', () => {
  it('confirmar invalida ventas e inventario y elimina los cortes de Kardex', async () => {
    api.confirm.mockResolvedValue({ id: 1 })
    client.setQueryData(['inventory', 'kardex', 9], { rows: [] })
    client.setQueryData(['inventory', 'stock'], { rows: [] })
    client.setQueryData(saleKeys.detail(1), { id: 1 })
    const { result } = renderHook(() => useSaleMutations(), {
      wrapper: wrapper(client),
    })
    await act(() =>
      result.current.confirm.mutateAsync({
        id: 1,
        expectedVersion: 1,
        reviewToken: 't',
        key: 'k',
      }),
    )
    expect(client.getQueryData(['inventory', 'kardex', 9])).toBeUndefined()
    expect(client.getQueryState(['inventory', 'stock'])?.isInvalidated).toBe(
      true,
    )
    expect(client.getQueryState(saleKeys.detail(1))?.isInvalidated).toBe(true)
  })

  it('un cobro invalida ventas, listas y cuentas por cobrar sin tocar inventario', async () => {
    api.registerPayment.mockResolvedValue({ id: 3 })
    client.setQueryData(['inventory', 'kardex', 9], { rows: [] })
    client.setQueryData(saleKeys.receivables({}), { results: [] })
    client.setQueryData(saleKeys.list({}), { results: [] })
    const { result } = renderHook(() => useSaleMutations(), {
      wrapper: wrapper(client),
    })
    await act(() =>
      result.current.registerPayment.mutateAsync({
        id: 1,
        operationId: 'op',
        parts: [{ method: 'EFECTIVO', amount: '5.00' }],
        reviewToken: 't',
        key: 'k',
      }),
    )
    expect(client.getQueryState(saleKeys.receivables({}))?.isInvalidated).toBe(
      true,
    )
    expect(client.getQueryState(saleKeys.list({}))?.isInvalidated).toBe(true)
    expect(client.getQueryData(['inventory', 'kardex', 9])).toBeDefined()
  })

  it('devolver y anular son cambios físicos: eliminan cortes de Kardex', async () => {
    api.registerReturn.mockResolvedValue({ id: 1 })
    api.void.mockResolvedValue({ id: 1 })
    const { result } = renderHook(() => useSaleMutations(), {
      wrapper: wrapper(client),
    })
    client.setQueryData(['inventory', 'kardex', 1], {})
    await act(() =>
      result.current.registerReturn.mutateAsync({
        id: 1,
        operationId: 'op',
        reason: 'x',
        lines: [],
        reviewToken: 't',
        key: 'k',
      }),
    )
    expect(client.getQueryData(['inventory', 'kardex', 1])).toBeUndefined()
    client.setQueryData(['inventory', 'kardex', 2], {})
    await act(() =>
      result.current.void.mutateAsync({
        id: 1,
        reason: 'x',
        expectedVersion: 1,
        reviewToken: 't',
        key: 'k',
      }),
    )
    expect(client.getQueryData(['inventory', 'kardex', 2])).toBeUndefined()
  })

  it('no reintenta por sí solas ante un fallo', async () => {
    api.registerPayment.mockRejectedValue(new Error('sin respuesta'))
    const { result } = renderHook(() => useSaleMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.registerPayment
        .mutateAsync({
          id: 1,
          operationId: 'op',
          parts: [],
          reviewToken: 't',
          key: 'k',
        })
        .catch(() => undefined)
    })
    expect(api.registerPayment).toHaveBeenCalledTimes(1)
  })
})

describe('consultas y mutaciones restantes', () => {
  it('cuentas por cobrar, comprobante y selectores usan sus rutas del cliente', async () => {
    api.receivables.mockResolvedValue({ results: [] })
    api.document.mockResolvedValue({ number: 'X' })
    api.customerOptions.mockResolvedValue({ results: [] })
    api.productOptions.mockResolvedValue({ results: [] })
    const wrap = { wrapper: wrapper(client) }
    const a = renderHook(() => useReceivables({ minAgeDays: 3 }), wrap)
    const b = renderHook(() => useSaleDocument(4), wrap)
    const c = renderHook(() => useCustomerOptions('ana', 1), wrap)
    const d = renderHook(() => useProductOptions('ace', 1), wrap)
    await waitFor(() => {
      expect(a.result.current.isSuccess).toBe(true)
      expect(b.result.current.isSuccess).toBe(true)
      expect(c.result.current.isSuccess).toBe(true)
      expect(d.result.current.isSuccess).toBe(true)
    })
    expect(api.receivables).toHaveBeenCalledWith({ minAgeDays: 3 })
    expect(api.customerOptions).toHaveBeenCalledWith('ana', 1)
    expect(api.productOptions).toHaveBeenCalledWith('ace', 1)
  })

  it('crear, editar, corregir, reembolsar y revisar delegan en la API con su clave', async () => {
    api.create.mockResolvedValue({ id: 1 })
    api.update.mockResolvedValue({ id: 1 })
    api.correctPayment.mockResolvedValue({ id: 1 })
    api.registerRefund.mockResolvedValue({ id: 1 })
    api.preview.mockResolvedValue({ can_confirm: true })
    const { result } = renderHook(() => useSaleMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.create.mutateAsync({
        data: { customer_id: 1, condition: 'CREDITO', notes: '', lines: [] },
        key: 'k1',
      })
      await result.current.update.mutateAsync({
        id: 1,
        data: {},
        expectedVersion: 2,
        key: 'k2',
      })
      await result.current.correctPayment.mutateAsync({
        id: 1,
        paymentId: 9,
        operationId: 'op',
        reason: 'x',
        reviewToken: 't',
        key: 'k3',
      })
      await result.current.registerRefund.mutateAsync({
        id: 1,
        operationId: 'op',
        saleReturnId: 2,
        reason: 'x',
        parts: [],
        reviewToken: 't',
        key: 'k4',
      })
      await result.current.preview.mutateAsync(1)
    })
    expect(api.create).toHaveBeenCalledWith(expect.anything(), 'k1')
    expect(api.update).toHaveBeenCalledWith(1, {}, 2, 'k2')
    expect(api.correctPayment.mock.calls[0]?.[0]).toBe(1)
    expect(api.correctPayment.mock.calls[0]?.[1]).toBe(9)
    expect(api.registerRefund).toHaveBeenCalled()
    expect(api.preview).toHaveBeenCalledWith(1)
  })
})

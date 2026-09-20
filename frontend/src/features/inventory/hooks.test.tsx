import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  stock: vi.fn(),
  item: vi.fn(),
  kardex: vi.fn(),
  operation: vi.fn(),
  create: vi.fn(),
  confirm: vi.fn(),
  reverse: vi.fn(),
  preview: vi.fn(),
  reversePreview: vi.fn(),
}))
vi.mock('./api', () => ({ inventoryApi: api }))
vi.mock('@/features/purchases/api', () => ({ purchasesApi: {} }))

import {
  useKardex,
  useOperation,
  useOperationMutations,
  useStock,
  useStockItem,
} from './hooks'

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

describe('consultas de inventario', () => {
  it('leen existencias, ficha, operación y Kardex con sus filtros', async () => {
    api.stock.mockResolvedValue({ results: [] })
    api.item.mockResolvedValue({ quantity: '3' })
    api.operation.mockResolvedValue({ id: 4 })
    api.kardex.mockResolvedValue({ cut: { token: 't' } })
    const stock = renderHook(() => useStock({ search: 'a' }), { wrapper })
    const item = renderHook(() => useStockItem(7), { wrapper })
    const operation = renderHook(() => useOperation(4), { wrapper })
    const kardex = renderHook(() => useKardex(7, { cutToken: 'corte' }), {
      wrapper,
    })
    await waitFor(() => expect(kardex.result.current.isSuccess).toBe(true))
    expect(api.stock).toHaveBeenCalledWith({ search: 'a' })
    expect(api.item).toHaveBeenCalledWith(7)
    expect(api.operation).toHaveBeenCalledWith(4)
    expect(api.kardex).toHaveBeenCalledWith(7, { cutToken: 'corte' })
    expect(
      stock.result.current.isSuccess ||
        item.result.current.isSuccess ||
        operation.result.current.isSuccess,
    ).toBe(true)
  })

  it('no consultan sin identificador ni sin permiso', () => {
    renderHook(() => useStockItem(null), { wrapper })
    renderHook(() => useStockItem(7, false), { wrapper })
    renderHook(() => useOperation(null), { wrapper })
    renderHook(() => useKardex(null, {}), { wrapper })
    expect(api.item).not.toHaveBeenCalled()
    expect(api.operation).not.toHaveBeenCalled()
    expect(api.kardex).not.toHaveBeenCalled()
  })
})

describe('mutaciones de operaciones', () => {
  it('crean, confirman y revierten con clave, versión y token', async () => {
    api.create.mockResolvedValue({ id: 1 })
    api.confirm.mockResolvedValue({ id: 1 })
    api.reverse.mockResolvedValue({ id: 1 })
    api.preview.mockResolvedValue({ review_token: 't' })
    api.reversePreview.mockResolvedValue({ review_token: 'r' })
    const { result } = renderHook(() => useOperationMutations(), { wrapper })
    await act(async () => {
      await result.current.create.mutateAsync({
        data: {
          kind: 'ADJUSTMENT_OUT',
          product_id: 1,
          quantity: '1',
          reason: 'x',
        },
        key: 'k1',
      })
      await result.current.preview.mutateAsync(1)
      await result.current.confirm.mutateAsync({
        id: 1,
        expectedVersion: 1,
        reviewToken: 't',
        key: 'k2',
      })
      await result.current.reversePreview.mutateAsync(1)
      await result.current.reverse.mutateAsync({
        id: 1,
        expectedVersion: 2,
        reviewToken: 'r',
        reason: 'Error',
        key: 'k3',
      })
    })
    expect(api.confirm).toHaveBeenCalledWith(
      1,
      { expectedVersion: 1, reviewToken: 't' },
      'k2',
    )
    expect(api.reverse).toHaveBeenCalledWith(
      1,
      { expectedVersion: 2, reviewToken: 'r', reason: 'Error' },
      'k3',
    )
  })

  it('no reintentan tras un fallo: el llamador reenvía con la misma clave', async () => {
    api.confirm.mockRejectedValue(new Error('timeout'))
    const { result } = renderHook(() => useOperationMutations(), { wrapper })
    await act(async () => {
      await result.current.confirm
        .mutateAsync({ id: 1, expectedVersion: 1, reviewToken: 't', key: 'k' })
        .catch(() => undefined)
    })
    expect(api.confirm).toHaveBeenCalledTimes(1)
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  registerEntry: vi.fn(),
  reviewEntry: vi.fn(),
  void: vi.fn(),
  voidPreview: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  supplierOptions: vi.fn(),
}))
vi.mock('./api', () => ({ purchasesApi: api }))
vi.mock('@/features/inventory/api', () => ({ inventoryApi: {} }))

import { usePurchase, usePurchaseMutations, usePurchases } from './hooks'

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

describe('usePurchaseMutations', () => {
  it('tras registrar una entrada invalida compras e inventario y descarta los Kardex', async () => {
    client.setQueryData(['inventory', 'kardex', 9, {}], {
      cut: { token: 'viejo' },
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    api.registerEntry.mockResolvedValue({ id: 1 })
    const { result } = renderHook(() => usePurchaseMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.register.mutateAsync({
        input: { lines: [{ product_id: 1, quantity: '2' }] },
        key: 'k1',
      })
    })
    expect(api.registerEntry).toHaveBeenCalledWith(
      { lines: [{ product_id: 1, quantity: '2' }] },
      'k1',
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventory'] })
    expect(client.getQueryData(['inventory', 'kardex', 9, {}])).toBeUndefined()
  })

  it('la revisión es de solo lectura: no invalida nada', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    api.reviewEntry.mockResolvedValue({ can_confirm: true })
    const { result } = renderHook(() => usePurchaseMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.review.mutateAsync({ lines: [] })
    })
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('las mutaciones nunca reintentan por sí solas', async () => {
    api.registerEntry.mockRejectedValue(new Error('red'))
    const { result } = renderHook(() => usePurchaseMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.register
        .mutateAsync({ input: { lines: [] }, key: 'k' })
        .catch(() => undefined)
    })
    expect(api.registerEntry).toHaveBeenCalledTimes(1)
  })
})

describe('lecturas', () => {
  it('lista y detalle consultan al servidor y el detalle espera un identificador', async () => {
    api.list.mockResolvedValue({ results: [] })
    api.get.mockResolvedValue({ id: 5 })
    const list = renderHook(() => usePurchases({ page: 2 }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    expect(api.list).toHaveBeenCalledWith({ page: 2 })
    const none = renderHook(() => usePurchase(null), {
      wrapper: wrapper(client),
    })
    expect(none.result.current.fetchStatus).toBe('idle')
    const one = renderHook(() => usePurchase(5), { wrapper: wrapper(client) })
    await waitFor(() => expect(one.result.current.isSuccess).toBe(true))
    expect(api.get).toHaveBeenCalledWith(5)
  })
})

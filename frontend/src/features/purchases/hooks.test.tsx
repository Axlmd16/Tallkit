import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  confirm: vi.fn(),
  void: vi.fn(),
  replacement: vi.fn(),
  preview: vi.fn(),
  voidPreview: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  taxOptions: vi.fn(),
}))
vi.mock('./api', () => ({ purchasesApi: api }))
vi.mock('@/features/inventory/api', () => ({ inventoryApi: {} }))

import {
  usePurchase,
  usePurchaseMutations,
  usePurchases,
  usePurchaseTaxOptions,
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

describe('usePurchaseMutations', () => {
  it('tras una mutación propia invalida compras e inventario y descarta los Kardex', async () => {
    client.setQueryData(['inventory', 'kardex', 9, {}], {
      cut: { token: 'viejo' },
    })
    client.setQueryData(['purchases', 'list', {}], { results: [] })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    api.create.mockResolvedValue({ id: 1 })
    const { result } = renderHook(() => usePurchaseMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.create.mutateAsync({
        data: {} as never,
        key: 'k1',
      })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventory'] })
    expect(client.getQueryData(['inventory', 'kardex', 9, {}])).toBeUndefined()
  })

  it('no reintenta por sí sola y conserva clave y payload al reenviar tras un timeout', async () => {
    api.confirm
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ id: 3, state: 'CONFIRMED' })
    const { result } = renderHook(() => usePurchaseMutations(), {
      wrapper: wrapper(client),
    })
    const payload = {
      id: 3,
      expectedVersion: 1,
      reviewToken: 'tok',
      key: 'misma-clave',
    }
    await act(async () => {
      await result.current.confirm.mutateAsync(payload).catch(() => undefined)
    })
    expect(api.confirm).toHaveBeenCalledTimes(1)
    await act(async () => {
      await result.current.confirm.mutateAsync(payload)
    })
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(2))
    expect(api.confirm.mock.calls[1]).toEqual(api.confirm.mock.calls[0])
  })
})

describe('consultas de compras', () => {
  it('leen la lista, el detalle y las opciones tributarias por fecha documental', async () => {
    api.list.mockResolvedValue({ results: [] })
    api.get.mockResolvedValue({ id: 3 })
    api.taxOptions.mockResolvedValue({ results: [] })
    const list = renderHook(() => usePurchases({ state: 'DRAFT' }), {
      wrapper: wrapper(client),
    })
    const detail = renderHook(() => usePurchase(3), {
      wrapper: wrapper(client),
    })
    const taxes = renderHook(() => usePurchaseTaxOptions('2026-01-15', 'iva'), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(taxes.result.current.isSuccess).toBe(true))
    expect(api.list).toHaveBeenCalledWith({ state: 'DRAFT' })
    expect(api.get).toHaveBeenCalledWith(3)
    expect(api.taxOptions).toHaveBeenCalledWith('2026-01-15', 'iva')
    expect(list.result.current.isPending || list.result.current.isSuccess).toBe(
      true,
    )
    expect(
      detail.result.current.isPending || detail.result.current.isSuccess,
    ).toBe(true)
  })

  it('no consultan sin identificador ni fecha', () => {
    renderHook(() => usePurchase(null), { wrapper: wrapper(client) })
    renderHook(() => usePurchaseTaxOptions(null), { wrapper: wrapper(client) })
    expect(api.get).not.toHaveBeenCalled()
    expect(api.taxOptions).not.toHaveBeenCalled()
  })
})

describe('demás mutaciones de compras', () => {
  it('editan, anulan, reemplazan y revisan con sus contratos', async () => {
    api.update.mockResolvedValue({ id: 1 })
    api.void.mockResolvedValue({ id: 1 })
    api.replacement.mockResolvedValue({ id: 2 })
    api.preview.mockResolvedValue({})
    api.voidPreview.mockResolvedValue({})
    const { result } = renderHook(() => usePurchaseMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.update.mutateAsync({
        id: 1,
        data: { notes: 'x' },
        expectedVersion: 2,
        key: 'k1',
      })
      await result.current.void.mutateAsync({
        id: 1,
        expectedVersion: 3,
        reviewToken: 't',
        reason: 'Error',
        key: 'k2',
      })
      await result.current.replacement.mutateAsync({ id: 1, key: 'k3' })
      await result.current.preview.mutateAsync(1)
      await result.current.voidPreview.mutateAsync(1)
    })
    expect(api.update).toHaveBeenCalledWith(1, { notes: 'x' }, 2, 'k1')
    expect(api.void).toHaveBeenCalledWith(
      1,
      { expectedVersion: 3, reviewToken: 't', reason: 'Error' },
      'k2',
    )
    expect(api.replacement).toHaveBeenCalledWith(1, 'k3')
  })
})

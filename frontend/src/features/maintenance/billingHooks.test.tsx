import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  addPart: vi.fn(),
  pay: vi.fn(),
  registerArtisanPayment: vi.fn(),
  partProductOptions: vi.fn(),
}))
vi.mock('./api', () => ({ maintenanceApi: api }))

import {
  billingKeys,
  useBillingMutations,
  usePartProductPicker,
} from './billingHooks'
import { maintenanceKeys } from './hooks'

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

describe('billing hooks', () => {
  it('agregar un repuesto guarda la orden e invalida ventas e inventario', async () => {
    const order = { id: 3, version: 2 }
    api.addPart.mockResolvedValue(order)
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useBillingMutations(), {
      wrapper: wrapper(client),
    })
    await act(() =>
      result.current.addPart.mutateAsync({
        id: 3,
        productId: 7,
        quantity: '1',
        expectedVersion: 1,
        key: 'k-1',
      }),
    )
    expect(api.addPart).toHaveBeenCalledWith(
      3,
      { product_id: 7, quantity: '1' },
      1,
      'k-1',
    )
    expect(client.getQueryData(maintenanceKeys.detail(3))).toEqual(order)
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey?.[0])
    expect(keys).toEqual(
      expect.arrayContaining(['maintenance', 'sales', 'inventory']),
    )
  })

  it('un cobro artesanal no se reintenta solo y guarda la operación', async () => {
    api.registerArtisanPayment.mockResolvedValue({ id: 9, balance: '0.00' })
    const { result } = renderHook(() => useBillingMutations(), {
      wrapper: wrapper(client),
    })
    await act(() =>
      result.current.pay.mutateAsync({
        id: 9,
        parts: [{ method: 'EFECTIVO', amount: '10.00' }],
        factId: 'uuid',
        key: 'k-2',
      }),
    )
    expect(api.registerArtisanPayment).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(billingKeys.operation(9))).toEqual({
      id: 9,
      balance: '0.00',
    })
  })

  it('las opciones de repuestos muestran existencia, reservado y disponible', async () => {
    api.partProductOptions.mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [
        {
          id: 1,
          code: 'FO-100',
          name: 'Filtro',
          sale_price: '11.50',
          quantity: '5',
          reserved: '2',
          available: '3',
        },
      ],
    })
    const { result } = renderHook(() => usePartProductPicker(3, 'fo', 1), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.options[0]?.detail).toContain('disponible 3')
  })
})

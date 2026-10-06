import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  pendingWithholdings: vi.fn(),
  completeVoucher: vi.fn(),
  correctVoucher: vi.fn(),
  voidWithholding: vi.fn(),
  registerPayment: vi.fn(),
}))
vi.mock('./api', () => ({ salesApi: api }))

import { saleKeys, usePendingWithholdings, useSaleMutations } from './hooks'

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

it('consulta los pendientes por página y cliente, y no consulta si está deshabilitada', async () => {
  api.pendingWithholdings.mockResolvedValue({ items: [], total_count: 0 })
  const all = renderHook(() => usePendingWithholdings(2), { wrapper })
  await waitFor(() => expect(all.result.current.isSuccess).toBe(true))
  expect(api.pendingWithholdings).toHaveBeenLastCalledWith({ page: 2 })

  const filtered = renderHook(() => usePendingWithholdings(1, true, 9), {
    wrapper,
  })
  await waitFor(() => expect(filtered.result.current.isSuccess).toBe(true))
  expect(api.pendingWithholdings).toHaveBeenLastCalledWith({
    page: 1,
    customerId: 9,
  })
  expect(saleKeys.pendingWithholdings(1, 9)).not.toEqual(
    saleKeys.pendingWithholdings(1),
  )

  api.pendingWithholdings.mockClear()
  renderHook(() => usePendingWithholdings(1, false), { wrapper })
  expect(api.pendingWithholdings).not.toHaveBeenCalled()
})

it('completar, corregir y anular envían sus datos e invalidan las ventas', async () => {
  api.completeVoucher.mockResolvedValue({ id: 3 })
  api.correctVoucher.mockResolvedValue({ id: 3 })
  api.voidWithholding.mockResolvedValue({ id: 3 })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useSaleMutations(), { wrapper })
  const voucher = {
    voucherNumber: '001-001-000028564',
    voucherDate: '2026-10-05',
  }

  await act(() =>
    result.current.completeVoucher.mutateAsync({
      ...voucher,
      id: 7,
      withholdingId: 3,
      key: 'k1',
    }),
  )
  expect(api.completeVoucher).toHaveBeenCalledWith(
    7,
    3,
    expect.objectContaining(voucher),
    'k1',
  )

  await act(() =>
    result.current.correctVoucher.mutateAsync({
      ...voucher,
      operationId: 'op',
      reason: 'Error',
      id: 7,
      withholdingId: 3,
      key: 'k2',
    }),
  )
  expect(api.correctVoucher).toHaveBeenCalledWith(
    7,
    3,
    expect.objectContaining({ operationId: 'op', reason: 'Error' }),
    'k2',
  )

  await act(() =>
    result.current.voidWithholding.mutateAsync({
      id: 7,
      withholdingId: 3,
      reason: 'Registrada por error',
      key: 'k3',
    }),
  )
  expect(api.voidWithholding).toHaveBeenCalledWith(
    7,
    3,
    { reason: 'Registrada por error' },
    'k3',
  )
  expect(invalidate).toHaveBeenCalledWith({ queryKey: saleKeys.root })
  expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(3)
})

it('el cobro con retención conserva el importe retenido al llegar a la API', async () => {
  api.registerPayment.mockResolvedValue({ id: 1 })
  const { result } = renderHook(() => useSaleMutations(), { wrapper })
  await act(() =>
    result.current.registerPayment.mutateAsync({
      id: 7,
      operationId: 'op',
      parts: [],
      withholding: { amount: '5.00' },
      reviewToken: 'tok',
      key: 'k',
    }),
  )
  expect(api.registerPayment).toHaveBeenCalledWith(
    7,
    expect.objectContaining({ withholding: { amount: '5.00' }, parts: [] }),
    'k',
  )
})

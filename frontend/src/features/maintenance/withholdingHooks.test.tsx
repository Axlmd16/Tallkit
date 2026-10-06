import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  pendingArtisanWithholdings: vi.fn(),
  registerArtisanPayment: vi.fn(),
  completeArtisanVoucher: vi.fn(),
  correctArtisanVoucher: vi.fn(),
  voidArtisanWithholding: vi.fn(),
}))
vi.mock('./api', () => ({ maintenanceApi: api }))

import {
  billingKeys,
  useBillingMutations,
  usePendingArtisanWithholdings,
} from './billingHooks'

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)
const operation = { id: 4, order_id: 9, balance: '0.00' }

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

it('consulta los pendientes artesanales por página y cliente', async () => {
  api.pendingArtisanWithholdings.mockResolvedValue({ items: [] })
  const all = renderHook(() => usePendingArtisanWithholdings(3), { wrapper })
  await waitFor(() => expect(all.result.current.isSuccess).toBe(true))
  expect(api.pendingArtisanWithholdings).toHaveBeenLastCalledWith({ page: 3 })

  const filtered = renderHook(() => usePendingArtisanWithholdings(1, true, 5), {
    wrapper,
  })
  await waitFor(() => expect(filtered.result.current.isSuccess).toBe(true))
  expect(api.pendingArtisanWithholdings).toHaveBeenLastCalledWith({
    page: 1,
    customerId: 5,
  })

  api.pendingArtisanWithholdings.mockClear()
  renderHook(() => usePendingArtisanWithholdings(1, false), { wrapper })
  expect(api.pendingArtisanWithholdings).not.toHaveBeenCalled()
})

it('cobro con retención, comprobante, corrección y anulación actualizan la operación', async () => {
  for (const call of [
    api.registerArtisanPayment,
    api.completeArtisanVoucher,
    api.correctArtisanVoucher,
    api.voidArtisanWithholding,
  ])
    call.mockResolvedValue(operation)
  const { result } = renderHook(() => useBillingMutations(), { wrapper })
  const voucher = {
    voucherNumber: '001-001-000028564',
    voucherDate: '2026-10-05',
  }

  await act(() =>
    result.current.pay.mutateAsync({
      id: 4,
      parts: [{ method: 'EFECTIVO', amount: '245.00' }],
      withholding: { amount: '5.00' },
      factId: 'fact',
      key: 'k0',
    }),
  )
  expect(api.registerArtisanPayment).toHaveBeenCalledWith(
    4,
    [{ method: 'EFECTIVO', amount: '245.00' }],
    'fact',
    'k0',
    { amount: '5.00' },
  )
  expect(client.getQueryData(billingKeys.operation(4))).toEqual(operation)

  await act(() =>
    result.current.completeVoucher.mutateAsync({
      ...voucher,
      id: 4,
      withholdingId: 8,
      key: 'k1',
    }),
  )
  expect(api.completeArtisanVoucher).toHaveBeenCalledWith(
    4,
    8,
    expect.objectContaining(voucher),
    'k1',
  )

  await act(() =>
    result.current.correctVoucher.mutateAsync({
      ...voucher,
      operationId: 'op',
      reason: 'Error',
      id: 4,
      withholdingId: 8,
      key: 'k2',
    }),
  )
  expect(api.correctArtisanVoucher).toHaveBeenCalledWith(
    4,
    8,
    expect.objectContaining({ operationId: 'op', reason: 'Error' }),
    'k2',
  )

  await act(() =>
    result.current.voidWithholding.mutateAsync({
      id: 4,
      withholdingId: 8,
      reason: 'Registrada por error',
      key: 'k3',
    }),
  )
  expect(api.voidArtisanWithholding).toHaveBeenCalledWith(
    4,
    8,
    'Registrada por error',
    'k3',
  )
})

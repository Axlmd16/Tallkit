import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

import type { CustomersApi } from './api'
import {
  useCustomer,
  useCustomerMatches,
  useCustomerMutations,
  useCustomers,
} from './hooks'
import type { CustomerSummary, CustomerWrite } from './types'

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const customer: CustomerSummary = {
    id: 1,
    person_type: 'NATURAL',
    identification_type: 'CI',
    identification: '0912345678',
    name: 'Carlos Vera',
    phone: '0991234567',
    email: 'carlos@example.com',
    address: 'Guayaquil',
    is_active: true,
    version: 1,
    created_at: '2026-09-13T00:00:00Z',
    updated_at: '2026-09-13T00:00:00Z',
  }
  const api = {
    list: vi.fn().mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [customer],
    }),
    get: vi.fn().mockResolvedValue(customer),
    create: vi.fn().mockResolvedValue(customer),
    update: vi.fn().mockResolvedValue(customer),
    matches: vi.fn().mockResolvedValue([customer]),
    activate: vi.fn().mockResolvedValue(customer),
    deactivate: vi.fn().mockResolvedValue({ ...customer, is_active: false }),
  } as unknown as CustomersApi
  return { api, client, customer, wrapper }
}

it('loads customers list and individual customer detail', async () => {
  const { api, wrapper } = setup()
  const listHook = renderHook(() => useCustomers({ search: 'Carlos' }, api), {
    wrapper,
  })
  const detailHook = renderHook(() => useCustomer(1, api), { wrapper })

  await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true))
  await waitFor(() => expect(detailHook.result.current.isSuccess).toBe(true))

  expect(api.list).toHaveBeenCalledWith({ search: 'Carlos' })
  expect(api.get).toHaveBeenCalledWith(1)
})

it('queries customer matches when search criteria are provided', async () => {
  const { api, wrapper } = setup()
  const hook = renderHook(
    () =>
      useCustomerMatches({ name: 'Carlos', phone: '0991234567' }, true, api),
    { wrapper },
  )

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  expect(api.matches).toHaveBeenCalledWith({
    name: 'Carlos',
    phone: '0991234567',
  })
})

it('executes customer mutations and manages query invalidation', async () => {
  const { api, client, wrapper } = setup()
  const hook = renderHook(() => useCustomerMutations(api), { wrapper })
  const data: CustomerWrite = {
    person_type: 'NATURAL',
    identification_type: 'CI',
    identification: '0912345678',
    name: 'Carlos Vera',
    phone: '0991234567',
  }

  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  await act(async () => {
    await hook.result.current.create.mutateAsync(data)
    await hook.result.current.update.mutateAsync({ id: 1, data })
    await hook.result.current.activate.mutateAsync({
      id: 1,
      expectedVersion: 1,
    })
    await hook.result.current.deactivate.mutateAsync({
      id: 1,
      expectedVersion: 2,
    })
  })

  expect(api.create).toHaveBeenCalledWith(data)
  expect(api.update).toHaveBeenCalledWith(1, data)
  expect(api.activate).toHaveBeenCalledWith(1, 1)
  expect(api.deactivate).toHaveBeenCalledWith(1, 2)
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ['customer-vehicles', 1],
  })
})

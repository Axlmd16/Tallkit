import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

import type { UsersApi } from './api'
import { useRoles, useUserMutations, useUsers } from './hooks'

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const user = {
    id: 1,
    username: 'ana',
    first_name: '',
    last_name: '',
    email: '',
    is_active: true,
    roles: ['VENDEDOR' as const],
  }
  const api = {
    list: vi.fn().mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [user],
    }),
    roles: vi
      .fn()
      .mockResolvedValue([{ code: 'VENDEDOR', permissions: ['ventas.ver'] }]),
    create: vi.fn().mockResolvedValue(user),
    update: vi.fn().mockResolvedValue(user),
    activate: vi.fn().mockResolvedValue(user),
    deactivate: vi.fn().mockResolvedValue(user),
    resetPassword: vi
      .fn()
      .mockResolvedValue({ temporary_password: 'temporal' }),
  } as unknown as UsersApi
  return { api, wrapper }
}

it('loads filtered users and the fixed role catalog', async () => {
  const { api, wrapper } = setup()
  const users = renderHook(() => useUsers({ role: 'VENDEDOR' }, api), {
    wrapper,
  })
  const roles = renderHook(() => useRoles(api), { wrapper })
  await waitFor(() => expect(users.result.current.isSuccess).toBe(true))
  await waitFor(() => expect(roles.result.current.isSuccess).toBe(true))
  expect(api.list).toHaveBeenCalledWith({ role: 'VENDEDOR' })
  expect(api.roles).toHaveBeenCalled()
})

it('executes every explicit user mutation', async () => {
  const { api, wrapper } = setup()
  const hook = renderHook(() => useUserMutations(api), { wrapper })
  const data = {
    username: 'ana',
    first_name: '',
    last_name: '',
    email: '',
    roles: ['VENDEDOR' as const],
  }

  await act(async () => {
    await hook.result.current.create.mutateAsync(data)
    await hook.result.current.update.mutateAsync({ id: 1, data })
    await hook.result.current.activate.mutateAsync(1)
    await hook.result.current.deactivate.mutateAsync(1)
    await hook.result.current.resetPassword.mutateAsync({
      id: 1,
      operationId: 'op',
    })
  })

  expect(api.create).toHaveBeenCalled()
  expect(api.update).toHaveBeenCalled()
  expect(api.activate).toHaveBeenCalled()
  expect(api.deactivate).toHaveBeenCalled()
  expect(api.resetPassword).toHaveBeenCalled()
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

import { useLogout } from '@/features/auth/hooks'
import type { AuthApi } from '@/features/auth/api'

it('al cerrar sesión se eliminan las cachés con costos, importes y Kardex', async () => {
  const client = new QueryClient()
  client.setQueryData(['purchases', 'detail', 3], {
    totals: { total: '22.00' },
  })
  client.setQueryData(['inventory', 'stock', {}], {
    results: [{ average_cost: '2.00' }],
  })
  client.setQueryData(['inventory', 'kardex', 9, {}], { cut: { token: 't' } })
  const api = {
    logout: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthApi
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useLogout(api), { wrapper })
  await act(async () => {
    await result.current.mutateAsync()
  })
  expect(client.getQueryData(['purchases', 'detail', 3])).toBeUndefined()
  expect(client.getQueryData(['inventory', 'stock', {}])).toBeUndefined()
  expect(client.getQueryData(['inventory', 'kardex', 9, {}])).toBeUndefined()
})

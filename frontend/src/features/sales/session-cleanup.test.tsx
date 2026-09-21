import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { useLogout } from '@/features/auth/hooks'
import { SessionGuard } from '@/features/auth/SessionGuard'
import { anonymousSession } from '@/features/auth/types'

import { saleKeys } from './hooks'
import { getOrCreateIntent, intentKey, peekIntent } from './moneyIntent'

beforeEach(() => window.sessionStorage.clear())

it('cerrar sesión elimina identificadores de dinero y cachés económicas', async () => {
  const client = new QueryClient()
  client.setQueryData(saleKeys.detail(7), {
    id: 7,
    money: { balance: '10.00' },
  })
  const key = intentKey(1, 7, 'payment')
  getOrCreateIntent(key)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const api = { logout: vi.fn().mockResolvedValue(undefined) }
  const { result } = renderHook(() => useLogout(api as never), { wrapper })
  await act(() => result.current.mutateAsync())
  expect(peekIntent(key)).toBeNull()
  expect(client.getQueryData(saleKeys.detail(7))).toBeUndefined()
})

it('una sesión invalidada por el servidor también los elimina', () => {
  const key = intentKey(1, 7, 'refund')
  getOrCreateIntent(key)
  render(
    <MemoryRouter initialEntries={['/sales']}>
      <Routes>
        <Route
          element={
            <SessionGuard
              state={{ status: 'ready', session: anonymousSession }}
            />
          }
          path="/sales"
        />
        <Route element={<p>login</p>} path="/login" />
      </Routes>
    </MemoryRouter>,
  )
  expect(peekIntent(key)).toBeNull()
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { expect, it, vi } from 'vitest'

import type { AuthApi } from './api'
import { sessionQueryKey, useLogin, useLogout } from './hooks'
import { anonymousSession, type Session } from './types'

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

it('stores the authenticated session after login', async () => {
  const session: Session = {
    authenticated: true,
    username: 'ana',
    roles: ['VENDEDOR'],
    permissions: ['ventas.crear'],
    must_change_password: false,
  }
  const api = {
    login: vi.fn().mockResolvedValue(session),
  } as unknown as AuthApi
  const { queryClient, wrapper } = setup()
  const { result } = renderHook(() => useLogin(api), { wrapper })

  await result.current.mutateAsync({ username: 'ana', password: 'secreta' })

  expect(queryClient.getQueryData(sessionQueryKey)).toEqual(session)
})

it('replaces session state after logout', async () => {
  const api = {
    logout: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthApi
  const { queryClient, wrapper } = setup()
  queryClient.setQueryData(sessionQueryKey, { authenticated: true })
  const { result } = renderHook(() => useLogout(api), { wrapper })

  await result.current.mutateAsync()

  expect(queryClient.getQueryData(sessionQueryKey)).toEqual(anonymousSession)
})

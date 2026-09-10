import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

import type { AuditApi } from './api'
import { useAudit } from './hooks'

it('loads audit using the selected filters', async () => {
  const api = {
    list: vi.fn().mockResolvedValue({ results: [] }),
  } as unknown as AuditApi
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const filters = { action: 'user.created', page: 2 }
  const hook = renderHook(() => useAudit(filters, api), { wrapper })

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  expect(api.list).toHaveBeenCalledWith(filters)
})

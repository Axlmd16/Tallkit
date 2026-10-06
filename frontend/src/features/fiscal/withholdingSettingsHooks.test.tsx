import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getWithholdingSettings: vi.fn(),
  saveWithholdingSettings: vi.fn(),
}))
vi.mock('./api', () => ({ fiscalApi: api }))

import { fiscalKeys, useFiscalMutations, useWithholdingSettings } from './hooks'

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

it('consulta los ajustes de la entidad y no consulta sin entidad', async () => {
  api.getWithholdingSettings.mockResolvedValue({ entity_id: 2, version: 0 })
  const query = renderHook(() => useWithholdingSettings(2), { wrapper })
  await waitFor(() => expect(query.result.current.isSuccess).toBe(true))
  expect(api.getWithholdingSettings).toHaveBeenCalledWith(2)

  api.getWithholdingSettings.mockClear()
  renderHook(() => useWithholdingSettings(0), { wrapper })
  expect(api.getWithholdingSettings).not.toHaveBeenCalled()
})

it('guardar invalida la configuración y las pantallas de cobro', async () => {
  api.saveWithholdingSettings.mockResolvedValue({ entity_id: 2, version: 1 })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useFiscalMutations(), { wrapper })
  const data = { expected_version: 0, registration_enabled: false }
  await act(() =>
    result.current.saveWithholdingSettings.mutateAsync({
      entityId: 2,
      data,
      attemptKey: 'intento',
    }),
  )
  expect(api.saveWithholdingSettings).toHaveBeenCalledWith(2, data, 'intento')
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: fiscalKeys.configuration(),
  })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sales'] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['maintenance'] })
})

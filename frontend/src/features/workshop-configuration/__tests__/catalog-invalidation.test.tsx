import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { workshopConfigApi } from '../api'
import {
  useCreateTaxDefinition,
  useCreateTaxPeriod,
  useScheduleSuccessor,
  useUpdateTaxPeriod,
} from '../queries'

afterEach(() => vi.restoreAllMocks())

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const spy = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const roots = () => spy.mock.calls.map((call) => call[0]?.queryKey?.[0])
  return { wrapper, roots }
}

it.each([
  [
    'crear definición',
    () => useCreateTaxDefinition(),
    'createTaxDefinition',
    { entity_id: 1 },
  ],
  [
    'crear vigencia',
    () => useCreateTaxPeriod(),
    'createTaxPeriod',
    { taxDefId: 1, data: {} },
  ],
  [
    'editar vigencia',
    () => useUpdateTaxPeriod(),
    'updateTaxPeriod',
    { periodId: 1, data: {} },
  ],
  [
    'programar sucesora',
    () => useScheduleSuccessor(),
    'scheduleSuccessor',
    { periodId: 1, data: {} },
  ],
] as const)(
  'al %s invalida productos y servicios',
  async (_name, useHook, method, variables) => {
    vi.spyOn(workshopConfigApi, method).mockResolvedValue({} as never)
    const { wrapper, roots } = setup()
    const { result } = renderHook(() => useHook() as never, { wrapper })
    await act(async () => {
      await (
        result.current as {
          mutateAsync: (v: unknown) => Promise<unknown>
        }
      ).mutateAsync(variables)
    })
    expect(roots()).toEqual(expect.arrayContaining(['products', 'services']))
  },
)

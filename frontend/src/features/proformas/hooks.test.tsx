import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLogout } from '@/features/auth/hooks'
import { saleKeys } from '@/features/sales/hooks'
import { createIntentTracker } from '@/shared/api/idempotency'
import { ProblemError } from '@/shared/api/client'

import { proformasApi } from './api'
import {
  invalidateAfterProformaMutation,
  proformaKeys,
  useIssuePreview,
  useProformaMutations,
} from './hooks'

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

beforeEach(() => vi.restoreAllMocks())

describe('caché de proformas', () => {
  it('una mutación propia invalida ofertas y no las ventas ni el inventario', async () => {
    const { client } = setup()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await invalidateAfterProformaMutation(client)
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      proformaKeys.root,
    ])
  })

  it('la conversión invalida también las ventas', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(saleKeys.list({}), { results: [] })
    client.setQueryData(proformaKeys.detail(5), { id: 5 })
    vi.spyOn(proformasApi, 'convert').mockResolvedValue({ id: 5 } as never)
    const { result } = renderHook(() => useProformaMutations(), { wrapper })
    await act(() =>
      result.current.convert.mutateAsync({
        id: 5,
        expectedVersion: 2,
        reviewToken: 'tok',
        key: 'k-1',
      }),
    )
    expect(client.getQueryState(saleKeys.list({}))?.isInvalidated).toBe(true)
    expect(client.getQueryState(proformaKeys.detail(5))?.isInvalidated).toBe(
      true,
    )
    expect(client.getQueryCache().findAll({ queryKey: ['inventory'] })).toEqual(
      [],
    )
  })

  it('las mutaciones nunca reintentan por sí solas', async () => {
    const { wrapper } = setup()
    const issue = vi
      .spyOn(proformasApi, 'issue')
      .mockRejectedValue(new Error('sin respuesta'))
    const { result } = renderHook(() => useProformaMutations(), { wrapper })
    await expect(
      result.current.issue.mutateAsync({
        id: 5,
        expectedVersion: 1,
        reviewToken: 'tok',
        key: 'k-1',
      }),
    ).rejects.toThrow('sin respuesta')
    expect(issue).toHaveBeenCalledTimes(1)
  })

  it('la revisión previa no se reutiliza de caché', async () => {
    const { wrapper } = setup()
    const preview = vi
      .spyOn(proformasApi, 'issuePreview')
      .mockResolvedValue({ can_issue: true } as never)
    const first = renderHook(() => useIssuePreview(5, 1, true), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()
    const second = renderHook(() => useIssuePreview(5, 1, true), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
    expect(preview).toHaveBeenCalledTimes(2)
    const off = renderHook(() => useIssuePreview(5, 1, false), { wrapper })
    expect(off.result.current.fetchStatus).toBe('idle')
  })

  it('cerrar sesión elimina las ofertas en caché', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(proformaKeys.detail(7), { id: 7, grand_total: '23.00' })
    client.setQueryData(proformaKeys.document(7), { number: 'COM-PRO-000001' })
    const api = { logout: vi.fn().mockResolvedValue(undefined) }
    const { result } = renderHook(() => useLogout(api as never), { wrapper })
    await act(() => result.current.mutateAsync())
    expect(client.getQueryData(proformaKeys.detail(7))).toBeUndefined()
    expect(client.getQueryData(proformaKeys.document(7))).toBeUndefined()
  })
})

describe('clave estable del intento', () => {
  it('un resultado incierto reutiliza la clave y una respuesta definitiva la renueva', async () => {
    const tracker = createIntentTracker()
    const keys: string[] = []
    const send = vi
      .fn<(key: string) => Promise<string>>()
      .mockImplementationOnce(async (key) => {
        keys.push(key)
        throw new ProblemError('sin respuesta', 0, 'network')
      })
      .mockImplementation(async (key) => {
        keys.push(key)
        return 'ok'
      })
    const payload = { id: 5, action: 'issue', version: 1 }
    await expect(tracker.run(payload, send)).rejects.toBeInstanceOf(
      ProblemError,
    )
    expect(tracker.hasUncertainAttempt()).toBe(true)
    await tracker.run(payload, send)
    await tracker.run(payload, send)
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[0])
  })
})
